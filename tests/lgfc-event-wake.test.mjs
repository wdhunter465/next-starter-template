import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

describe('lgfc-event-wake actionable', () => {
  it('marks handoff ready as actionable', () => {
    const result = classifyIssue({
      number: 3340,
      state: 'open',
      labels: [{ name: 'agent:cursor' }, { name: 'handoff:ready' }],
    });
    expect(result.actionable).toBe(true);
    expect(result.reason).toBe('cursor-handoff');
  });

  it('blocks handed-off status', () => {
    const result = classifyIssue({
      number: 3340,
      state: 'open',
      labels: [
        { name: 'agent:cursor' },
        { name: 'handoff:ready' },
        { name: 'status:complete' },
      ],
    });
    expect(result.actionable).toBe(false);
  });

  it('marks ops priority 1 as actionable', () => {
    const result = classifyIssue({
      number: 1,
      state: 'open',
      labels: [{ name: 'ops:priority:1' }],
    });
    expect(result.actionable).toBe(true);
    expect(result.reason).toBe('ops-priority-1');
  });
});

describe('lgfc-event-wake watermark', () => {
  it('dedupes wake keys across save/load', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lgfc-ew-'));
    const statePath = path.join(dir, 'state.json');
    const state = loadState(statePath);
    const key = wakeKey(
      { number: 10, updated_at: '2026-08-11T00:00:00Z' },
      'cursor-handoff',
    );
    expect(alreadySeen(state.seenWakeKeys, key)).toBe(false);
    state.seenWakeKeys.push(key);
    saveState(statePath, state);
    const reloaded = loadState(statePath);
    expect(alreadySeen(reloaded.seenWakeKeys, key)).toBe(true);
  });
});

describe('lgfc-event-wake pollOnce', () => {
  it('invokes once and suppresses duplicates', () => {
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
    expect(first.wakes).toHaveLength(1);
    expect(invocations).toHaveLength(1);

    const second = pollOnce(
      {
        repo: 'wdhunter465/next-starter-template',
        dryRun: true,
        statusOnly: true,
        workspace: dir,
      },
      deps,
    );
    expect(second.wakes).toHaveLength(0);
    expect(invocations).toHaveLength(1);
  });
});
