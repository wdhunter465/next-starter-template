---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2926 (#2781 Task 001) entry-criteria reconciliation schema, candidate/environment/test-data identity requirements, readiness harness, and the reconciled entry-criteria record
Does Not Own: #2780's monitoring acceptance itself (only consumed as a governing predecessor); the journey catalog (#2927); formal rehearsal execution (#2928); final disposition (#2929)
Canonical Reference: /docs/ops/reports/launch-rehearsal-entry-criteria-2926.md
Related Issues: #2926, #2781, #2780, #2927, #2928, #2929, #2818
Last Reviewed: 2026-08-12
---

# Launch rehearsal entry-criteria reconciliation — #2926

## Purpose

Deliver #2926 (#2781 Task 001): the entry-criteria schema, exact candidate/
environment/test-data identity requirements, a deterministic
reconciliation-readiness harness, and a live reconciled entry-criteria record
so that #2928's formal rehearsal execution starts from a pre-agreed,
machine-checked entry state instead of discovering missing prerequisites
mid-rehearsal.

## Scope

Covers entry-criteria reconciliation only: the entry-criteria record schema
below, the readiness harness
(`scripts/ci/launch_rehearsal_entry_criteria.mjs`), and the reconciled record
(`docs/ops/reports/launch-rehearsal-entry-criteria-record-2926.json`). It does
not cover #2780's monitoring acceptance itself (only consumes it as a governing
predecessor for final rehearsal dependencies), #2927's journey catalog,
#2928's actual rehearsal execution, or #2929's final disposition — each is
owned by its own task.

## Current known truth (reconciled 2026-08-12)

- Schema + harness already landed on `component/launch-rehearsal` via PR #3236
  (`9900f98d3841c806cf20eaa82f91e1849066927a`).
- Live reconciled record:
  `docs/ops/reports/launch-rehearsal-entry-criteria-record-2926.json`.
- **Satisfied now:** #2778 platform validation; #2779 backup/DR proof; #2785
  email/notification ops; entry harness on component; journey-catalog
  preparation artifacts present for later #2928 use.
- **Explicitly deferred (owner + release condition in the JSON record):**
  #2780 monitoring acceptance; #2776/#2777 completion contract/sequence;
  #2783 launch acceptance; #2784 compliance; #2786 operator readiness;
  #2787 vendor continuity; #2818 preview/component isolation; frozen
  isolated rehearsal deployment SHA; remaining website program evidence
  including #3382 where in scope.
- Preview/runtime isolation is **not** complete
  (`scripts/ci/preview-isolation-manifest.json` still marks Production D1 as
  `production-shared`). Formal write-capable rehearsal against preview remains
  blocked until #2818 (or equivalent) releases that condition.
- This document does not authorize Production mutation, failure injection, or
  use of Production data as test data. It never performs a live request.

## Intended final state

Once deferred release conditions are met (especially #2780 monitoring
acceptance, #2818 preview/component isolation, and a frozen isolated
deployment SHA), the reconciled JSON record holds exact reusable
`candidateIdentity` / `environmentIdentity` strings (prose only in `*Notes`
fields), every parent entry criterion is `satisfied` with evidence (or still
explicitly deferred with owner + release condition), and #2928 can start
formal write-capable rehearsal from this machine-checked entry state without
re-discovering missing prerequisites.

## Non-blocking prerequisite rule

Per #2926's own non-blocking prerequisite rule, this document, harness, and
reconciled record are **evidence inventory, environment/test-data planning,
journey preparation, cleanup design, test harness preparation, and package
completion** — the collision-safe category #2926 explicitly authorizes before
#2780's monitoring acceptance. Missing predecessor evidence stops only the
dependent formal rehearsal or candidate qualification action (#2928), not this
reconciliation planning.

## Entry-criteria record — required fields

| Field | Purpose |
| --- | --- |
| `candidateIdentity` | Exact candidate build/SHA identity string (no explanatory prose) |
| `candidateIdentityNotes` | Optional prose explaining planning vs frozen Promotion Candidate status |
| `environmentIdentity` | Exact isolated (non-Production) environment identity string |
| `environmentIdentityNotes` | Optional prose for isolation gaps and Production-shared risks |
| `testDataPlan` | Synthetic/redacted test-data plan — private Production data is never disposable test data |
| `executorRole` | Who performs rehearsal actions (a role, not necessarily a name) |
| `verifierRole` | Who independently confirms rehearsal results |
| `recoveryOwner` | Named accountable owner for rehearsal recovery/rollback |
| `cleanupPlan` | How rehearsal-created state is cleaned up afterward |
| `productionDataExclusionEvidence` | Citation confirming no private Production data was or will be used as test data |
| `entryCriteria` | Array of individual entry criteria — every criterion must be `satisfied` (with `evidence`) or `deferred` (with `owner` and `releaseCondition`) |

## Reconciled identities (summary)

Exact strings live in
`docs/ops/reports/launch-rehearsal-entry-criteria-record-2926.json`.

| Identity | Current exact value |
| --- | --- |
| Planning candidate | `component/launch-rehearsal@9900f98d3841c806cf20eaa82f91e1849066927a` |
| Environment | `planned-isolated:cloudflare-pages-preview/component/launch-rehearsal` (isolation incomplete pending #2818; see notes in JSON) |
| Test data | Synthetic/redacted fixtures only; no private Production disposable data |
| Roles | Executor = Implementation/Operations under claim; Verifier = PR Approver/Engineering + WORK; Recovery = Day-2 Operations coordination |

## Readiness harness

`scripts/ci/launch_rehearsal_entry_criteria.mjs` validates an entry-criteria
record against the schema above. Its key invariant, mechanically enforcing
#2926's acceptance criterion "every entry criterion is satisfied or
explicitly identified with an accountable owner and release condition": each
`entryCriteria` item must declare `status: 'satisfied'` with `evidence`, or
`status: 'deferred'` with both `owner` and `releaseCondition` — a criterion
with neither is a blocking, silently dropped gap.

```bash
node scripts/ci/launch_rehearsal_entry_criteria.mjs \
  --record docs/ops/reports/launch-rehearsal-entry-criteria-record-2926.json
```

## What #2928 inherits from this task

- The entry-criteria record schema and readiness harness.
- A machine-checked reconciled record where every gap is either satisfied with
  evidence or deferred with an accountable owner and release condition.
- Explicit stop: do not start formal write-capable rehearsal until deferred
  isolation (#2818) and monitoring (#2780) release conditions are met (and the
  frozen deployment candidate SHA is recorded).

## Validation

- `npx vitest run tests/launch-rehearsal-entry-criteria.test.mjs`
- `node scripts/ci/launch_rehearsal_entry_criteria.mjs --record docs/ops/reports/launch-rehearsal-entry-criteria-record-2926.json` → expect `ready: true`
- `git diff --check`
