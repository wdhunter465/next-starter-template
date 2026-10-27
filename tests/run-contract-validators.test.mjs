import { describe, expect, it } from 'vitest';
import {
  evaluateRecord,
  exitCodeFor,
  issueNumberFromText,
  renderReport,
  selectScope
} from '../scripts/ci/run-contract-validators.mjs';

const COMPLETE_BODY = `
Objective: Ship the widget rollback path
Parent project: #1000
Predecessor: #1001
Writable files/actions: src/widget/**
Acceptance criteria: widget renders without error
Required validation: npm test passes
Expected artifact/PR: PR against main with test evidence
Rollback: revert the merge commit
Protected stops: none identified
HOLD owner: not applicable
HOLD evidence: not applicable
HOLD release condition: not applicable
HOLD mitigation owner: not applicable
HOLD parallel-safe work: not applicable
HOLD disputed-risk decision owner: not applicable
Independent reviewer role holder: WORK
Successor: #1002
Durable evidence location: PR description and CI run link
`;

describe('run-contract-validators (#4778)', () => {
  it('reads the source issue from a pull request body', () => {
    expect(issueNumberFromText('- **Issue:** #4778\n')).toBe(4778);
  });

  it('reports a complete child with no findings', () => {
    const result = evaluateRecord({
      number: 4700,
      body: COMPLETE_BODY,
      labels: ['pmo:task', 'pmo:active']
    });
    expect(result.inScope).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('reports an incomplete child', () => {
    const result = evaluateRecord({
      number: 4701,
      body: 'Objective: only one field',
      labels: ['pmo:task']
    });
    expect(result.findings.map((finding) => finding.validator)).toContain('executable-child');
    expect(renderReport([result])).toContain('#4701 executable-child');
  });

  it('leaves a pull request green and fails a scheduled run', () => {
    const results = [{ number: 1, inScope: true, findings: [{ validator: 'executable-child', summary: 'PACKAGE-INCOMPLETE' }] }];
    expect(exitCodeFor('pr', results)).toBe(0);
    expect(exitCodeFor('schedule', results)).toBe(1);
    expect(exitCodeFor('schedule', [{ findings: [] }])).toBe(0);
  });

  it('skips records that are outside every contract', () => {
    const issue = { number: 9, body: 'No contract fields', labels: ['documentation'] };
    expect(selectScope(issue)).toEqual({ child: false, candidate: false, approval: false });
    expect(evaluateRecord(issue).inScope).toBe(false);
  });

  it('reports a named gate category that is not deterministic', () => {
    const result = evaluateRecord({
      number: 12,
      body: 'Gate category: not-a-category',
      labels: []
    });
    expect(result.findings[0].validator).toBe('deterministic-approval');
  });
});
