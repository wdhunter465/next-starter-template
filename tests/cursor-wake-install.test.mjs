import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
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

function readManifestDestLabels() {
  return readFileSync(path.join(root, 'scripts/cursor-wake/host-manifest.txt'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/).slice(2).join(' '));
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
    // #5405: query 5 must not surface Zapier social hand-offs
    expect(queue).toMatch(/-label:social-post/);
    const loop = readFileSync(path.join(root, 'scripts/cursor-wake/lgfc-always-on-loop.sh'), 'utf8');
    expect(loop).toMatch(/ops_interrupt=/);
    expect(loop).toMatch(/ops:priority:1,ops:priority:2,ops:priority:3,ops:priority:4/);
    expect(loop).not.toMatch(/ops_p1=/);
  });

  it('vendors the poller without a secret or home path', () => {
    const poller = readFileSync(path.join(root, 'scripts/cursor-wake/poll-github.mjs'), 'utf8');
    expect(poller).not.toMatch(/\/home\//);
    expect(poller).not.toMatch(/ghp_|github_pat_|API_KEY|SECRET/);
    expect(poller).toMatch(/LGFC_NEXT_WORK_RESOLVER/);
  });

  it('install and verify share one host-manifest (#5427)', () => {
    const manifest = readFileSync(path.join(root, 'scripts/cursor-wake/host-manifest.txt'), 'utf8');
    const install = readFileSync(path.join(root, 'scripts/cursor-wake/install.sh'), 'utf8');
    const verify = readFileSync(path.join(root, 'scripts/cursor-wake/verify.sh'), 'utf8');
    expect(manifest).toMatch(/cursor-inbound-communication\.mjs/);
    expect(manifest).toMatch(/detect-stale-communication\.mjs/);
    expect(install).toMatch(/host-manifest\.txt/);
    expect(verify).toMatch(/host-manifest\.txt/);
    expect(install).not.toMatch(/lgfc-stop-continuous-pass/);
    const userHooks = readFileSync(path.join(root, 'scripts/cursor-wake/hooks/user-hooks.json'), 'utf8');
    expect(userHooks).not.toMatch(/lgfc-stop-continuous-pass/);
    expect(userHooks).not.toMatch(/"stop"/);
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
    for (const label of readManifestDestLabels()) {
      expect(matched).toMatch(new RegExp(`^match ${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
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

  it('clean-directory install loads the poller module graph (#5427)', () => {
    const dest = mkdtempSync(path.join(tmpdir(), 'lgfc-cursor-wake-clean-'));
    const env = { ...process.env, LGFC_CURSOR_HOME: dest };
    execFileSync('bash', ['scripts/cursor-wake/install.sh'], { cwd: root, env, encoding: 'utf8' });
    const pollerPath = path.join(dest, 'github-poller/poll-github.mjs');
    const inboundPath = path.join(dest, 'github-poller/cursor-inbound-communication.mjs');
    const detectorPath = path.join(dest, 'ops/detect-stale-communication.mjs');
    expect(readFileSync(inboundPath, 'utf8')).toMatch(/targetsCursorRole/);
    expect(readFileSync(detectorPath, 'utf8')).toMatch(/evaluateStaleCommunication/);
    // Import starts the module graph without running main() (argv[1] is not the poller).
    // Use a real Node process so Vite does not intercept paths under /tmp.
    const dry = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(pollerPath).href)});`],
      { cwd: dest, env, encoding: 'utf8' },
    );
    expect(dry).toBe('');
  });

  it('verify fails on unexpected LGFC-shaped host files (#5427)', () => {
    const dest = mkdtempSync(path.join(tmpdir(), 'lgfc-cursor-wake-unexpected-'));
    const env = { ...process.env, LGFC_CURSOR_HOME: dest };
    execFileSync('bash', ['scripts/cursor-wake/install.sh'], { cwd: root, env, encoding: 'utf8' });
    writeFileSync(path.join(dest, 'AGENTS.md'), '# host copy\n');
    mkdirSync(path.join(dest, 'rules'), { recursive: true });
    mkdirSync(path.join(dest, 'skills/lgfc-session-open'), { recursive: true });
    writeFileSync(path.join(dest, 'lgfc-extra-bloat.sh'), '#!/bin/bash\n');
    let out = '';
    try {
      execFileSync('bash', ['scripts/cursor-wake/verify.sh'], { cwd: root, env, encoding: 'utf8' });
      throw new Error('verify should exit non-zero on unexpected files');
    } catch (error) {
      if (error.message === 'verify should exit non-zero on unexpected files') throw error;
      out = error.stdout || '';
      expect(error.status).toBe(1);
    }
    expect(out).toMatch(/^unexpected AGENTS\.md$/m);
    expect(out).toMatch(/^unexpected rules\/$/m);
    expect(out).toMatch(/^unexpected skills\/lgfc-session-open\/$/m);
    expect(out).toMatch(/^unexpected lgfc-extra-bloat\.sh$/m);
  });

  it('wake-ctl resolves only AGENTS.md and CURSOR-RULES forbids host skills (#5427)', () => {
    const ctl = readFileSync(path.join(root, 'scripts/cursor-wake/lgfc-wake-ctl.sh'), 'utf8');
    expect(ctl).toMatch(/-f "\$c\/AGENTS\.md"/);
    expect(ctl).not.toMatch(/-f "\$c\/Agent\.md"/);
    expect(ctl).not.toMatch(/-name Agent\.md/);
    const rules = readFileSync(path.join(root, 'docs/ops/ai/CURSOR-RULES.md'), 'utf8');
    expect(rules).not.toMatch(/Host skills under/);
    expect(rules).toMatch(/not a second rulebook/);
  });
});
