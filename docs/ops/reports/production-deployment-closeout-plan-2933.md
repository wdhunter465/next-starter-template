---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2933 (#2782 Task 004) verification/stabilization/acceptance/Day-2-transfer/closeout schema and readiness harness
Does Not Own: The candidate manifest (#2930); the preflight/change-window/rollback runbook (#2931); the smoke-verification suite (#2932, owned by that report); the actual deployment execution and Production Go decision (separately protected)
Canonical Reference: /docs/ops/reports/production-deployment-closeout-plan-2933.md
Related Issues: #2933, #2782, #2930, #2931, #2932, #2929, #2776, #2777, #2783, #2786, #2787
Last Reviewed: 2026-08-14
---

# Production deployment verification, stabilization, and closeout plan — #2933

## Purpose

Deliver #2933 (#2782 Task 004): post-deployment verification, stabilization,
Product-attributed acceptance evidence, Day-2 ownership record, and closeout
accounting against a deterministic readiness harness — after #2932 smoke was
accepted by Product Authority.

## Scope

Covers the closeout record schema, the readiness harness
(`scripts/ci/production_deployment_closeout_readiness.mjs`), and the filled
JSON evidence files for this increment. It consumes #2932's smoke-verification
result as a pipeline input. It does not write Production D1, send email, run
`promote-cloudflare-deployment.sh`, or close parent #2782.

## Current known truth

- Product Authority recorded Production Go 2026-08-14T20:50Z. Live Pages
  Production Active source is `7e238319360b7adff2d893ebce03a40e9833f497`
  (deployment `952e90fc`). Rollback SHA is `ccab0480` / deployment `c5051e90`.
- #2932 PR #3480 merged at `06f00660`. All six smoke categories passed.
  Bill / Product Authority accepted that smoke 2026-08-14T21:15Z.
- Read-only reconfirm `bash scripts/prod-smoke.sh https://www.lougehrigfanclub.com`
  exited 0 at 2026-08-14T21:17:25.877Z (`/api/health` `ok:true` `db_ok:true`).
- Authoritative live-run closeout evidence is the three JSON files listed
  under Real closeout files. Sections below this heading that still describe
  pre-Go preparation are historical template, not a second result set.
- Sibling program Issues #2776, #2777, #2783, #2786, and #2787 remain OPEN and
  are not waived as program work. They are not recorded as #2782 launch
  blockers for this closeout.
- This increment does not write Production D1, send email, GET
  `/api/matchup/current`, or close #2782.

## Intended final state

Closeout JSON is filled against already-active `7e238319`. Harness expected
`ready: true` from those files. Independent merge review remains required.
Cursor must not self-merge. Parent #2782 stays open until authorized
project-master closeout.

## Non-blocking prerequisite rule

Accepted #2932 deployment evidence governs final live verification and
closeout. That evidence now exists and is Product-accepted. This increment
records it. No additional Production mutation is executed, simulated as real,
or implied.

## Collision-safe package prepared now

### Stabilization criteria

- Candidate identity is already-active `7e238319360b7adff2d893ebce03a40e9833f497`.
- No critical smoke `fail`. Rollback was not activated.
- Monitoring (#2780 CLOSED) and recovery owner (Bill) are recorded on the
  deployed candidate.

### Defect / rollback / retest routing

1. Defect found in live verification → record on #2932/#2933; do not close.
2. Critical failure → STOP; rollback to `ccab0480` / `c5051e90`.
3. Retest only the failed category plus identity drift check; do not invent a
   new candidate.
4. Product acceptance of this Go is recorded via Bill's smoke acceptance.
   Sibling program projects remain open.

### Operator handoff / Day-2

Day-2 owner remains Bill per `docs/governance/AGENT-TEAM.md`. #2786 stays open
as a separate program project.

### Real closeout files

- `docs/ops/reports/production-deployment-closeout-record-2933.json`
- `docs/ops/reports/production-deployment-closeout-smoke-result-2933.json`
- `docs/ops/reports/production-deployment-closeout-unresolved-decisions-2933.json`

```bash
node scripts/ci/production_deployment_closeout_readiness.mjs \
  --closeout docs/ops/reports/production-deployment-closeout-record-2933.json \
  --smoke-result docs/ops/reports/production-deployment-closeout-smoke-result-2933.json \
  --unresolved-decisions docs/ops/reports/production-deployment-closeout-unresolved-decisions-2933.json
```

Expected this increment: `ready: true`.

## Unresolved protected decisions carried forward

#2776, #2777, #2783, #2786, and #2787 remain OPEN as sibling program projects
and are not waived. They are omitted from the closeout harness decisions file
because they are not #2782 launch blockers for this accepted Go. Production Go
and #2932 smoke are recorded.

## Closeout record — required fields

| Field | Purpose |
| --- | --- |
| `publicBehaviorAcceptanceEvidence` | Citation proving public behavior matches acceptance criteria |
| `noOpenLaunchBlockerEvidence` | Citation confirming no unresolved launch blocker remains |
| `recoveryActiveEvidence` | Citation confirming recovery/rollback capability is active post-deployment |
| `monitoringActiveEvidence` | Citation confirming monitoring/alerting is active post-deployment |
| `productAcceptanceEvidence` | Citation to the recorded Product acceptance decision |
| `day2OwnershipEvidence` | Citation to the recorded Day-2 (ongoing) ownership transfer |
| `issuePrReleaseEvidenceConsistency` | Citation confirming Issue/PR/release evidence is mutually consistent |

## Readiness harness

`scripts/ci/production_deployment_closeout_readiness.mjs` validates a closeout
record against the schema above and requires `--smoke-result` pointing at
#2932's smoke-verification harness JSON output — closeout cannot declare
deployment accepted on its own narrative; it must point at an upstream result
that was itself `ready: true`.

```bash
node scripts/ci/production_deployment_closeout_readiness.mjs \
  --closeout closeout-record.json \
  --smoke-result smoke-verification-result.json
```

## What this increment records

- Verification and stabilization: proven via #2932's accepted smoke-
  verification result, cross-checked here rather than re-asserted.
- Acceptance and Day-2: Bill's 2026-08-14T21:15Z smoke acceptance; Day-2 owner
  remains Bill.
- Project closeout evidence for #2782 Task 004. This increment does not close
  #2933 or #2782.

## Validation

- `npx vitest run tests/production-deployment-closeout-readiness.test.mjs`
- `node scripts/ci/production_deployment_closeout_readiness.mjs --closeout docs/ops/reports/production-deployment-closeout-record-2933.json --smoke-result docs/ops/reports/production-deployment-closeout-smoke-result-2933.json --unresolved-decisions docs/ops/reports/production-deployment-closeout-unresolved-decisions-2933.json` — expected `ready: true`.
