---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Task Evidence
Owns: #2929 (#2781 Task 004) evidence index for the final rehearsal disposition — live artifact paths, merged-package identity, and disposition-readiness snapshot
Does Not Own: Product Authority Production Go; Pipeline intake closeout for #2776/#2777/#2783/#2786/#2787; #2928 defect-ledger contents
Canonical Reference: /docs/ops/reports/launch-rehearsal-disposition-evidence-index-2929.md
Related Issues: #2929, #2781, #2926, #2927, #2928, #2782, #3444
Last Reviewed: 2026-08-14
---

# Launch rehearsal disposition evidence index — #2929

## Purpose

Index the exact unchanged-candidate evidence #2929 cites for the recorded
GO / HOLD / ADJUSTMENT / NO-GO recommendation and the bounded #2782 handoff.

## Current known truth

| Artifact | Identity / path | Status |
| --- | --- | --- |
| Component tip (this increment start) | `component/launch-rehearsal@94b47d49a8cbb9df3d0ef8e2a4cce83ff225c311` | Includes merged PR #3444 |
| Frozen candidate | `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` | PMO-accepted with #2928 COMPLETE |
| Isolated environment | Cloudflare Pages Preview `05568c3e-a56f-45d0-a3db-1298d9b7b80c` / D1 `lgfc-litedev` uuid `35232809-b4c1-4df9-9f39-2f178b13c378` | Isolation #2818 CLOSED |
| Preview URL | `https://05568c3e.next-starter-template-6yr.pages.dev` | Unchanged candidate host |
| Entry record | `docs/ops/reports/launch-rehearsal-entry-criteria-record-2926.json` | Live-reconciled 2026-08-14 |
| Journey catalog | `docs/ops/reports/launch-rehearsal-journey-catalog-2927.md` | On component branch |
| Journey registry | `docs/ops/reports/launch-rehearsal-journey-registry-2927.json` | 22 journeys; `validate-registry` ok |
| Observe-only evidence log | `docs/ops/reports/launch-rehearsal-observe-only-evidence-2928.json` | 12 journeys; D-2928-001/002 fail then pass |
| Observe-only run | `docs/ops/reports/launch-rehearsal-observe-only-run-2928.md` | Merged via PR #3439/#3440 |
| Write-capable evidence log | `docs/ops/reports/launch-rehearsal-write-capable-evidence-2928.json` | 10 journeys; D-2928-003/004 fail then pass |
| Write-capable run | `docs/ops/reports/launch-rehearsal-write-capable-run-2928.md` | Merged via PR #3443/#3444 |
| Defect ledger | `docs/ops/reports/launch-rehearsal-defect-ledger-2928.json` | 4 defects; all `resolved` |
| #2928 execution package | `docs/ops/reports/launch-rehearsal-execution-package-2928.md` | Current after PR #3444 |
| Unresolved decisions | `docs/ops/reports/launch-rehearsal-unresolved-protected-decisions-2929.json` | 5 Pipeline intake Issues carried to #2782 |

## Disposition-readiness snapshot (2026-08-14)

Combined evidence for `evidence-audit` / `retest-coverage` is the concatenation
of the two #2928 JSON logs (26 entries; 22 unique journey ids).

```bash
node scripts/ci/launch_rehearsal_harness.mjs --mode validate-registry
node scripts/ci/launch_rehearsal_harness.mjs --mode evidence-audit \
  --evidence /tmp/2929-combined-evidence.json
node scripts/ci/launch_rehearsal_defect_ledger.mjs --mode validate-ledger \
  --ledger docs/ops/reports/launch-rehearsal-defect-ledger-2928.json
node scripts/ci/launch_rehearsal_defect_ledger.mjs --mode retest-coverage \
  --ledger docs/ops/reports/launch-rehearsal-defect-ledger-2928.json \
  --evidence /tmp/2929-combined-evidence.json
node scripts/ci/launch_rehearsal_disposition_readiness.mjs \
  --registry-result /tmp/2929-registry.json \
  --evidence-result /tmp/2929-evidence.json \
  --ledger-result /tmp/2929-ledger.json \
  --retest-result /tmp/2929-retest.json \
  --unresolved-decisions docs/ops/reports/launch-rehearsal-unresolved-protected-decisions-2929.json
```

Mechanical sub-results: registry `ok: true` (`journeyCount: 22`); evidence-audit
`ok: true` (`evidenceCount: 22`); ledger `ok: true` (`defectCount: 4`);
retest-coverage `ok: true`.

Disposition-readiness: `ready: false`. Sole blocker:
`unresolved_protected_decisions_present` (#2776, #2777, #2783, #2786, #2787).

## What this index does not claim

- Product Authority Production Go.
- Waiver or closeout of #2776, #2777, #2783, #2786, or #2787.
- That `component/launch-rehearsal` is the frozen runtime candidate.
