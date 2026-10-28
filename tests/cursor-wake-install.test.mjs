import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;

function fenceAfter(markdown, heading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, heading);
  const fence = markdown.indexOf('```text\n', start);
  assert.notEqual(fence, -1, `${heading} fence`);
  const body = markdown.slice(fence + '```text\n'.length);
  const end = body.indexOf('\n```');
  assert.notEqual(end, -1, `${heading} fence end`);
  return body.slice(0, end + 1);
}

test('tick sentence and queue file match the contract', () => {
  const contract = readFileSync(join(root, 'docs/reference/ci/cursor-ready-queue-contract.md'), 'utf8');
  const tick = readFileSync(join(root, 'scripts/cursor-wake/tick-prompt.txt'), 'utf8');
  const queue = readFileSync(join(root, 'scripts/cursor-wake/lgfc-ready-queue.txt'), 'utf8');
  assert.equal(tick, fenceAfter(contract, '## Canonical tick text'));
  assert.equal(queue, fenceAfter(contract, '## The file'));
  assert.match(tick, /origin\/main/);
  assert.match(tick, /AGENT-EXECUTION\.md/);
});

test('vendored poller has no secret or home path', () => {
  const poller = readFileSync(join(root, 'scripts/cursor-wake/poll-github.mjs'), 'utf8');
  assert.doesNotMatch(poller, /\/home\//);
  assert.doesNotMatch(poller, /ghp_|github_pat_|API_KEY|SECRET/);
  assert.match(poller, /LGFC_NEXT_WORK_RESOLVER/);
});

test('install then verify reports match, then drift', () => {
  const dest = mkdtempSync(join(tmpdir(), 'lgfc-cursor-wake-'));
  const env = { ...process.env, LGFC_CURSOR_HOME: dest };
  const installed = execFileSync('bash', ['scripts/cursor-wake/install.sh'], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  assert.match(installed, /installed dest=/);
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
    assert.match(matched, new RegExp(`^match ${label}$`, 'm'));
  }
  writeFileSync(join(dest, 'lgfc-tick-prompt.txt'), 'rewritten\n');
  let drifted = '';
  try {
    execFileSync('bash', ['scripts/cursor-wake/verify.sh'], { cwd: root, env, encoding: 'utf8' });
    assert.fail('verify should exit non-zero on drift');
  } catch (error) {
    drifted = error.stdout || '';
    assert.equal(error.status, 1);
  }
  assert.match(drifted, /^drift lgfc-tick-prompt\.txt$/m);
  assert.match(drifted, /^match lgfc-wake-ctl\.sh$/m);
});
