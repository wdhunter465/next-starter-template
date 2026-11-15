import { describe, expect, it } from 'vitest';
import {
  claimRequester,
  claimsToBeExecutable,
  evaluateRecord,
  exitCodeFor,
  implementationAgentLabel,
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

  it('skips a parked child in a scheduled sweep but not in pull-request mode (#5014)', () => {
    const parked = { number: 4702, body: 'Objective: parked', labels: ['pmo:task', 'team:engineering'] };
    expect(selectScope(parked, { executableOnly: true }).child).toBe(false);
    expect(evaluateRecord(parked, { executableOnly: true })).toMatchObject({ inScope: false, findings: [] });
    expect(selectScope(parked).child).toBe(true);
    expect(evaluateRecord(parked).findings.length).toBeGreaterThan(0);
  });

  it('flags a ready, active or claimed child with an incomplete package (#5014)', () => {
    for (const label of ['status:ready', 'status:active', 'handoff:ready', 'agent:claude']) {
      const child = { number: 4703, body: 'Objective: only one field', labels: ['pmo:task', label] };
      expect(claimsToBeExecutable([label])).toBe(true);
      const result = evaluateRecord(child, { executableOnly: true });
      expect(result.inScope).toBe(true);
      expect(result.findings.map((finding) => finding.validator)).toContain('executable-child');
    }
  });

  it('keeps a ready child with a complete package clean in a scheduled sweep (#5014)', () => {
    const result = evaluateRecord(
      { number: 4704, body: COMPLETE_BODY, labels: ['pmo:task', 'status:ready'] },
      { executableOnly: true }
    );
    expect(result.inScope).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('accepts a package-complete child held by one agent in a scheduled sweep (#5027)', () => {
    const child = { number: 4705, body: COMPLETE_BODY, labels: ['pmo:task', 'status:active', 'agent:claude'] };
    const swept = evaluateRecord(child, { executableOnly: true, requestingAgent: 'advisory' });
    expect(swept.inScope).toBe(true);
    expect(swept.findings).toEqual([]);
    // Without the scheduled-sweep option the requester is unchanged, so a stranger still cannot claim it.
    const asStranger = evaluateRecord(child, { requestingAgent: 'advisory' });
    expect(asStranger.findings.map((finding) => finding.validator)).toContain('claim-collision');
  });

  it('still flags a child with conflicting agent labels in a scheduled sweep (#5027)', () => {
    const child = { number: 4706, body: COMPLETE_BODY, labels: ['pmo:task', 'status:active', 'agent:claude', 'agent:cursor'] };
    const result = evaluateRecord(child, { executableOnly: true, requestingAgent: 'advisory' });
    expect(result.findings.map((finding) => finding.validator)).toContain('claim-collision');
  });

  it('does not treat wait or hold labels as a claim to be executable (#5014)', () => {
    expect(claimsToBeExecutable(['pmo:task', 'wait:product', 'status:hold', 'pmo:active'])).toBe(false);
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

describe('pull-request mode takes the requester from the Implementation agent field (#5180)', () => {
  const claimed = (labels) => ({ number: 4467, body: COMPLETE_BODY, labels: ['pmo:task', 'status:active', ...labels] });
  const prMode = (child, implementationAgent) => evaluateRecord(child, { requestingAgent: 'wdhunter465', implementationAgent });
  const validators = (result) => result.findings.map((finding) => finding.validator);

  it('gives a holder\'s pull request against its claimed executable child no claim-collision finding', () => {
    expect(validators(prMode(claimed(['agent:claude']), 'agent:claude'))).not.toContain('claim-collision');
    expect(validators(prMode(claimed(['agent:cursor']), 'agent:cursor'))).not.toContain('claim-collision');
  });

  it('still reports it for a pull request from a different agent', () => {
    expect(validators(prMode(claimed(['agent:claude']), 'agent:cursor'))).toContain('claim-collision');
    expect(validators(prMode(claimed(['agent:cursor']), 'agent:claude'))).toContain('claim-collision');
  });

  it('still reports it when the child carries conflicting agent labels, even for one of the holders', () => {
    const conflicted = claimed(['agent:claude', 'agent:cursor']);
    expect(validators(prMode(conflicted, 'agent:claude'))).toContain('claim-collision');
    expect(validators(prMode(conflicted, 'agent:cursor'))).toContain('claim-collision');
  });

  it('still reports it when the pull request body names no agent or an unknown one', () => {
    expect(validators(prMode(claimed(['agent:claude']), undefined))).toContain('claim-collision');
    expect(validators(prMode(claimed(['agent:claude']), implementationAgentLabel('- Implementation agent: Grok') || undefined))).toContain('claim-collision');
  });

  it('is unchanged for a child nobody holds', () => {
    const before = evaluateRecord(claimed([]), { requestingAgent: 'wdhunter465' });
    expect(prMode(claimed([]), 'agent:claude')).toEqual(before);
  });

  it('leaves the scheduled sweep exactly as it was', () => {
    expect(validators(evaluateRecord(claimed(['agent:claude']), { executableOnly: true, requestingAgent: 'advisory' }))).not.toContain('claim-collision');
    expect(validators(evaluateRecord(claimed(['agent:claude', 'agent:cursor']), { executableOnly: true, requestingAgent: 'advisory' }))).toContain('claim-collision');
  });

  it('claimRequester returns the holder only for the matching single label', () => {
    expect(claimRequester(['agent:claude'], { requestingAgent: 'x', implementationAgent: 'agent:claude' })).toBe('agent:claude');
    expect(claimRequester(['agent:claude'], { requestingAgent: 'x', implementationAgent: 'agent:cursor' })).toBe('x');
    expect(claimRequester(['agent:claude', 'agent:cursor'], { requestingAgent: 'x', implementationAgent: 'agent:claude' })).toBe('x');
    expect(claimRequester([], { requestingAgent: 'x', implementationAgent: 'agent:claude' })).toBe('x');
  });

  it('reads the agent from the template line in its common forms', () => {
    expect(implementationAgentLabel('# PR Summary\n\n- Implementation agent: Claude Code\n- Component branch: none')).toBe('agent:claude');
    expect(implementationAgentLabel('Implementation agent: Cursor')).toBe('agent:cursor');
    expect(implementationAgentLabel('* Implementation agent:   claude code  ')).toBe('agent:claude');
    expect(implementationAgentLabel('- Implementation agent: agent:cursor')).toBe('agent:cursor');
    expect(implementationAgentLabel('- Implementation agent: Claude Code <!-- note -->')).toBe('agent:claude');
  });

  it('returns null when the line is missing, empty, a placeholder, or names someone else', () => {
    expect(implementationAgentLabel('')).toBeNull();
    expect(implementationAgentLabel('no such line')).toBeNull();
    expect(implementationAgentLabel('- Implementation agent:')).toBeNull();
    expect(implementationAgentLabel('- Implementation agent: <!-- required -->')).toBeNull();
    expect(implementationAgentLabel('- Implementation agent: Grok')).toBeNull();
    expect(implementationAgentLabel(undefined)).toBeNull();
  });
});
