import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fenceAfter(markdown, heading) {
  const start = markdown.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const fence = markdown.indexOf('```text\n', start);
  expect(fence).toBeGreaterThanOrEqual(0);
  const body = markdown.slice(fence + '```text\n'.length);
  const end = body.indexOf('\n```');
  expect(end).toBeGreaterThanOrEqual(0);
  return body.slice(0, end + 1);
}

describe('cursor wake install', () => {
  it('matches the contract tick sentence and queue file', () => {
    const contract = readFileSync(path.join(root, 'docs/reference/ci/cursor-ready-queue-contract.md'), 'utf8');
    const tick = readFileSync(path.join(root, 'scripts/cursor-wake/tick-prompt.txt'), 'utf8');
    const queue = readFileSync(path.join(root, 'scripts/cursor-wake/lgfc-ready-queue.txt'), 'utf8');
    expect(tick).toBe(fenceAfter(contract, '## Canonical tick text'));
    expect(queue).toBe(fenceAfter(contract, '## The file'));
    expect(tick).toMatch(/origin\/main/);
    expect(tick).toMatch(/AGENT-EXECUTION\.md/);
  });

  it('vendors the poller without a secret or home path', () => {
    const poller = readFileSync(path.join(root, 'scripts/cursor-wake/poll-github.mjs'), 'utf8');
    expect(poller).not.toMatch(/\/home\//);
    expect(poller).not.toMatch(/ghp_|github_pat_|API_KEY|SECRET/);
    expect(poller).toMatch(/LGFC_NEXT_WORK_RESOLVER/);
  });

  it('reports match after install and drift after a change', () => {
    const dest = mkdtempSync(path.join(tmpdir(), 'lgfc-cursor-wake-'));
    const env = { ...process.env, LGFC_CURSOR_HOME: dest };
    const installed = execFileSync('bash', ['scripts/cursor-wake/install.sh'], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
    expect(installed).toMatch(/installed dest=/);
    const matched = execFileSync('bash', ['scripts/cursor-wake/verify.sh'], {
      cwd: root,
      env,
      encoding: 'utf8',
    });
    for (const label of [
      'lgfc-wake-ctl.sh',
      'lgfc-always-on-loop.sh',
      'lgfc-wake-watchdog.sh',
      'github-poller/poll-github.mjs',
      'lgfc-tick-prompt.txt',
      'lgfc-ready-queue.txt',
    ]) {
      expect(matched).toMatch(new RegExp(`^match ${label}$`, 'm'));
    }
    writeFileSync(path.join(dest, 'lgfc-tick-prompt.txt'), 'rewritten\n');
    let drifted = '';
    try {
      execFileSync('bash', ['scripts/cursor-wake/verify.sh'], { cwd: root, env, encoding: 'utf8' });
      throw new Error('verify should exit non-zero on drift');
    } catch (error) {
      if (error.message === 'verify should exit non-zero on drift') throw error;
      drifted = error.stdout || '';
      expect(error.status).toBe(1);
    }
    expect(drifted).toMatch(/^drift lgfc-tick-prompt\.txt$/m);
    expect(drifted).toMatch(/^match lgfc-wake-ctl\.sh$/m);
  });
});
