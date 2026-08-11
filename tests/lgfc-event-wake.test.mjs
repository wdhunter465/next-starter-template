import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyIssue,
  wakeKey,
} from '../scripts/lgfc-event-wake/lib/actionable.mjs';
import {
  alreadySeen,
  loadState,
  saveState,
} from '../scripts/lgfc-event-wake/lib/watermark.mjs';
import { pollOnce } from '../scripts/lgfc-event-wake/poll.mjs';

test('classifyIssue: handoff ready is actionable', () => {
  const result = classifyIssue({
    number: 3340,
    state: 'open',
    labels: [{ name: 'agent:cursor' }, { name: 'handoff:ready' }],
  });
  assert.equal(result.actionable, true);
  assert.equal(result.reason, 'cursor-handoff');
});

test('classifyIssue: handed-off status blocks', () => {
  const result = classifyIssue({
    number: 3340,
    state: 'open',
    labels: [
      { name: 'agent:cursor' },
      { name: 'handoff:ready' },
      { name: 'status:complete' },
    ],
  });
  assert.equal(result.actionable, false);
});

test('classifyIssue: ops priority 1', () => {
  const result = classifyIssue({
    number: 1,
    state: 'open',
    labels: [{ name: 'ops:priority:1' }],
  });
  assert.equal(result.actionable, true);
  assert.equal(result.reason, 'ops-priority-1');
});

test('watermark dedupes wake keys', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lgfc-ew-'));
  const statePath = path.join(dir, 'state.json');
  const state = loadState(statePath);
  const key = wakeKey(
    { number: 10, updated_at: '2026-08-11T00:00:00Z' },
    'cursor-handoff',
  );
  assert.equal(alreadySeen(state.seenWakeKeys, key), false);
  state.seenWakeKeys.push(key);
  saveState(statePath, state);
  const reloaded = loadState(statePath);
  assert.equal(alreadySeen(reloaded.seenWakeKeys, key), true);
});

test('pollOnce invokes once and suppresses duplicate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lgfc-ew-'));
  const statePath = path.join(dir, 'state.json');
  const issue = {
    number: 3340,
    state: 'open',
    updated_at: '2026-08-11T12:00:00Z',
    labels: [{ name: 'agent:cursor' }, { name: 'handoff:ready' }],
  };
  const invocations = [];
  const deps = {
    statePath,
    fetchIssues: () => [issue],
    invoke: (args) => {
      invocations.push(args);
      return true;
    },
  };

  const first = pollOnce(
    {
      repo: 'wdhunter465/next-starter-template',
      dryRun: true,
      statusOnly: true,
      workspace: dir,
    },
    deps,
  );
  assert.equal(first.wakes.length, 1);
  assert.equal(invocations.length, 1);

  const second = pollOnce(
    {
      repo: 'wdhunter465/next-starter-template',
      dryRun: true,
      statusOnly: true,
      workspace: dir,
    },
    deps,
  );
  assert.equal(second.wakes.length, 0);
  assert.equal(invocations.length, 1);
});
