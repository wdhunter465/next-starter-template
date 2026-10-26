---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Repeatable PR gate-clean execution workflow for Cursor and Governance
Does Not Own: Canonical PR-process policy or CI implementation design
Canonical Reference: /docs/governance/PR_PROCESS.md
Supporting References:
  - /docs/reference/ci/pr-process-current-state.md
  - /docs/reference/ci/pr-process-skeleton-validation.md
  - /docs/reference/ci/merge-protection-surface.md
  - /.agents/skills/lgfc-pr-governance/SKILL.md
Related issues: #2175, #2208
Last Reviewed: 2026-10-26
---

# PR Gate Success Workflow

This how-to describes how to move a PR to a clean, merge-safe state under the **stable-facts PR body** model defined in `/docs/governance/PR_PROCESS.md`.

During the #2175 / #2208 rebuild, many PR-process gates are in safe-mode. This workflow separates **what must always be true** from **what is temporarily paused or advisory**.

## What changed from legacy practice

Do **not** use the PR body as a lifecycle database. The following legacy patterns are retired:

- PR-body reviewer comment ID ledgers (`review-comment:<id>`)
- review-thread state text stored in the PR body
- `READY FOR MERGE` status fields in the PR body
- generated auto-repair lifecycle blocks
- treating the PR issue-accounting bot comment as the source of truth

Reviewer lifecycle state lives in **GitHub reviews and review threads**. Merge readiness lives in **required checks, labels, and operator decision**.

## Procedure

### 1. Confirm source issue

- Exactly one same-repository, open, non-PR source issue.
- PR body includes: `- **Issue:** #NNN` near the top.
- During safe-mode, `GATE — PR Issue Accounting` is manual-only; do not wait for an accounting bot comment.

### 2. Build the PR body as stable facts only

Use `.github/pull_request_template.md`. Include:

- source issue, intent label, PR class;
- allowed paths and out-of-scope declaration;
- change summary, verification, acceptance criteria;
- follow-up issue declaration;
- reviewer/bot review attestation checkboxes.

Do **not** paste check status, comment IDs, thread state, or merge-readiness ledgers into the body.

### 3. Match the allowlist to the final diff

- Every changed file must appear under `Allowed paths:`.
- No file outside the list may remain in the diff.
- Update the body when the diff changes.

During safe-mode, `GATE — Diff Scope` is manual-only; local allowlist discipline still applies.

### 4. Run local checks before relying on remote gates

Record exact commands and PASS / FAIL / NOT RUN in the PR body verification section.

Minimum classes when applicable:

```bash
npm run typecheck
npm test -- <targeted-test-files>
npm run build   # when code/runtime touched and not deferred by class
git diff --check
```

### 5. Inspect remote checks on the latest head

Inspect the **live PR check panel** on the current head SHA.

During safe-mode, expect:

- marker PR-process workflows to pass quickly;
- `gitleaks` and other safety checks to run for real;
- Intent Labeler, Diff Scope, and PR Issue Accounting **not** to auto-run.

Treat `GATE — Post-Merge Readiness` and other legacy overlap gates as **non-authoritative** unless branch protection lists them as required.

### 6. Handle reviewer findings in GitHub-native state

- Read human review threads and bot/advisory findings.
- Fix actionable items or record rationale in the review thread / review comment.
- Check the attestation boxes when you have read human and bot findings.
- Do **not** mirror thread state into the PR body unless summarizing stable implementation facts.

### 7. Re-run or re-evaluate after fixes

After every fix push or material PR body update, re-check the latest head workflow runs and review threads.

### 8. Mark ready only when clean

A PR is ready for human review when:

- stable-facts body matches the final diff;
- local verification recorded;
- latest head required checks are green (per `/docs/reference/ci/merge-protection-surface.md`);
- actionable review threads are addressed in GitHub review state;
- no undocumented scope expansion.

Merge authorization remains human/operator only.

## Safe-mode validation probes

When changing PR-process CI, open a small probe PR and record results per `/docs/reference/ci/pr-process-skeleton-validation.md`. Post summary evidence to #2208.

## Stop conditions

Stop and report instead of claiming readiness when:

- source issue state cannot be verified;
- allowlist does not match the diff;
- latest head workflow state cannot be verified;
- a **required** gate is failing on the latest head;
- actionable reviewer findings remain unaddressed in GitHub review state;
- PR-process repair would reintroduce PR-body mutation or auto-repair loops.

## Historical note

Older versions of this how-to documented PR #1200 patterns that required PR-body reviewer ledgers and issue-accounting bot comments. Those patterns are archived as historical evidence only. See `/docs/archive/pr-process/README.md`.
