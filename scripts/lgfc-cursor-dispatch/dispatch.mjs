#!/usr/bin/env node
/**
 * Fixed LGFC Cursor dispatch wrapper.
 *
 * Accepts identifiers only. Never interpolates Issue/comment bodies into
 * shell or Cursor argv. Cursor must fetch the live source Issue after start.
 *
 * Usage:
 *   node scripts/lgfc-cursor-dispatch/dispatch.mjs \
 *     --repo wdhunter465/next-starter-template \
 *     --issue 3212 \
 *     --event workflow_dispatch \
 *     --delivery-id wake-123-3212 \
 *     --run-id 123 \
 *     [--dry-run] [--workspace /path]
 */

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseDispatchArgv, buildIdentifiersOnlyPrompt } from './lib/argv.mjs';
import {
  acquireDispatchLock,
  resolveAndValidateWorkspace,
  resolveAgentBinary,
} from './lib/preflight.mjs';

function log(level, message, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    component: 'lgfc-cursor-dispatch',
    message,
    ...extra,
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

function defaultLockPath() {
  return (
    process.env.LGFC_CURSOR_DISPATCH_LOCK ||
    path.join(os.homedir(), '.lgfc-cursor-dispatch', 'dispatch.lock')
  );
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
    dryRun: values.dryRun,
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
    // Hard guarantee: prompt must not contain multi-line Issue bodies from env.
    if (/MODE: IMPLEMENTATION \(label/.test(prompt)) {
      log('error', 'prompt_contract_violation');
      process.exitCode = 5;
      return;
    }

    if (values.dryRun) {
      log('info', 'dry_run_ok', {
        workspace: workspaceResult.workspace,
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 180),
      });
      process.exitCode = 0;
      return;
    }

    const binary = resolveAgentBinary();
    if (!binary) {
      log('error', 'cli_binary_missing');
      process.exitCode = 6;
      return;
    }

    const commonArgs = [
      '-p',
      prompt,
      '--output-format',
      'text',
      '--workspace',
      workspaceResult.workspace,
      '--trust',
    ];
    // never add --yolo / --force
    const args = binary.kind === 'cursor-agent' ? ['agent', ...commonArgs] : commonArgs;

    log('info', 'cursor_invoke', {
      bin: binary.bin,
      kind: binary.kind,
      args: args.filter((a) => a !== prompt),
      promptLength: prompt.length,
    });

    const result = spawnSync(binary.bin, args, {
      cwd: workspaceResult.workspace,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = String(result.stdout || '').slice(0, 4000);
    const stderr = String(result.stderr || '').slice(0, 2000);
    if (result.error) {
      log('error', 'cursor_exec_error', { detail: String(result.error) });
      process.exitCode = 7;
      return;
    }

    log('info', 'cursor_exit', {
      status: result.status,
      stdoutPreview: stdout.slice(0, 500),
      stderrPreview: stderr.slice(0, 500),
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
