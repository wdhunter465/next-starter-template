import { describe, expect, it } from 'vitest';
import {
  CONTRACT_STATUS,
  detectLifecycleContradiction,
  evaluateExecutableChildContract,
  extractFieldValue,
  parseContractFields,
  validatePackageCompleteness
} from '../scripts/ci/executable-child-contract.mjs';

const VALID_BODY = `
## Authority and sequence

Objective: Ship the widget rollback path
Parent project: #1000
Predecessor: #1001
Writable files/actions: src/widget/**

## Acceptance and implementation

Acceptance criteria: widget renders without error
Required validation: npm test passes
Expected artifact/PR: PR against main with test evidence

## Safety, rollback, and recovery

Rollback: revert the merge commit
Protected stops: none identified

## Independent review

Independent reviewer role holder: WORK

## Closeout

Successor: #1002
Durable evidence location: PR description and CI run link
`;

describe('executable-child-contract (#3665)', () => {
  it('extracts a labeled field value', () => {
    expect(extractFieldValue(VALID_BODY, ['objective'])).toBe(
      'Ship the widget rollback path'
    );
  });

  it('returns null when no synonym label matches', () => {
    expect(extractFieldValue(VALID_BODY, ['nonexistent field'])).toBeNull();
  });

  it('parses all fields present on a valid package', () => {
    const { present, missing } = parseContractFields(VALID_BODY);
    expect(missing).toEqual([]);
    expect(present).toHaveLength(12);
  });

  it('treats template placeholder blanks as missing', () => {
    const body = 'Objective: ____\nParent project: #____\n';
    const { missing } = parseContractFields(body);
    expect(missing).toEqual(expect.arrayContaining(['objective', 'parentProject']));
  });

  it('treats an explicit "not applicable" as filled', () => {
    const body = 'Successor: ____ | terminal\n';
    const { present } = parseContractFields(body);
    expect(present).toContain('successor');
  });

  it('rejects a package missing required fields', () => {
    const result = validatePackageCompleteness({ body: 'Objective: fix the bug' });
    expect(result.complete).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/missing required execution-contract field/);
  });

  it('accepts a fully package-complete body', () => {
    const result = validatePackageCompleteness({ body: VALID_BODY });
    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects lifecycle contradiction: not-authorized narrative with Active label', () => {
    const result = detectLifecycleContradiction({
      body: 'Implementation is not authorized until Product Authority approves.',
      labels: ['pmo:active', 'pmo:priority:1']
    });
    expect(result.consistent).toBe(false);
    expect(result.contradictions[0]).toMatch(/not authorized/);
  });

  it('detects terminal-narrative/live-state contradiction', () => {
    const result = detectLifecycleContradiction({
      body: 'Disposition: Closed and reconciled.',
      labels: ['pmo:active', 'pmo:priority:1']
    });
    expect(result.consistent).toBe(false);
    expect(result.contradictions[0]).toMatch(/terminal narrative/);
  });

  it('detects pmo:closed label with non-terminal narrative', () => {
    const result = detectLifecycleContradiction({
      body: 'Status: In progress, implementer still working.',
      labels: ['pmo:closed']
    });
    expect(result.consistent).toBe(false);
    expect(result.contradictions[0]).toMatch(/pmo:closed label conflicts/);
  });

  it('detects Pipeline/Active/Engineering lifecycle language inconsistent with labels', () => {
    const result = detectLifecycleContradiction({
      body: 'Lifecycle stage: Active',
      labels: ['pmo:pipeline', 'pmo:stage:drafted-design']
    });
    expect(result.consistent).toBe(false);
    expect(result.contradictions[0]).toMatch(/inconsistent with labels/);
  });

  it('is consistent when stage language matches labels', () => {
    const result = detectLifecycleContradiction({
      body: 'Lifecycle stage: Graduation Candidate',
      labels: ['pmo:pipeline', 'pmo:stage:graduation-candidate', 'team:pmo']
    });
    expect(result.consistent).toBe(true);
    expect(result.contradictions).toEqual([]);
  });

  it('evaluates dual team ownership as INVALID-QUEUE-STATE', () => {
    const result = evaluateExecutableChildContract({
      body: VALID_BODY,
      labels: ['team:pmo', 'team:engineering', 'pmo:task', 'pmo:active']
    });
    expect(result.status).toBe(CONTRACT_STATUS.INVALID_QUEUE_STATE);
    expect(result.claimable).toBe(false);
  });

  it('evaluates cross-namespace priority as INVALID-QUEUE-STATE', () => {
    const result = evaluateExecutableChildContract({
      body: VALID_BODY,
      labels: ['pmo:task', 'ops:priority:1']
    });
    expect(result.status).toBe(CONTRACT_STATUS.INVALID_QUEUE_STATE);
    expect(result.claimable).toBe(false);
  });

  it('evaluates missing package fields as PACKAGE-INCOMPLETE', () => {
    const result = evaluateExecutableChildContract({
      body: 'Objective: fix the bug',
      labels: ['pmo:task', 'pmo:active']
    });
    expect(result.status).toBe(CONTRACT_STATUS.PACKAGE_INCOMPLETE);
    expect(result.claimable).toBe(false);
  });

  it('evaluates a valid package as PACKAGE-COMPLETE and claimable', () => {
    const result = evaluateExecutableChildContract({
      body: VALID_BODY,
      labels: ['pmo:task', 'pmo:active']
    });
    expect(result.status).toBe(CONTRACT_STATUS.PACKAGE_COMPLETE);
    expect(result.claimable).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('evaluates terminal-state consistency: closed child with stale active narrative', () => {
    const body = `${VALID_BODY}\nStatus: Active, still executing.\n`;
    const result = evaluateExecutableChildContract({
      body,
      labels: ['pmo:task', 'pmo:closed']
    });
    expect(result.status).toBe(CONTRACT_STATUS.LIFECYCLE_CONTRADICTION);
    expect(result.claimable).toBe(false);
  });
});
