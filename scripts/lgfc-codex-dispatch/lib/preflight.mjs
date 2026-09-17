import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const EXPECTED_REPO = 'wdhunter465/next-starter-template';

function isCanonicalRemote(url) {
  return /github\.com[:/]+(wdhunter465|wdhunter645)\/next-starter-template(?:\.git)?(?:\/)?$/i.test(
    String(url || '').trim()
  );
}

export function resolveAndValidateWorkspace(explicitWorkspace) {
  const candidates = [
    explicitWorkspace,
    process.env.LGFC_CODEX_DISPATCH_WORKSPACE,
    process.env.GITHUB_WORKSPACE,
    process.cwd()
  ].filter(Boolean);

  for (const candidate of candidates) {
    const abs = path.resolve(candidate);
    const agentMd = path.join(abs, 'Agent.md');
    const packageJson = path.join(abs, 'package.json');
    if (!fs.existsSync(agentMd) || !fs.existsSync(packageJson)) continue;

    const remote = spawnSync('git', ['-C', abs, 'remote', 'get-url', 'origin'], {
      encoding: 'utf8'
    });
    if (remote.error || remote.status !== 0) {
      return { ok: false, error: `git_remote_unavailable:${abs}` };
    }
    const url = String(remote.stdout || '').trim();
    if (!isCanonicalRemote(url)) {
      return { ok: false, error: `unexpected_remote:${url}` };
    }

    const dirty = spawnSync('git', ['-C', abs, 'status', '--porcelain'], {
      encoding: 'utf8'
    });
    if (dirty.error) {
      return { ok: false, error: `git_status_unavailable:${abs}` };
    }
    if (
      String(dirty.stdout || '').trim() &&
      process.env.LGFC_CODEX_DISPATCH_ALLOW_DIRTY !== '1'
    ) {
      return { ok: false, error: 'dirty_worktree' };
    }

    return { ok: true, workspace: abs };
  }

  return { ok: false, error: 'workspace_not_found' };
}

export function acquireDispatchLock(lockPath) {
  const dir = path.dirname(lockPath);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(
      fd,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2) + '\n'
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
      }
    };
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      return { ok: false, error: 'dispatch_lock_held' };
    }
    return { ok: false, error: `dispatch_lock_failed:${error}` };
  }
}

export function resolveCodexBinary() {
  const candidates = ['/usr/bin/codex', 'codex'];
  for (const bin of candidates) {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (r.error) continue;
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
    if (r.status === 0 && /codex/i.test(out)) {
      return { kind: 'codex-exec', bin };
    }
  }
  return null;
}
