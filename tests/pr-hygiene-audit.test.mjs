import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildPrHygieneArtifact,
  buildPrHygieneReport,
  extractMarkdownSection,
  findIssueReferences,
  hardHygieneFailures,
  hasRequiredIssueLine,
  hasVerificationEvidence,
  parseAllowedFiles,
  parseIntentLabel,
  parsePrClass,
  renderPrHygieneReport,
  runCli,
  suggestCanonicalIssueLine,
  writePrHygieneArtifacts,
} from '../scripts/ci/pr_hygiene_audit.mjs';

const stableBody = `# PR Summary

- **Issue:** #2178
- Intent label: intent:ci
- PR class: ci

## Scope

Allowed paths:
- \`scripts/ci/pr_hygiene_audit.mjs\`
- \`tests/**\`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

This PR rewrites PR hygiene so it validates only stable PR-body facts.

## Verification

Local verification:
- Command: \`npm test -- tests/pr-hygiene-audit.test.mjs\`
  Result: PASS

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: none

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [ ] I have read all human review threads on this PR
- [ ] I have read all bot/advisory findings on this PR
`;

const legacyBody = `- **Issue:** #1131

## MANDATORY FIRST STEP (ZIP SAFETY)
- [x] No ZIP file exists in the repo root.

## FILE-TOUCH ALLOWLIST (MANDATORY)
Allowed files:
- scripts/ci/**
- tests/**

All other files are out of scope
`;

describe('PR hygiene audit foundation', () => {
  it('detects canonical source issue syntax', () => {
    expect(hasRequiredIssueLine('- **Issue:** #1131')).toBe(true);
    expect(hasRequiredIssueLine('Closes #1131')).toBe(false);
  });

  it('extracts issue references and suggests a canonical issue line', () => {
    expect(findIssueReferences('Closes #1131')).toEqual([1131]);
    expect(suggestCanonicalIssueLine('Closes #1131')).toBe('- **Issue:** #1131');
    expect(suggestCanonicalIssueLine('Refs #1131 and #1075')).toBe('');
  });

  it('extracts markdown sections case-insensitively', () => {
    expect(extractMarkdownSection(stableBody, 'change summary')).toContain('validates only stable PR-body facts');
    expect(extractMarkdownSection(stableBody, 'REVIEWER / BOT REVIEW ATTESTATION')).toContain('human review threads');
  });

  it('parses allowed paths from the stable PR body', () => {
    expect(parseAllowedFiles(stableBody)).toEqual(['scripts/ci/pr_hygiene_audit.mjs', 'tests/**']);
  });

  it('keeps backward-compatible parsing for legacy Allowed files anchors', () => {
    expect(parseAllowedFiles(legacyBody)).toEqual(['scripts/ci/**', 'tests/**']);
  });

  it('parses stable intent label and PR class', () => {
    expect(parseIntentLabel(stableBody)).toBe('intent:ci');
    expect(parsePrClass(stableBody)).toBe('ci');
  });

  it('reports clean PR hygiene when stable body fields and allowlist are present', () => {
    const report = buildPrHygieneReport({
      body: stableBody,
      changedFiles: ['scripts/ci/pr_hygiene_audit.mjs', 'tests/pr-hygiene-audit.test.mjs'],
    });

    expect(report.isClean).toBe(true);
    expect(report.unlistedChangedFiles).toEqual([]);
    expect(report.missingSections).toEqual([]);
    expect(report.hasRequiredPrClass).toBe(true);
    expect(report.hasRequiredIntentLabel).toBe(true);
  });

  it('rejects template Result placeholder as verification evidence (#2196)', () => {
    const placeholderBody = stableBody.replace('Result: PASS', 'Result: PASS / FAIL / NOT RUN');
    expect(hasVerificationEvidence(placeholderBody)).toBe(false);
    expect(hasVerificationEvidence(stableBody.replace('Result: PASS', 'Result: FAIL'))).toBe(false);
    expect(hasVerificationEvidence(stableBody)).toBe(true);
  });

  it('does not require retired lifecycle-database sections', () => {
    const report = buildPrHygieneReport({
      body: stableBody,
      changedFiles: ['scripts/ci/pr_hygiene_audit.mjs'],
    });

    expect(report.missingSections).not.toContain('MANDATORY FIRST STEP (ZIP SAFETY)');
    expect(report.missingSections).not.toContain('REVIEWER RESPONSE ACCOUNTING');
    expect(report.missingSections).not.toContain('REQUIRED PRE-REVIEW SELF-CHECK');
  });

  it('reports missing stable fields and unlisted changed files', () => {
    const report = buildPrHygieneReport({
      body: 'Closes #1131\n\n## Scope\nAllowed paths:\n- docs/**',
      changedFiles: ['scripts/ci/pr_hygiene_audit.mjs'],
    });

    expect(report.isClean).toBe(false);
    expect(report.hasRequiredIssueLine).toBe(false);
    expect(report.suggestedIssueLine).toBe('- **Issue:** #1131');
    expect(report.missingSections).toContain('PR Summary');
    expect(report.missingSections).toContain('Change Summary');
    expect(report.unlistedChangedFiles).toEqual(['scripts/ci/pr_hygiene_audit.mjs']);
  });

  it('renders actionable stable-body remediation text', () => {
    const report = buildPrHygieneReport({
      body: 'Closes #1131',
      changedFiles: ['scripts/ci/pr_hygiene_audit.mjs'],
    });

    const rendered = renderPrHygieneReport(report);
    expect(rendered).toContain('Missing canonical source issue line');
    expect(rendered).toContain('Suggested correction');
    expect(rendered).toContain('Missing stable `Intent label:`');
    expect(rendered).toContain('Changed files not covered');
  });

  it('writes machine-readable PR hygiene artifacts', () => {
    const report = buildPrHygieneReport({
      body: stableBody,
      changedFiles: ['scripts/ci/pr_hygiene_audit.mjs'],
    });
    const artifact = buildPrHygieneArtifact(report);

    expect(artifact.gate).toBe('pr-hygiene');
    expect(artifact.schemaVersion).toBe(2);
    expect(artifact.advisory).toBe(true);
    expect(artifact.isClean).toBe(true);
    expect(artifact.hardFailures).toEqual([]);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-hygiene-'));
    const jsonPath = path.join(tempDir, 'result.json');
    const mdPath = path.join(tempDir, 'result.md');

    writePrHygieneArtifacts(report, {
      PR_HYGIENE_RESULT_JSON: jsonPath,
      PR_HYGIENE_RESULT_MD: mdPath,
    });

    expect(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).isClean).toBe(true);
    expect(fs.readFileSync(mdPath, 'utf8')).toContain('No PR hygiene defects detected.');
  });

  it('returns advisory exit code zero when enforcement is disabled', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-hygiene-cli-'));
    const bodyPath = path.join(tempDir, 'body.md');
    const changedPath = path.join(tempDir, 'changed.txt');

    // Soft defects only: allowlist present so hard codes do not fire.
    fs.writeFileSync(bodyPath, [
      '- **Issue:** #1131',
      '',
      '## Scope',
      'Allowed paths:',
      '- scripts/ci/pr_hygiene_audit.mjs',
      '',
      '## Acceptance Criteria',
      '- [x] done',
    ].join('\n'));
    fs.writeFileSync(changedPath, 'scripts/ci/pr_hygiene_audit.mjs\n');

    expect(runCli({
      PR_HYGIENE_BODY_FILE: bodyPath,
      PR_HYGIENE_CHANGED_FILES_FILE: changedPath,
      PR_HYGIENE_ENFORCE_FAILURE: 'false',
    })).toBe(0);

    expect(runCli({
      PR_HYGIENE_BODY_FILE: bodyPath,
      PR_HYGIENE_CHANGED_FILES_FILE: changedPath,
      PR_HYGIENE_ENFORCE_FAILURE: 'true',
    })).toBe(1);
  });

  it('fail-closes hard hygiene codes even when soft enforcement is disabled', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-hygiene-hard-'));
    const bodyPath = path.join(tempDir, 'body.md');
    const changedPath = path.join(tempDir, 'changed.txt');

    fs.writeFileSync(bodyPath, [
      '- **Issue:** #2683',
      '',
      '## Scope',
      'Allowed paths:',
      '- scripts/ci/pr_hygiene_audit.mjs',
      '',
      '## Acceptance Criteria',
      '- [ ] unchecked item',
      '',
      'TODO: finish later',
    ].join('\n'));
    fs.writeFileSync(changedPath, 'scripts/ci/other.mjs\n');

    const failures = hardHygieneFailures({
      body: fs.readFileSync(bodyPath, 'utf8'),
      changedFiles: ['scripts/ci/other.mjs'],
    });
    expect(failures.map((failure) => failure.code)).toEqual(expect.arrayContaining([
      'allowlist_violation',
      'unchecked_acceptance_criterion',
      'forbidden_placeholder_token',
    ]));

    expect(runCli({
      PR_HYGIENE_BODY_FILE: bodyPath,
      PR_HYGIENE_CHANGED_FILES_FILE: changedPath,
      PR_HYGIENE_ENFORCE_FAILURE: 'false',
    })).toBe(1);
  });

  it('fail-closes missing allowlist before merge', () => {
    expect(hardHygieneFailures({
      body: '## Acceptance Criteria\n- [x] ok',
      changedFiles: ['scripts/ci/pr_hygiene_audit.mjs'],
    })).toContainEqual(expect.objectContaining({ code: 'missing_allowlist' }));
  });
});
