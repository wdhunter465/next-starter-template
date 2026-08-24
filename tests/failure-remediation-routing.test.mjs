import { describe, expect, it } from 'vitest';
import {
  FAILURE_CLASSES,
  ROUTING_ACTIONS,
  UNCLASSIFIABLE_ESCALATION_THRESHOLD,
  classifyFailure,
  routeFailure
} from '../scripts/ci/failure-remediation-routing.mjs';

describe('failure-remediation-routing (#3668)', () => {
  it('routes a required-check failure to deterministic remediation', () => {
    const result = routeFailure({
      checkName: 'vitest',
      required: true,
      deterministic: true,
      evidence: 'tests/executable-child-contract.test.mjs: expected PACKAGE-INCOMPLETE, got PACKAGE-COMPLETE'
    });
    expect(result.class).toBe(FAILURE_CLASSES.DETERMINISTIC_REMEDIATION);
    expect(result.action).toBe(ROUTING_ACTIONS.REMEDIATE);
    expect(result.phase).toBe('pre-merge');
    expect(result.evidence).toMatch(/expected PACKAGE-INCOMPLETE/);
    expect(result.retryLimit).toBeNull();
  });

  it('acknowledges an advisory finding on a non-required check without blocking', () => {
    const result = routeFailure({
      checkName: 'style-suggestion-bot',
      required: false,
      advisory: true,
      evidence: 'Consider renaming variable x to something more descriptive'
    });
    expect(result.class).toBe(FAILURE_CLASSES.ADVISORY_DISPOSITION);
    expect(result.action).toBe(ROUTING_ACTIONS.ACKNOWLEDGE);
    expect(result.permittedScope).toBeNull();
  });

  it('fails closed when advisory requiredness is omitted or unknown', () => {
    const result = routeFailure({
      checkName: 'unknown-advisory-bot',
      advisory: true,
      evidence: 'Advisory finding with no authoritative requiredness classification'
    });
    expect(result.class).toBe(FAILURE_CLASSES.SCOPE_AUTHORITY_DEFECT);
    expect(result.action).toBe(ROUTING_ACTIONS.ESCALATE);
  });

  it('accepts permittedScope as an alias for permittedRemediationScope', () => {
    const result = routeFailure({
      checkName: 'vitest',
      required: true,
      deterministic: true,
      permittedScope: 'tests/failure-remediation-routing.test.mjs only'
    });
    expect(result.action).toBe(ROUTING_ACTIONS.REMEDIATE);
    expect(result.permittedScope).toBe('tests/failure-remediation-routing.test.mjs only');
  });

  it('escalates a scope/architecture defect rather than remediating it deterministically', () => {
    const result = routeFailure({
      required: true,
      deterministic: true,
      scopeOrArchitectureQuestion: true,
      evidence: 'Reviewer: this requires a schema redesign beyond the stated Issue scope'
    });
    expect(result.class).toBe(FAILURE_CLASSES.SCOPE_AUTHORITY_DEFECT);
    expect(result.action).toBe(ROUTING_ACTIONS.ESCALATE);
  });

  it('escalates a protected-path failure', () => {
    const result = routeFailure({
      required: true,
      deterministic: true,
      touchesProtectedPath: true,
      evidence: 'gate-diff-scope: change touches .github/workflows/post-merge-closeout.yml'
    });
    expect(result.class).toBe(FAILURE_CLASSES.PROTECTED_BOUNDARY_DEFECT);
    expect(result.action).toBe(ROUTING_ACTIONS.ESCALATE);
  });

  it('routes a deterministic post-merge failure back for remediation, marked post-merge', () => {
    const result = routeFailure({
      postMerge: true,
      deterministic: true,
      required: true,
      evidence: 'post_merge_validator.mjs: closeout evidence missing for #3668'
    });
    expect(result.class).toBe(FAILURE_CLASSES.DETERMINISTIC_REMEDIATION);
    expect(result.action).toBe(ROUTING_ACTIONS.REMEDIATE);
    expect(result.phase).toBe('post-merge');
  });

  it('escalates a Production verification failure', () => {
    const result = routeFailure({
      required: true,
      deterministic: true,
      productionOrLive: true,
      evidence: 'Production smoke test failed against live D1 binding'
    });
    expect(result.class).toBe(FAILURE_CLASSES.PRODUCTION_LIVE_FAILURE);
    expect(result.action).toBe(ROUTING_ACTIONS.ESCALATE);
  });

  it('falls closed to escalation when a failure cannot be classified deterministically', () => {
    const result = classifyFailure({ checkName: 'unknown-external-bot' });
    expect(result.class).toBe(FAILURE_CLASSES.SCOPE_AUTHORITY_DEFECT);
  });

  it('escalates a repeated unclassifiable failure regardless of its nominal class', () => {
    const result = routeFailure({
      deterministic: true,
      required: true,
      repeatedUnclassifiableCount: UNCLASSIFIABLE_ESCALATION_THRESHOLD,
      evidence: 'same flaky failure recurring with no diff between attempts'
    });
    expect(result.action).toBe(ROUTING_ACTIONS.ESCALATE);
    expect(result.reason).toMatch(/repeated unclassifiable failure/);
  });

  it('does not cap deterministic remediation retries', () => {
    const result = routeFailure({
      deterministic: true,
      required: true,
      repeatedUnclassifiableCount: 0,
      evidence: 'still failing after several fix attempts, but each attempt is a distinct deterministic diagnosis'
    });
    expect(result.action).toBe(ROUTING_ACTIONS.REMEDIATE);
    expect(result.retryLimit).toBeNull();
  });
});
