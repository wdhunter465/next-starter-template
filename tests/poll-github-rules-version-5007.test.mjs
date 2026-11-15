import { describe, expect, it } from 'vitest';
import {
  RULES_CHANGED_PROMPT,
  RULES_FETCH_FAILED_ONCE_PROMPT,
  buildRulesPromptParts,
  fetchRulesVersion,
} from '../scripts/cursor-wake/poll-github.mjs';

describe('poll-github rules version (#5007)', () => {
  it('puts the reload sentence in the prompt when rulesChanged is true', () => {
    const parts = buildRulesPromptParts({
      rulesChanged: true,
      fetchOk: true,
      announceFetchFailure: false,
    });
    expect(parts).toEqual([RULES_CHANGED_PROMPT]);
    expect(parts[0]).toMatch(/AGENT-EXECUTION blob changed/);
    expect(parts[0]).toMatch(/Assigned-queue continuation/);
  });

  it('announces a fetch failure only when announceFetchFailure is true', () => {
    const first = buildRulesPromptParts({
      rulesChanged: false,
      fetchOk: false,
      announceFetchFailure: true,
    });
    expect(first).toEqual([RULES_FETCH_FAILED_ONCE_PROMPT]);

    const later = buildRulesPromptParts({
      rulesChanged: false,
      fetchOk: false,
      announceFetchFailure: false,
    });
    expect(later).toEqual([]);
  });

  it('combines reload and one-shot failure when both apply', () => {
    const parts = buildRulesPromptParts({
      rulesChanged: true,
      fetchOk: false,
      announceFetchFailure: true,
    });
    expect(parts).toEqual([RULES_CHANGED_PROMPT, RULES_FETCH_FAILED_ONCE_PROMPT]);
  });

  it('marks rulesChanged when the AGENT-EXECUTION blob SHA differs', () => {
    const calls = [];
    const execFile = (cmd, args) => {
      calls.push([cmd, ...args]);
      const key = args.join(' ');
      if (key === 'fetch origin main') return '';
      if (key === 'rev-parse origin/main') return 'abc123\n';
      if (key === 'rev-parse origin/main:docs/governance/AGENT-EXECUTION.md') {
        return 'new-blob-sha\n';
      }
      if (args[0] === 'show') return '# stub\n';
      throw new Error(`unexpected ${cmd} ${key}`);
    };
    const changed = fetchRulesVersion({
      repoRoot: '/tmp/unused',
      execFile,
      previousBlobSha: 'old-blob-sha',
    });
    expect(changed.fetchOk).toBe(true);
    expect(changed.rulesChanged).toBe(true);
    expect(changed.agentExecutionBlobSha).toBe('new-blob-sha');

    const same = fetchRulesVersion({
      repoRoot: '/tmp/unused',
      execFile,
      previousBlobSha: 'new-blob-sha',
    });
    expect(same.rulesChanged).toBe(false);
  });

  it('returns fetchOk false on exec failure without throwing', () => {
    const result = fetchRulesVersion({
      repoRoot: '/tmp/unused',
      execFile: () => {
        throw new Error('network down');
      },
      previousBlobSha: 'any',
    });
    expect(result.fetchOk).toBe(false);
    expect(result.rulesChanged).toBe(false);
    expect(result.error).toMatch(/network down/);
  });
});
