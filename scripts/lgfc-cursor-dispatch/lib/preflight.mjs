import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const EXPECTED_REPO = 'wdhunter465/next-starter-template';

/**
 * Resolve workspace and verify it looks like the LGFC checkout.
 * @returns {{ ok: true, workspace: string } | { ok: false, error: string }}
 */
export function resolveAndValidateWorkspace(explicitWorkspace) {
  const candidates = [
    explicitWorkspace,
    process.env.LGFC_CURSOR_DISPATCH_WORKSPACE,
    process.env.GITHUB_WORKSPACE,
    process.cwd(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const abs = path.resolve(candidate);
    const agentMd = path.join(abs, 'Agent.md');
    const packageJson = path.join(abs, 'package.json');
    if (!fs.existsSync(agentMd) || !fs.existsSync(packageJson)) continue;

    const remote = spawnSync('git', ['-C', abs, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8',
    });
    if (remote.error || remote.status !== 0) {
      return { ok: false, error: `git_remote_unavailable:${abs}` };
    }
    const url = String(remote.stdout || '').trim();
    if (!url.includes(EXPECTED_REPO)) {
      return { ok: false, error: `unexpected_remote:${url}` };
    }

    const dirty = spawnSync('git', ['-C', abs, 'status', '--porcelain'], {
      encoding: 'utf8',
    });
    if (dirty.error) {
      return { ok: false, error: `git_status_unavailable:${abs}` };
    }
    // Fail closed on unexpected local mutation before agent start.
    // Unit tests may set LGFC_CURSOR_DISPATCH_ALLOW_DIRTY=1 with --dry-run only.
    if (
      String(dirty.stdout || '').trim() &&
      process.env.LGFC_CURSOR_DISPATCH_ALLOW_DIRTY !== '1'
    ) {
      return { ok: false, error: 'dirty_worktree' };
    }

    return { ok: true, workspace: abs };
  }

  return { ok: false, error: 'workspace_not_found' };
}

// Only used as a fallback when a held lock's owning pid can't be determined
// (corrupt or legacy lock file) -- a lock with a live, confirmed pid is never
// reclaimed by age alone, no matter how old, to avoid stealing it out from
// under a genuinely long-running dispatch.
const DEFAULT_STALE_LOCK_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && error.code === 'ESRCH') return false;
    // EPERM (owned by another user) or anything unexpected: assume alive, fail closed.
    return true;
  }
}

function readLockOwnerPid(lockPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    return Number.isInteger(parsed.pid) && parsed.pid > 0 ? parsed.pid : null;
  } catch {
    return null;
  }
}

// A lock left behind by a process that crashed, was killed, or lost its host
// before it could call release() blocks every future dispatch forever --
// there is no other recovery path. Reclaim it only when we can positively
// confirm the original owner is gone (or, lacking that, once it's old enough
// that continuing to honor it is worse than the small risk of reclaiming it).
function isLockStale(lockPath, maxAgeMs) {
  const pid = readLockOwnerPid(lockPath);
  if (pid !== null) {
    return !isProcessAlive(pid);
  }
  let stat;
  try {
    stat = fs.statSync(lockPath);
  } catch {
    return true; // Lock vanished since the failed open attempt.
  }
  return Date.now() - stat.mtimeMs > maxAgeMs;
}

/**
 * Exclusive local lock to prevent parallel Cursor dispatch writers.
 */
export function acquireDispatchLock(lockPath, options = {}) {
  const maxAgeMs = options.staleAfterMs ?? DEFAULT_STALE_LOCK_MAX_AGE_MS;
  const dir = path.dirname(lockPath);
  fs.mkdirSync(dir, { recursive: true });

  const attempt = () => {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(
        fd,
        JSON.stringify(
          {
            pid: process.pid,
            startedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + '\n',
      );
      return {
        ok: true,
        release() {
          try {
            fs.closeSync(fd);
          } catch {
            // ignore
          }
          try {
            fs.unlinkSync(lockPath);
          } catch {
            // ignore
          }
        },
      };
    } catch (error) {
      if (error && error.code === 'EEXIST') {
        return { ok: false, error: 'dispatch_lock_held' };
      }
      return { ok: false, error: `dispatch_lock_failed:${error}` };
    }
  };

  const first = attempt();
  if (first.ok || first.error !== 'dispatch_lock_held') return first;
  if (!isLockStale(lockPath, maxAgeMs)) return first;
  if (!tryReclaimStaleLock(lockPath, maxAgeMs)) return first;

  const second = attempt();
  return second.ok ? { ...second, reclaimedStaleLock: true } : second;
}

// Two concurrent callers can both observe the same lock as stale and both
// decide to reclaim it. A plain unlink-then-recreate is not exclusive: the
// second caller's unlink can delete the *fresh* lock the first caller just
// created, letting both proceed and defeating the whole point of the lock.
// Serialize the reclaim itself through a second, short-lived exclusive-create
// guard, and re-verify staleness of the *current* lock contents inside that
// single-reclaimer section -- by the time we get in, it may have already been
// replaced by a live one.
function tryReclaimStaleLock(lockPath, maxAgeMs) {
  const guardPath = `${lockPath}.reclaiming`;
  let guardFd;
  try {
    guardFd = fs.openSync(guardPath, 'wx');
  } catch {
    // Someone else is already reclaiming this lock; don't race them for it.
    return false;
  }
  try {
    if (!isLockStale(lockPath, maxAgeMs)) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.closeSync(guardFd);
    } catch {
      // ignore
    }
    try {
      fs.unlinkSync(guardPath);
    } catch {
      // ignore
    }
  }
}

export function resolveAgentBinary() {
  const candidates = [
    { kind: 'agent', bin: 'agent' },
    { kind: 'cursor-agent', bin: 'cursor' },
  ];
  for (const c of candidates) {
    const args = c.kind === 'cursor-agent' ? ['agent', 'status'] : ['status'];
    const r = spawnSync(c.bin, args, { encoding: 'utf8' });
    if (r.error) continue;
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
    if (/not logged in/i.test(out) || /unauthorized/i.test(out)) continue;
    // Accept exit 0, or ambiguous non-zero output that still looks authenticated.
    if (r.status === 0 || /logged in|email|@/i.test(out)) {
      return c;
    }
  }
  return null;
}
