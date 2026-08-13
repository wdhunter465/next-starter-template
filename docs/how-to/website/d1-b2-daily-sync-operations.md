---
Doc Type: How-To
Audience: Bill, Operations operators, WORK (ChatGPT), Cursor, LGFC maintainers
Authority Level: Operational Procedure
Owns: Operator procedure for B2→D1 daily sync smoke testing, failure detection, bounded retry, recovery, evidence capture, escalation, and stop conditions
Does Not Own: Live credential creation/rotation, secret values, workflow/script implementation, or Production authority beyond recorded operator steps
Canonical Reference: /docs/ops/reports/d1-b2-daily-sync-readiness-2091.md
Related Issues: #2091, #2072, #2090
Last Reviewed: 2026-08-05
---

# Operate B2 → D1 Daily Sync

## Purpose

Give operators a single procedure for running and recovering the repository-defined Backblaze B2 → Cloudflare D1 daily sync path without exposing secrets or performing unauthorized Production mutations.

## Scope

Covers the GitHub Actions workflow `OPS — B2 D1 Daily Sync` (`.github/workflows/b2-d1-daily-sync.yml`) and its invoked scripts. Does not authorize creating or rotating credentials, hard-deleting D1 rows, or uncontrolled retry loops.

## Current known truth

- Scheduled run: cron `0 9 * * *` UTC (~04:00 EST / 05:00 EDT).
- Manual run: Actions → **OPS — B2 D1 Daily Sync** → Run workflow.
- Jobs: `smoke-test` then `sync` (incremental sync + deletion reconciliation).
- Readiness evidence: `docs/ops/reports/d1-b2-daily-sync-readiness-2091.md`.
- Script-level detail: `scripts/B2_D1_SYNC_README.md`.

## Steps

1. Confirm you have authorized operator access to GitHub Actions logs and (if needed) Cloudflare/B2 consoles — not via pasting secrets into Issues/PRs.
2. Prefer observing the scheduled run; use `workflow_dispatch` only when a bounded smoke or recovery run is approved.
3. Confirm `smoke-test` is green before treating `sync` results as authoritative.
4. Review the Actions step summary for sync/reconcile outcomes and counts.
5. If reconcile opens a findings Issue, triage labels (`ops-runtime-finding`, `b2-runtime`, `d1-runtime`) and record disposition.
6. On failure, follow the matching failure path below; escalate rather than looping uncontrolled retries.
7. Capture evidence (run URL, step summary, Issue links) in the ops handoff note — never secret values.

## Procedure

### A. Normal successful path

1. Open the latest successful run of **OPS — B2 D1 Daily Sync**.
2. Confirm `smoke-test` passed.
3. Confirm `sync` completed: incremental sync and deletion reconciliation both success.
4. Note soft-retired counts / repaired matchups from the step summary when present.
5. If `has_findings` produced an Issue, link it in the daily ops note and close/triage per Operations practice.

### B. Safe smoke test (authorized operators only)

**GitHub Actions (preferred):**

1. Trigger `workflow_dispatch` on **OPS — B2 D1 Daily Sync**.
2. Watch `smoke-test` first. If it fails, stop — do not interpret later jobs.
3. If smoke passes, allow `sync` to complete once; do not re-run repeatedly without a recorded reason.

**Local dry-run (optional, when you already hold private env in your own shell — never commit values):**

```bash
export DRY_RUN=1
# Set required env names from scripts/B2_D1_SYNC_README.md in your private shell only
bash scripts/b2_d1_incremental_sync.sh
bash scripts/b2_d1_deletion_reconcile.sh
```

Dry-run must not be used as a substitute for Actions smoke when the goal is proving GitHub secret wiring.

### C. Authentication failure

Symptoms: missing-env exit, B2 auth/list failure, Cloudflare auth error (including documented `Authentication error [code: 10000]` class), or `verify_cloudflare_d1_auth.mjs` failure.

1. Stop further sync attempts for this incident.
2. Verify **secret names** exist in GitHub Actions / org secrets (presence only).
3. Private operator action: validate or rotate tokens in Cloudflare/B2 consoles per #2090 residual practice — **do not paste values into GitHub**.
4. Re-run **one** bounded `workflow_dispatch` after credentials are corrected.
5. If still failing, open/update escalation (workflow does this on job failure) and hand to Bill/Operations.

### D. B2 failure

Symptoms: smoke-test fail; incremental sync cannot list objects; empty inventory causing reconcile fail-closed.

1. Treat as fail-closed — do not force reconcile when B2 inventory is empty.
2. Check B2 endpoint/bucket/key permissions (listBucket) privately.
3. Capture run URL + failing step name only.
4. Single bounded retry after root cause fix; otherwise escalate.

### E. D1 failure

Symptoms: D1 auth verify fail; query/execute SQL failure; wrangler errors.

1. Confirm token capability expectations (D1 Edit + User Details Read) without exposing the token.
2. Confirm database name/id secret names match the intended Production D1 binding.
3. Do not run ad-hoc destructive SQL from chat/agents.
4. Single bounded retry after private credential/config correction; else escalate.

### F. Partial sync

Symptoms: incremental sync succeeded but reconcile failed (or the reverse); step summary shows mixed outcomes.

1. Record which step failed (`sync` vs `reconcile` step ids).
2. Do not manually hard-delete `photos` rows to "clean up".
3. Prefer one full workflow re-run after fix; rely on idempotent insert + soft-retire semantics.
4. If matchup repair findings Issues exist, triage before declaring recovery complete.

### G. Duplicate / retry path

1. Idempotent re-run is allowed **once** after a documented fix, or as the next scheduled run.
2. Do not hammer `workflow_dispatch` in a loop.
3. Concurrent runs: concurrency group `b2-d1-daily-sync` with `cancel-in-progress: false` — wait for the in-flight run.

### H. Monitoring and evidence capture

1. Actions run URL + step summary.
2. Findings Issue links (if any).
3. Escalation Issue links on failure.
4. Counts only (retired rows, repaired matchups) — never keys that embed secrets, never credential material.

### I. Recovery

1. Restore credentials privately if auth was the cause.
2. Re-run one workflow dispatch or wait for schedule.
3. Confirm smoke + sync + reconcile green.
4. Close or update findings/escalation Issues with outcome and run URL.
5. Documentation-only rollback of #2091 docs does **not** reverse live D1/B2 state.

### J. Escalation

| Condition | Action |
| --- | --- |
| Auth/secret invalid | Private rotation; then one retry; else Bill/Operations |
| Repeated schedule failures | Escalate via workflow Issue + human ops owner |
| Suspected data loss / hard-delete pressure | **STOP** — soft-retire only; escalate |
| Authority conflict or missing approval for Production write | **STOP** — do not invent authority |
| CI as-built / broader handoff gaps | Route to #2072 — do not expand this procedure |

## Stop conditions

Stop for missing Production authority, secret exposure risk, credential creation without approval, paid commitments, destructive hard deletes, schema mutations outside an authorized Issue, or uncontrolled retries.

## Related documents

- `docs/ops/reports/d1-b2-daily-sync-readiness-2091.md`
- `scripts/B2_D1_SYNC_README.md`
- `docs/reference/ci/ops-runtime-surface.md`
- Issues #2072, #2090, #2091
