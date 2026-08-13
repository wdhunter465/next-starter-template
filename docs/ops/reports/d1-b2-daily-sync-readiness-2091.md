---
Doc Type: Operations
Audience: Bill, WORK (ChatGPT), Cursor, Operations operators, LGFC maintainers
Authority Level: Controlled
Owns: Task #2091 readiness evidence for the repository-defined B2→D1 daily sync path — inventory, proven vs operator-verification vs protected gaps, and cross-links to #2072 / #2090
Does Not Own: Live credential creation/rotation, Production D1/B2 mutation, workflow/script changes, secret values, or superseding #2072 / #2090 authority
Canonical Reference: /.github/workflows/b2-d1-daily-sync.yml
Related Issues: #2091, #2072, #2090, #2921
Last Reviewed: 2026-08-05
---

# D1/B2 Daily Sync Operational Readiness — #2091

## Purpose

Record operational readiness for the repository-defined Backblaze B2 → Cloudflare D1 daily sync path: what the repo proves today, what an authorized operator must still verify live, and which credential/Production actions remain protected private-operator steps.

This report makes **no** workflow, script, schema, credential, or Production state change.

## Scope

In scope: inventory of the scheduled/manual sync path on `main` tip `b68bc2b5`, readiness classification, and pointers to the operator how-to.

Out of scope: exposing secret values; creating/rotating tokens; live B2/D1 reads or writes; uncontrolled retries; broader publication automation; editing CI as-built ownership under #2072.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2091 |
| Starting `main` SHA | `b68bc2b5f257e2c0da77a8c07374ebbf5a3b5b22` |
| Primary workflow | `.github/workflows/b2-d1-daily-sync.yml` (`OPS — B2 D1 Daily Sync`) |
| Schedule | cron `0 9 * * *` UTC (~04:00 EST / 05:00 EDT) |
| Manual trigger | `workflow_dispatch` |
| Concurrency | group `b2-d1-daily-sync`, `cancel-in-progress: false` |
| Entry gate | #2921 WORK-accepted and CLOSED `status:complete` |
| Related #2072 | OPEN — CI as-built / ops handoff reconciliation (cite only) |
| Related #2090 | CLOSED `status:complete` — Cloudflare Production config/token readiness gap closed as an Issue; live secret values remain private |

## Intended final state

- Operators can follow a single readiness checklist and a how-to for smoke, failure, recovery, and escalation without guessing secret values.
- Repository-proven behavior is separated from live verification and protected Production actions.
- #2072 and #2090 remain authoritative for their own scopes.

## Repository inventory (proven from files)

### Triggers and jobs

1. **smoke-test** — installs AWS CLI v2; runs `scripts/b2_s3_smoketest.sh` with B2 S3-compatible secrets.
2. **sync** (needs smoke-test) — `npm ci`; verifies Cloudflare D1 auth via `scripts/ci/verify_cloudflare_d1_auth.mjs`; runs `scripts/b2_d1_incremental_sync.sh`; runs `scripts/b2_d1_deletion_reconcile.sh`; may open findings Issues via `scripts/ci/ops_reconcile_findings.mjs`; on failure escalates via `scripts/ci/ops_runtime_escalation.mjs`.

### Supporting scripts (read-only inventory)

| Path | Role |
| --- | --- |
| `scripts/b2_d1_incremental_sync.sh` | Idempotent additive insert of new B2 objects into D1 `photos` |
| `scripts/b2_d1_deletion_reconcile.sh` | Soft-retire D1 rows missing from B2; repair matchups; fail closed on empty B2 inventory |
| `scripts/b2_s3_smoketest.sh` | Pre-sync B2 connectivity smoke |
| `scripts/ci/verify_cloudflare_d1_auth.mjs` | Pre-sync Cloudflare/D1 credential verification |
| `scripts/ci/ops_reconcile_findings.mjs` | Opens/labels findings Issues when reconcile reports actionable results |
| `scripts/ci/ops_runtime_escalation.mjs` | Opens/updates runtime failure escalation Issues |
| `scripts/B2_D1_SYNC_README.md` | Script-level operator notes (env names, exit codes, dry-run) |
| `scripts/b2_d1_daily_sync.sh` | Older snapshot-oriented helper; **not** the job invoked by the current workflow |

### Authentication boundaries (names only — no values)

Required GitHub Actions secrets referenced by the workflow (names only):

- B2: `B2_ENDPOINT`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY`
- Cloudflare/D1: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (or `CF_ACCOUNT_ID`), `D1_DATABASE_NAME` / `D1_DATABASE_ID`

Documented token capability expectation (from script README, not a live grant proof): Cloudflare token with **Account → D1 → Edit** and **User → User Details → Read**.

### Monitoring and evidence

- Job step summary writes sync/reconcile outcomes and counts.
- Actionable reconcile findings → Issue with labels such as `ops-runtime-finding`, `b2-runtime`, `d1-runtime`.
- Job failure → escalation Issue with labels such as `ops-runtime-failure`, `b2-runtime`, `d1-runtime`.
- Classification reference: `docs/reference/ci/ops-runtime-surface.md` lists this workflow as OPS runtime / fail-closed advisory surface.

### Idempotency / safety (repository claims)

- Incremental sync uses insert guards (`INSERT ... WHERE NOT EXISTS` pattern per README).
- Deletion path soft-retires (`is_matchup_eligible = -1`); refuses empty B2 inventory (fail closed).
- `DRY_RUN=1` supported by sync/reconcile scripts for non-mutating SQL generation locally when env is present.
- Workflow concurrency does not cancel an in-flight run.

## Readiness classification

| Item | Classification |
| --- | --- |
| Workflow + scripts present on `main` | **Repository-proven** |
| Schedule + manual dispatch defined | **Repository-proven** |
| Secret **names** and permission expectations documented | **Repository-proven** (docs/README) |
| Secret **values** present and valid in GitHub Actions / Cloudflare | **Operator-verification required** (private) |
| Live B2 list + D1 write succeeding on schedule | **Operator-verification required** |
| smoke-test → sync green in Actions history | **Operator-verification required** |
| Findings/escalation Issue creation path coded | **Repository-proven**; live Issue creation depends on run outcomes |
| CI as-built / broader ops handoff reconciliation | **Owned by #2072** (OPEN) — not completed by #2091 |
| Cloudflare Production token readiness Issue | **#2090 CLOSED**; residual live rotation/validation remains private operator work |

## Unresolved protected gaps

1. **Live credential proof** — This session must not authenticate to Cloudflare or B2 or print secret values.
2. **Production mutation** — No live sync, reconcile, or D1/B2 write is authorized by this docs task.
3. **#2072 open work** — Do not treat this report as closing CI as-built reconciliation.
4. **Older `scripts/b2_d1_daily_sync.sh`** — Exists alongside the incremental path; operators must use the workflow-invoked scripts unless a later Issue re-scopes consolidation.

## Cross-links

- #2072 — CI as-built documentation and operations handoff reconciliation (OPEN).
- #2090 — Cloudflare Production configuration, secrets, and token readiness (CLOSED complete).
- Operator procedure: `docs/how-to/website/d1-b2-daily-sync-operations.md`.
- Script detail: `scripts/B2_D1_SYNC_README.md`.

## Acceptance mapping (#2091)

| Acceptance criterion | Where addressed |
| --- | --- |
| Daily sync readiness checklist exists | This report + how-to Steps |
| Auth/token expectations documented safely | Names + permission expectations only |
| Smoke-test and recovery steps clear | How-to |
| Operator handoff on sync failure | How-to escalation + monitoring |
| Remaining live credential work is private operator action | Protected gaps above |

## Rollback of this document

Remove or revise this report via PR revert. Documentation rollback does **not** authorize live D1/B2 reverse sync, deletion, or credential changes.
