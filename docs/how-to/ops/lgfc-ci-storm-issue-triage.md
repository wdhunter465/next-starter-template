---
Doc Type: How-To
Audience: Bill, ChatGPT/Atlas, Day-2 Operations
Authority Level: Operational Authority
Owns: Controlled CI storm issue triage report/close procedure for LGFC
Does Not Own: General backlog cleanup, merge authority, or root-cause CI defect repair
Canonical Reference: /scripts/ops/lgfc-ci-storm-issue-triage.mjs
Related Issues: #2095, #3215
Last Reviewed: 2026-08-10
---

# LGFC CI storm issue triage

## Purpose

Classify open GitHub issues into review buckets and, **only after human review**, close reviewed CI alert-storm noise candidates with an audit comment.

This is not a general backlog cleaner. Default mode is report-only.

## Safety model

- Default/`--mode=report` never modifies issues.
- Storm classification requires an explicit `--incident-start` / `--incident-end` window.
- Close mode only acts on a reviewed candidate JSON from a prior report run.
- Close mode requires exact phrase `--confirm-close-reviewed=LGFC-CLOSE-CI-STORM-NOISE`.
- Close mode re-fetches every candidate and verifies number, title, createdAt, URL, state, and bucket.
- `PMO_PROCESS` and `NEEDS_REVIEW` are never close-eligible.
- Repository slug is hard-fail closed to live `wdhunter465/next-starter-template` (draft `wdhunter645` rejected).

## Prerequisites

- `gh` authenticated with issue read access (write only for authorized close runs)
- Node 18+ (repo pins Node 22)
- Working directory: repository root

## Report-only (required first use)

```bash
node scripts/ops/lgfc-ci-storm-issue-triage.mjs \
  --mode=report \
  --incident-start=2026-06-25T00:00:00Z \
  --incident-end=2026-06-30T23:59:59Z
```

Outputs (gitignored under `ops-artifacts/`):

- `ops-artifacts/issue-triage/lgfc-open-issue-triage-report.md`
- `ops-artifacts/issue-triage/lgfc-ci-storm-clusters.md`
- `ops-artifacts/issue-triage/lgfc-ci-storm-candidates.json`

## Human review gate

Before any close run:

1. Review both Markdown reports and the candidate JSON.
2. Confirm clusters are CI storm noise, not recurring legitimate defects.
3. Identify or open a root tracking issue for the underlying CI defect.
4. Obtain explicit Bill/Atlas authorization for the close run.

## Close reviewed candidates (authorized only)

```bash
node scripts/ops/lgfc-ci-storm-issue-triage.mjs \
  --mode=close-reviewed-storm \
  --candidate-file=ops-artifacts/issue-triage/lgfc-ci-storm-candidates.json \
  --root-issue=<ROOT_ISSUE_NUMBER> \
  --confirm-close-reviewed=LGFC-CLOSE-CI-STORM-NOISE
```

Do not invent alternate confirmation phrases. Wrong confirmation fails closed.

## Offline self-test

```bash
node scripts/ops/test-lgfc-ci-storm-issue-triage.mjs
```

## Rollback / misuse recovery

- If a candidate was misclassified and closed, reopen it with evidence of the distinct cause.
- Delete or ignore local `ops-artifacts/issue-triage/*` outputs; they are not source of truth.
- Do not broaden the allowed repository slug without a governing Issue.
