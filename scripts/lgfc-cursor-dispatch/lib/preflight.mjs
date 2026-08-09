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
    if (!url.includes('wdhunter465/next-starter-template')) {
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

/**
 * Exclusive local lock to prevent parallel Cursor dispatch writers.
 */
export function acquireDispatchLock(lockPath) {
  const dir = path.dirname(lockPath);
  fs.mkdirSync(dir, { recursive: true });
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
}

export function resolveAgentBinary() {
  const candidates = [
    { kind: 'agent', bin: 'agent' },
    { kind: 'cursor-agent', bin: 'cursor' },
  ];
  for (const c of candidates) {
    const args = c.kind === 'cursor-agent' ? ['agent', 'status'] : ['status'];
    const r = spawnSync(c.bin, args, { encoding: 'utf8' });
    if (!r.error) return c;
  }
  return null;
}
