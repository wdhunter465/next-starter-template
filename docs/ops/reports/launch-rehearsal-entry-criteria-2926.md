---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2926 (#2781 Task 001) entry-criteria reconciliation schema, candidate/environment/test-data identity requirements, and readiness harness
Does Not Own: #2780's monitoring acceptance itself (only consumed as a governing predecessor); the journey catalog (#2927); formal rehearsal execution (#2928); final disposition (#2929)
Canonical Reference: /docs/ops/reports/launch-rehearsal-entry-criteria-2926.md
Related Issues: #2926, #2781, #2780, #2927, #2928, #2929
Last Reviewed: 2026-08-09
---

# Launch rehearsal entry-criteria reconciliation — #2926

## Purpose

Deliver #2926 (#2781 Task 001): the entry-criteria schema, exact candidate/
environment/test-data identity requirements, and a deterministic
reconciliation-readiness harness — so that #2928's formal rehearsal execution
starts from a pre-agreed, machine-checked entry state instead of discovering
missing prerequisites mid-rehearsal.

## Scope

Covers entry-criteria reconciliation only: the entry-criteria record schema
below and the readiness harness
(`scripts/ci/launch_rehearsal_entry_criteria.mjs`). It does not cover #2780's
monitoring acceptance itself (only consumes it as a governing predecessor for
final rehearsal dependencies), #2927's journey catalog, #2928's actual
rehearsal execution, or #2929's final disposition — each is owned by its own
task.

## Current known truth

- #2780's monitoring project has not yet been accepted, and no formal
  rehearsal has been executed. This document and its companion harness are
  **entry-criteria reconciliation and automation scaffolding**, per #2926's
  own non-blocking prerequisite rule: "#2780 acceptance governs final
  monitoring dependencies. It does not prevent evidence inventory,
  environment/test-data planning, journey preparation, cleanup design, test
  harness preparation, or package completion."
- `buildEntryReadiness()` is implemented and tested against synthetic
  fixtures (`tests/launch-rehearsal-entry-criteria.test.mjs`), including the
  satisfied-vs-deferred disposition requirement, before any real entry-
  criteria record exists.
- This document does not authorize any Production mutation, failure
  injection, or use of Production data as test data. It never performs a
  live request.

## Intended final state

This document is evolving scaffolding pending #2780's acceptance and the
real candidate/environment/test-data reconciliation. Its stable,
post-reconciliation state — once #2926 is actually executed — replaces the
template sections below with the real entry-criteria record (candidate SHA,
isolated environment identity, synthetic/redacted test-data plan, named
roles, cleanup plan, and the `buildEntryReadiness()` verdict for that
record). The schema and invariants themselves are not expected to change —
only "Current known truth" above is expected to update.

## Non-blocking prerequisite rule

Per #2926's own non-blocking prerequisite rule, this document and harness are
**evidence inventory, environment/test-data planning, journey preparation,
cleanup design, test harness preparation, and package completion** — the
collision-safe category #2926 explicitly authorizes before #2780's
monitoring acceptance. Missing predecessor evidence stops only the dependent
formal rehearsal or candidate qualification action (#2928), not this
reconciliation planning.

## Entry-criteria record — required fields

| Field | Purpose |
| --- | --- |
| `candidateIdentity` | The exact candidate build/SHA the rehearsal targets |
| `environmentIdentity` | The isolated (non-Production) environment identity |
| `testDataPlan` | Synthetic/redacted test-data plan — private Production data is never disposable test data |
| `executorRole` | Who performs rehearsal actions (a role, not necessarily a name) |
| `verifierRole` | Who independently confirms rehearsal results |
| `recoveryOwner` | Named accountable owner for rehearsal recovery/rollback |
| `cleanupPlan` | How rehearsal-created state is cleaned up afterward |
| `productionDataExclusionEvidence` | Citation confirming no private Production data was or will be used as test data |
| `entryCriteria` | Array of individual entry criteria (see below) — every criterion must be `satisfied` (with `evidence`) or `deferred` (with `owner` and `releaseCondition`) |

## Readiness harness

`scripts/ci/launch_rehearsal_entry_criteria.mjs` validates an entry-criteria
record against the schema above. Its key invariant, mechanically enforcing
#2926's acceptance criterion "every entry criterion is satisfied or
explicitly identified with an accountable owner and release condition": each
`entryCriteria` item must declare `status: 'satisfied'` with `evidence`, or
`status: 'deferred'` with both `owner` and `releaseCondition` — a criterion
with neither is a blocking, silently dropped gap.

```bash
node scripts/ci/launch_rehearsal_entry_criteria.mjs --record entry-criteria-record.json
```

## What #2928 inherits from this task

- The entry-criteria record schema and readiness harness, ready to validate
  the real candidate/environment/test-data reconciliation once #2780 is
  accepted and the actual entry criteria are reconciled.
- The satisfied-vs-deferred disposition invariant, so #2928's formal
  rehearsal execution cannot silently start against an entry state with
  unaccounted-for gaps.

## Validation

- `npx vitest run tests/launch-rehearsal-entry-criteria.test.mjs` — all tests passing.
- `node scripts/ci/launch_rehearsal_entry_criteria.mjs --record <sample>` — verified `ready: true` on a fully-compliant record (all required fields present, every entry criterion satisfied-with-evidence or deferred-with-owner-and-release-condition); verified `ready: false` with the correct blocker for missing top-level fields, a missing/empty `entryCriteria` array, a criterion with an invalid status, a "satisfied" criterion missing evidence, and a "deferred" criterion missing owner or release condition, including with a null record.
