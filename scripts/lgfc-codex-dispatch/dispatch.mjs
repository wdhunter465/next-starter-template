#!/usr/bin/env node
/**
 * Fixed LGFC Codex dispatch wrapper (#4052).
 *
 * Accepts identifiers only. Never interpolates Issue/comment bodies into
 * shell or Codex argv. Codex must fetch the live source Issue after start.
 */

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseDispatchArgv, buildIdentifiersOnlyPrompt } from './lib/argv.mjs';
import {
  acquireDispatchLock,
  resolveAndValidateWorkspace,
  resolveCodexBinary
} from './lib/preflight.mjs';

function log(level, message, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    component: 'lgfc-codex-dispatch',
    message,
    ...extra
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

function defaultLockPath() {
  return (
    process.env.LGFC_CODEX_DISPATCH_LOCK ||
    path.join(os.homedir(), '.lgfc-codex-dispatch', 'dispatch.lock')
  );
}

function assertSafeCodexArgs(args) {
  const joined = args.join(' ');
  if (/dangerously-bypass|yolo|--force\b/i.test(joined)) {
    return false;
  }
  return true;
}

function main(argv = process.argv.slice(2)) {
  const parsed = parseDispatchArgv(argv);
  if (!parsed.ok) {
    log('error', 'argv_rejected', { error: parsed.error });
    process.exitCode = 2;
    return;
  }

  const { values } = parsed;
  log('info', 'dispatch_start', {
    repo: values.repo,
    issue: values.issueNumber,
    event: values.event,
    deliveryId: values.deliveryId,
    runId: values.runId,
    dryRun: values.dryRun
  });

  const workspaceResult = resolveAndValidateWorkspace(values.workspace);
  if (!workspaceResult.ok) {
    log('error', 'preflight_failed', { error: workspaceResult.error });
    process.exitCode = 3;
    return;
  }

  const lock = acquireDispatchLock(defaultLockPath());
  if (!lock.ok) {
    log('error', 'preflight_failed', { error: lock.error });
    process.exitCode = 4;
    return;
  }

  try {
    const prompt = buildIdentifiersOnlyPrompt(values);
    if (/MODE: IMPLEMENTATION \(label/.test(prompt)) {
      log('error', 'prompt_contract_violation');
      process.exitCode = 5;
      return;
    }

    if (values.dryRun) {
      log('info', 'dry_run_ok', {
        workspace: workspaceResult.workspace,
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 180)
      });
      process.exitCode = 0;
      return;
    }

    const binary = resolveCodexBinary();
    if (!binary) {
      log('error', 'cli_binary_missing');
      process.exitCode = 6;
      return;
    }

    const args = ['exec', '--cd', workspaceResult.workspace, prompt];
    if (!assertSafeCodexArgs(args)) {
      log('error', 'unsafe_codex_args');
      process.exitCode = 5;
      return;
    }

    log('info', 'codex_invoke', {
      bin: binary.bin,
      kind: binary.kind,
      args: args.filter((a) => a !== prompt),
      promptLength: prompt.length
    });

    const result = spawnSync(binary.bin, args, {
      cwd: workspaceResult.workspace,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdout = String(result.stdout || '').slice(0, 4000);
    const stderr = String(result.stderr || '').slice(0, 2000);
    if (result.error) {
      log('error', 'codex_exec_error', { detail: String(result.error) });
      process.exitCode = 7;
      return;
    }

    log('info', 'codex_exit', {
      status: result.status,
      stdoutPreview: stdout.slice(0, 500),
      stderrPreview: stderr.slice(0, 500)
    });

    process.exitCode = result.status === 0 ? 0 : 8;
  } finally {
    lock.release();
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

export { main };
