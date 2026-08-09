---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2908 (#2859 Task 003) batch-plan schema, approved-batch-class enforcement, and readiness harness
Does Not Own: #2907's evidence reconciliation and sourcing register (owned by that report, only consumed here); actual Production D1/B2 population/writes (separately protected); #2909's QA/handoff
Canonical Reference: /docs/ops/reports/production-content-batch-plan-2908.md
Related Issues: #2908, #2859, #2906, #2907, #2909
Last Reviewed: 2026-08-09
---

# Production content batch-plan schema and readiness harness — #2908

## Purpose

Deliver #2908 (#2859 Task 003) per its non-blocking prerequisite rule: the
batch-plan record schema constrained to #2907's eight accepted batch classes
(Section 6 of `docs/ops/reports/production-content-evidence-reconciliation-2907.md`),
and a deterministic batch-plan readiness harness — so that any future
controlled D1/B2 population batch is planned against a pre-agreed,
machine-checked structure instead of improvising attribution, idempotency,
recovery, or privacy evidence at apply time.

## Scope

Covers batch-plan preparation only: the batch-plan record schema below and
the readiness harness (`scripts/ci/production_content_batch_readiness.mjs`).
It does not cover #2907's evidence reconciliation and sourcing register
(only consumes its Section 6 batch-class list and Section 4.3 protected
decisions), does not perform any live D1/B2 read or write, and does not
cover #2909's Production verification/QA — each is owned by its own task.

## Current known truth

- #2907 is accepted and closed (PR #3219, clean post-merge closeout). Its
  Section 6 names eight approved batch-class *plans*: `faq-public-seed`,
  `milestones-public`, `friends-partners`, `events-public`,
  `matchup-week-pair`, `library-inventory`, `club-home-content`,
  `media-member-gallery`. No batch outside this list is in scope for #2908
  without a new #2907-equivalent reconciliation.
- No real batch-plan record exists yet, and no Production D1/B2 write has
  been performed. This document and its companion harness are **batch
  tooling design and dry-run scaffolding**, per #2908's own non-blocking
  prerequisite rule: "Accepted #2907 decisions govern final content/data
  writes. They do not prevent repository corrections that are already
  authorized, batch tooling design, dry-run preparation, backup/rollback
  planning, tests, package completion, or other collision-safe work."
- `buildBatchReadiness()` is implemented and tested against synthetic
  fixtures (`tests/production-content-batch-readiness.test.mjs`), including
  the unapproved-batch-class rejection and the optional write-authorization
  gate, before any real batch-plan record exists.
- This document does not authorize any Production D1/B2 write, media
  upload, or publication state change. It never performs a live request.

## Intended final state

This document is evolving scaffolding pending real batch execution. Its
stable, post-execution state — once a given batch class is actually
applied under explicit Product Authority authorization — replaces the
template sections below with the real batch-plan record and the
`buildBatchReadiness()` verdict (including `requireWriteAuthorization: true`)
for that record. The schema and the approved-class list are not expected to
change without a new #2907-equivalent reconciliation — only "Current known
truth" above is expected to update per batch.

## Non-blocking prerequisite rule

Per #2908's own non-blocking prerequisite rule, this document and harness
are **batch tooling design, dry-run preparation, backup/rollback planning,
tests, and package completion** — the collision-safe category #2908
explicitly authorizes now that #2907 is accepted. Actual Production D1/B2
writes remain separately protected behind explicit Product Authority
authorization, rights clearance (partner/photo permissions per #2907
Section 4.3), and the other protected stops already recorded on #2908 and
#2907 (missing rights/Product approval, unavailable recovery evidence,
private/secret exposure, destructive data handling, paid dependency, real
collision, unauthorized Production mutation).

## Batch-plan record — required fields

| Field | Purpose |
| --- | --- |
| `batchClass` | Must be one of the eight classes #2907 Section 6 approved for planning |
| `attributionEvidence` | Citation to the source of this batch's content (repository seed, editorial decision, etc.) — "every batch is attributable" |
| `idempotencyKeyStrategy` | How re-running this batch is repeat-safe (no duplicate rows) — "every batch is ... repeatable" |
| `recoveryPlan` | Rollback/backup evidence for this batch — "every batch is ... recoverable" |
| `privacyExclusionEvidence` | Citation confirming no private/PII data is introduced |
| `placeholderExclusionEvidence` | Citation confirming no placeholder or broken reference is introduced |
| `originalMediaPreservationEvidence` | Citation confirming original media is preserved (or explicit "not applicable — no media in this batch") |
| `preCountEvidence` | Baseline row/state count recorded before apply |
| `productionWriteAuthorization` | `not-yet-authorized` or `authorized` — tracked explicitly, never silently assumed |

## Readiness harness

`scripts/ci/production_content_batch_readiness.mjs` validates a batch-plan
record against the schema above and rejects any `batchClass` outside
#2907's approved eight. By default it validates dry-run/planning readiness
only (`ready: true` does **not** mean a live write is authorized); pass
`--require-write-authorization` to additionally gate on
`productionWriteAuthorization === 'authorized'` when validating live-apply
readiness specifically.

```bash
node scripts/ci/production_content_batch_readiness.mjs --record batch-plan.json
node scripts/ci/production_content_batch_readiness.mjs --record batch-plan.json --require-write-authorization
```

## What #2909 inherits from this task

- The batch-plan schema and readiness harness, ready to validate the real
  batch-plan record(s) once a given batch class is actually applied under
  authorization.
- The approved-batch-class constraint, so #2909's QA/handoff walk can
  verify no batch outside #2907's Section 6 list was ever scheduled.

## Validation

- `npx vitest run tests/production-content-batch-readiness.test.mjs` — all tests passing.
- `node scripts/ci/production_content_batch_readiness.mjs --record <sample>` — verified `ready: true` on a fully-compliant record for each of the eight approved batch classes; verified `ready: false` with the correct blocker for a missing field, an unapproved batch class, an invalid `productionWriteAuthorization` value, and (with `--require-write-authorization`) a `not-yet-authorized` record, including with a null record.
