---
Doc Type: Reference
Audience: Bill, ChatGPT, Cursor, Codex, LGFC maintainers, and CI/governance implementers
Authority Level: Controlled
Owns: Draft governance launch-control automation concepts, pseudocode contracts, future file-path map, test strategy, acceptance criteria, and edge-case register for optional post-package implementation
Does Not Own: Shipped CI scripts, workflow YAML, tests, branch protection settings, or executable enforcement logic
Canonical Reference: /docs/archive/GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md
Related Issues: #1755, #1500, #1544, #1545, #1546, #1547, #1548
Last Reviewed: 2026-06-17
---

# Governance Launch-Control Reference Implementation

> **This document is draft/reference only.** Issue #1755 and its documentation PR do **not** implement any code, workflow, script, or test described here. Do not treat pseudocode below as repository behavior.

## Purpose

Provide a reviewable reference implementation package for optional future automation that validates governance launch-control readiness before Cursor or Codex begin Program #1500 Tasks 002–005 (or similar governance programs).

## Scope

This reference owns proposed validator contracts, pseudocode, future path map, test strategy, acceptance criteria, and edge cases.

This reference does not own live enforcement, merge gates, issue mutation, or branch protection configuration.

## Current known truth

- Task 001 pre-merge readiness enforcement already ships in `scripts/ci/post_merge_readiness_gate.mjs` (merged via PR #1552).
- No `governance_*` validator scripts exist on `main` at the time of this document.
- Launch-control packaging is documentation-only under issue #1755.

## Intended final state

If Bill/ChatGPT authorize a future implementation issue, repository-owned validators may:

1. Verify launch-control documentation package completeness before queue advance.
2. Verify child issue bodies contain required governance fields.
3. Verify Cursor pre-implementation checkpoint comments before protected-surface work.
4. Verify Bill/ChatGPT authorization markers on issues.
5. Reuse or extend PR body readiness checks without duplicating `post_merge_validator.mjs` rules.

Until that authorization exists, this document remains non-executable reference material.

---

## Draft reference implementation package

The proposed package contains five logical validators and one orchestrator:

| Component | Role |
| --- | --- |
| Launch-control package validator | Confirms required launch-control docs exist and contain mandatory sections |
| Issue package validator | Confirms a child issue body matches queue/task contract |
| Cursor review checkpoint validator | Confirms checkpoint comment format on authorized issue |
| Stop-gate authorization validator | Confirms Bill/ChatGPT authorization signals before implementation |
| PR body readiness validator | Confirms PR body closeout contract (may delegate to existing gate exports) |
| Launch-control orchestrator (optional) | Runs validators in sequence for local preflight or CI advisory |

**Execution modes (proposed, not implemented)**

| Mode | When | Blocking |
| --- | --- | --- |
| Local advisory | Agent preflight before PR open | No — reports only |
| CI advisory workflow | Docs or governance PRs | No — unless later reclassified |
| Pre-queue gate | Before Bill marks child issue `status:queued` | Operator policy only |

---

## Proposed automation concepts only

The following concepts are **design proposals**. None are implemented by issue #1755.

### Concept A — Package completeness scoring

A validator reads `docs/archive/GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md` and checks for required H2 sections (Purpose through Closeout checklist). Missing sections produce deterministic failure codes.

### Concept B — Issue-body structural validation

A validator fetches or reads a child issue body and verifies presence of: parent program link, queue position, dependency table, allowlist, acceptance criteria, verification commands, and serial-stop instruction.

### Concept C — Checkpoint comment parsing

A validator scans issue comments for the `## Cursor pre-implementation checkpoint` heading and required bullet keys. Partial checkpoints fail with explicit missing-field reporting.

### Concept D — Authorization marker detection

A validator looks for Bill/ChatGPT assignment phrases in issue comments or labels (for example explicit assignment on `#1545`). Agents cannot self-authorize.

### Concept E — PR readiness delegation

Rather than fork validation rules, the PR body readiness validator imports `metadataFailures`, `blockingMetadataFailures`, and `reviewerDispositionFailures` from `scripts/ci/post_merge_validator.mjs` — the same pattern used by `post_merge_readiness_gate.mjs` after Task 001.

### Concept F — Trusted-code execution

Any future CI workflow running these validators on `pull_request_target` must checkout trusted base-ref scripts only, matching the model documented in `docs/reference/ci/post-merge-validation-surface.md`.

---

## Pseudocode and draft code blocks

### 1. Launch-control package validation

```javascript
// DRAFT / FUTURE — NOT IMPLEMENTED
// Proposed path: scripts/ci/governance_launch_control_package_validator.mjs

const REQUIRED_PACKAGE_SECTIONS = [
  'Purpose',
  'Relationship to closed PR #1552 and Issue #1544',
  'Launch-control-ready definition',
  'Governance program-prep workflow',
  'Master issue structure',
  'Child issue structure',
  'Cursor pre-implementation review/comment checkpoint',
  'Bill/ChatGPT authorization gates',
  'Continuous execution stop points',
  'Verification plan',
  'Rollback plan',
  'Non-goals',
  'Risk register',
  'Closeout checklist',
];

const PACKAGE_PATH =
  'docs/archive/GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md';

export function validateLaunchControlPackage({ repoRoot, packagePath = PACKAGE_PATH }) {
  const text = readUtf8(join(repoRoot, packagePath));
  const failures = [];

  assertDocsHeader(text, packagePath, failures);

  for (const section of REQUIRED_PACKAGE_SECTIONS) {
    if (!text.includes(`## ${section}`)) {
      failures.push({
        code: 'LAUNCH_PACKAGE_MISSING_SECTION',
        section,
        path: packagePath,
      });
    }
  }

  if (!text.includes('PR #1552')) {
    failures.push({ code: 'LAUNCH_PACKAGE_MISSING_PR1552_REFERENCE' });
  }
  if (!text.includes('not active work') && !text.includes('not active')) {
    failures.push({ code: 'LAUNCH_PACKAGE_MISSING_INACTIVE_PR1552_ASSERTION' });
  }

  return { ok: failures.length === 0, failures };
}
```

### 2. Issue package validation

```javascript
// DRAFT / FUTURE — NOT IMPLEMENTED
// Proposed path: scripts/ci/governance_issue_package_validator.mjs

const REQUIRED_ISSUE_MARKERS = [
  /Parent program.*#1500/i,
  /Queue position/i,
  /Exact file allowlist/i,
  /Acceptance criteria/i,
  /Verification commands/i,
  /Serial execution instruction/i,
  /Out of scope/i,
];

const REQUIRED_DEPENDENCY_FIELDS = [
  'Predecessor',
  'Successor',
];

export function validateIssuePackage({ issueBody, issueNumber, expectedTaskId }) {
  const failures = [];

  if (!issueBody || typeof issueBody !== 'string') {
    return { ok: false, failures: [{ code: 'ISSUE_BODY_MISSING' }] };
  }

  for (const pattern of REQUIRED_ISSUE_MARKERS) {
    if (!pattern.test(issueBody)) {
      failures.push({ code: 'ISSUE_BODY_MISSING_MARKER', pattern: String(pattern) });
    }
  }

  for (const field of REQUIRED_DEPENDENCY_FIELDS) {
    if (!issueBody.includes(field)) {
      failures.push({ code: 'ISSUE_BODY_MISSING_DEPENDENCY_FIELD', field });
    }
  }

  if (expectedTaskId && !issueBody.includes(expectedTaskId)) {
    failures.push({ code: 'ISSUE_BODY_TASK_ID_MISMATCH', expectedTaskId });
  }

  const allowlist = extractAllowlistBullets(issueBody);
  if (allowlist.length === 0) {
    failures.push({ code: 'ISSUE_BODY_EMPTY_ALLOWLIST' });
  }

  return { ok: failures.length === 0, failures, allowlist, issueNumber };
}
```

### 3. Cursor review checkpoint validation

```javascript
// DRAFT / FUTURE — NOT IMPLEMENTED
// Proposed path: scripts/ci/governance_cursor_review_checkpoint_validator.mjs

const CHECKPOINT_HEADING = '## Cursor pre-implementation checkpoint';
const REQUIRED_CHECKPOINT_KEYS = [
  'Package read:',
  'Reference implementation read:',
  'Queue task section read:',
  'Proposed allowlist matches issue body:',
  'Stop gates acknowledged:',
  'Verification commands identified:',
  'Blockers before implementation:',
  'Recommendation:',
];

export function validateCursorReviewCheckpoint({ issueComments }) {
  const failures = [];
  const checkpointComments = (issueComments ?? []).filter((c) =>
    String(c.body ?? '').includes(CHECKPOINT_HEADING),
  );

  if (checkpointComments.length === 0) {
    return { ok: false, failures: [{ code: 'CHECKPOINT_MISSING' }] };
  }

  const latest = checkpointComments[checkpointComments.length - 1];
  const body = String(latest.body ?? '');

  for (const key of REQUIRED_CHECKPOINT_KEYS) {
    if (!body.includes(key)) {
      failures.push({ code: 'CHECKPOINT_MISSING_KEY', key });
    }
  }

  const recommendation = body.match(/Recommendation:\s*(PROCEED|HALT)/i);
  if (!recommendation) {
    failures.push({ code: 'CHECKPOINT_INVALID_RECOMMENDATION' });
  } else if (recommendation[1].toUpperCase() === 'HALT') {
    failures.push({ code: 'CHECKPOINT_HALT', advisory: true });
  }

  return {
    ok: failures.filter((f) => !f.advisory).length === 0,
    failures,
    commentId: latest.id,
    recommendation: recommendation?.[1]?.toUpperCase() ?? null,
  };
}
```

### 4. Stop-gate authorization validation

```javascript
// DRAFT / FUTURE — NOT IMPLEMENTED
// Proposed path: scripts/ci/governance_stop_gate_authorization_validator.mjs

// Matched against comment.author.login (a GitHub username) below, so every
// entry must be a real GitHub login -- not a display name or agent label.
const AUTHORIZED_ACTORS = ['wdhunter465']; // configurable allowlist, GitHub logins only

const ASSIGNMENT_PATTERNS = [
  /assign(?:ed|ment)?\s+(?:to\s+)?(?:Cursor|Codex)/i,
  /explicit(?:ly)?\s+assign/i,
  /authorized?\s+for\s+implementation/i,
  /G3\s+.*pass/i,
];

export function validateStopGateAuthorization({
  issueComments,
  issueLabels = [],
  predecessorMerged = false,
  predecessorCloseoutVerified = false,
}) {
  const failures = [];

  if (!predecessorMerged) {
    failures.push({ code: 'STOP_PREDECESSOR_NOT_MERGED', blocking: true });
  }
  if (!predecessorCloseoutVerified) {
    failures.push({ code: 'STOP_PREDECESSOR_CLOSEOUT_UNVERIFIED', blocking: true });
  }

  const hasAssignment = (issueComments ?? []).some((comment) => {
    const author = comment.author?.login ?? '';
    const body = String(comment.body ?? '');
    const actorTrusted = AUTHORIZED_ACTORS.some((a) => author.includes(a));
    const matchesPattern = ASSIGNMENT_PATTERNS.some((p) => p.test(body));
    return actorTrusted && matchesPattern;
  });

  if (!hasAssignment) {
    failures.push({ code: 'STOP_MISSING_BILL_ATLAS_ASSIGNMENT', blocking: true });
  }

  if (issueLabels.includes('status:blocked')) {
    failures.push({ code: 'STOP_ISSUE_BLOCKED_LABEL', blocking: true });
  }

  return {
    ok: failures.filter((f) => f.blocking).length === 0,
    failures,
  };
}
```

### 5. PR body readiness validation

```javascript
// DRAFT / FUTURE — NOT IMPLEMENTED
// Proposed path: scripts/ci/governance_pr_body_readiness_validator.mjs
// NOTE: Prefer importing shared exports from post_merge_validator.mjs
// rather than duplicating rules (Task 001 pattern).

import {
  metadataFailures,
  blockingMetadataFailures,
  reviewerDispositionFailures,
} from './post_merge_validator.mjs'; // EXISTING — merged on main

export function validatePrBodyReadiness({
  prBody,
  changedFiles,
  issueComments,
  reviewComments,
  reviews,
}) {
  const failures = [];

  const meta = metadataFailures({ body: prBody, changedFiles });
  const blocking = blockingMetadataFailures(meta);
  const reviewer = reviewerDispositionFailures({
    body: prBody,
    issueComments,
    reviewComments,
    reviews,
  });

  failures.push(...blocking, ...reviewer);

  if (!/- \*\*Issue:\*\* #\d+/.test(prBody)) {
    failures.push({ code: 'PR_BODY_MISSING_SOURCE_ISSUE_LINE' });
  }

  if (!prBody.includes('No ZIP file exists in the repo root')) {
    failures.push({ code: 'PR_BODY_MISSING_ZIP_SAFETY' });
  }

  const allowlist = extractAllowlistFromPrBody(prBody);
  const drift = symmetricDiff(allowlist, changedFiles);
  if (drift.length > 0) {
    failures.push({ code: 'PR_BODY_ALLOWLIST_DRIFT', drift });
  }

  return { ok: failures.length === 0, failures };
}
```

### Optional orchestrator (draft)

```javascript
// DRAFT / FUTURE — NOT IMPLEMENTED
// Proposed path: scripts/ci/governance_launch_control_orchestrator.mjs

export async function runLaunchControlPreflight(input) {
  const results = [
    validateLaunchControlPackage(input),
    validateIssuePackage(input),
    validateCursorReviewCheckpoint(input),
    validateStopGateAuthorization(input),
    validatePrBodyReadiness(input),
  ];

  const failures = results.flatMap((r) => r.failures ?? []);
  return {
    ok: failures.filter((f) => f.blocking !== false).length === 0,
    results,
    failures,
  };
}
```

---

## Expected file paths for future implementation

All paths below are **draft/future** unless a separate authorized implementation issue merges them.

| Path | Status | Purpose |
| --- | --- | --- |
| `scripts/ci/governance_launch_control_package_validator.mjs` | **DRAFT / FUTURE** | Package section completeness |
| `scripts/ci/governance_issue_package_validator.mjs` | **DRAFT / FUTURE** | Child issue body contract |
| `scripts/ci/governance_cursor_review_checkpoint_validator.mjs` | **DRAFT / FUTURE** | Checkpoint comment parser |
| `scripts/ci/governance_stop_gate_authorization_validator.mjs` | **DRAFT / FUTURE** | Bill/ChatGPT authorization detection |
| `scripts/ci/governance_pr_body_readiness_validator.mjs` | **DRAFT / FUTURE** | PR body readiness wrapper |
| `scripts/ci/governance_launch_control_orchestrator.mjs` | **DRAFT / FUTURE** | Sequenced preflight runner |
| `tests/governance-launch-control-validators.test.mjs` | **DRAFT / FUTURE** | Unit tests for validators |
| `.github/workflows/gate-governance-launch-control.yml` | **DRAFT / FUTURE** | Optional CI advisory workflow |
| `docs/reference/governance/governance-launch-control-reference-implementation.md` | **ACTIVE (this doc)** | Reference only — not executable |

**Reuse — already on `main` (do not reimplement)**

| Path | Status |
| --- | --- |
| `scripts/ci/post_merge_readiness_gate.mjs` | Shipped (Task 001 / PR #1552) |
| `scripts/ci/post_merge_validator.mjs` | Shipped — shared export source |

---

## Test strategy for future implementation

### Unit tests

| Area | Cases |
| --- | --- |
| Package validator | Missing section; missing PR #1552 reference; valid package fixture |
| Issue package validator | Empty allowlist; missing dependency field; valid #1545-shaped fixture |
| Checkpoint validator | No comment; partial keys; `PROCEED` vs `HALT` recommendation |
| Authorization validator | Missing assignment; predecessor not merged; blocked label present |
| PR body validator | Missing issue line; allowlist drift; undispositioned reviewer finding |
| Orchestrator | Aggregates failures; blocking vs advisory separation |

### Fixture layout (proposed)

```text
tests/fixtures/governance-launch-control/
  package-valid/
  package-missing-section/
  issue-1545-valid/
  issue-missing-allowlist/
  checkpoint-proceed/
  checkpoint-halt/
  authorization-missing/
  pr-body-compliant/
  pr-body-allowlist-drift/
```

### Integration tests (optional future)

- Run orchestrator against frozen GitHub API payload fixtures (no live network in CI).
- Confirm `pull_request_target` workflow checks out base-ref scripts only.

### Regression guard

- Any future PR body validator must import shared exports from `post_merge_validator.mjs`.
- Test that duplicated rule strings do not appear in new validator files (lint or snapshot check).

---

## Acceptance criteria for future implementation

A future authorized implementation issue may be closed when:

- [ ] All five validator modules exist at draft paths or approved renamed paths.
- [ ] Unit tests cover pass and fail paths for each validator.
- [ ] No duplicate PR body validation logic outside shared `post_merge_validator.mjs` exports.
- [ ] Orchestrator returns deterministic failure codes documented in this reference.
- [ ] CI workflow (if authorized) uses trusted base-ref execution model.
- [ ] `docs/archive/GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md` updated only if contracts change.
- [ ] Merge-protection and post-merge surfaces updated only when a new gate becomes blocking (operator action documented).
- [ ] Issue #1755 reference implementation section cross-linked from implementation PR.

---

## Edge cases

| ID | Edge case | Expected behavior |
| --- | --- | --- |
| E1 | PR #1552 referenced as active branch | Package validator should fail advisory review; agents must treat as historical |
| E2 | Child issue body updated after Cursor checkpoint | Require new checkpoint before implementation |
| E3 | Assignment comment from non-trusted actor | Authorization validator fails |
| E4 | `PROCEED` checkpoint but `HALT` blockers listed | Treat as `HALT`; conflicting checkpoint fails |
| E5 | Issue allowlist uses globs | Issue package validator fails — exact paths only |
| E6 | Multiple checkpoint comments | Use latest comment only |
| E7 | Predecessor merged but closeout failed | Authorization validator blocks queue advance |
| E8 | PR body uses non-canonical issue line format | PR body validator fails unless gate explicitly allows format |
| E9 | Changed files include docs outside allowlist | Allowlist drift failure |
| E10 | Future validator run on PR head untrusted code | Workflow must use base-ref checkout only |
| E11 | Program umbrella issue used as task authority | Issue package validator should fail — child task issue required |
| E12 | Empty or markdown-only allowlist in issue | Fail with `ISSUE_BODY_EMPTY_ALLOWLIST` |

---

## Explicit non-implementation notice

**This PR (issue #1755) does not implement the code in this document.**

- No files under `scripts/ci/governance_*` are created or modified by #1755.
- No workflows, tests, or package config changes are included.
- Pseudocode is for Cursor pre-implementation review and future issue scoping only.
- Shipped behavior for PR body readiness remains `post_merge_readiness_gate.mjs` from Task 001.

Do not merge pseudocode from this reference into `main` without a separate source issue, exact file allowlist, and Bill/ChatGPT authorization.

---

## Final

This reference implementation package completes the documentation half of governance launch-control preparation. Implementation is a separate, explicitly authorized phase.
