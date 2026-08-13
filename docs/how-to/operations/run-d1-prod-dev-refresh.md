---
Doc Type: How-to
Audience: Human + AI
Authority Level: Procedure
Owns: How to run the manual Prod→Dev D1 refresh GitHub Action (#3359)
Does Not Own: Sanitization classification policy (#3358), Production R2 backups, autonomous scheduling
Canonical Reference: /docs/reference/operations/d1-prod-dev-sanitization-policy.md
Related Issues: #3359, #3358, #3355, #3366
Last Reviewed: 2026-08-11
---

# Run Prod → Dev D1 refresh (manual Action)

## Purpose

Refresh Development D1 `lgfc-litedev` from a Production `lgfc_lite` export under the approved sanitization manifest, via a **manual** `workflow_dispatch` workflow only.

## Scope

- In scope: operator steps for dry-run and (Bill-authorized) remote Dev reload.
- Out of scope: scheduled refresh; Production writes; Dev R2 backup.

## Current known truth

- Workflow: `OPS — D1 Prod→Dev Refresh (#3359)` → `.github/workflows/ops-d1-prod-dev-refresh.yml`
- Concurrency group: `d1-prod-dev-refresh-3359` (one refresh at a time)
- Source: `lgfc_lite` / `22d0dc3e-ad34-43af-8e6a-2063df1a1e04` (export/read-only)
- Target: `lgfc-litedev` / `35232809-b4c1-4df9-9f39-2f178b13c378` (`--env preview`)
- PD-3358-01: `photos.people` = COPY AS-IS
- First remote destructive run requires Bill’s manual trigger (Cursor must stop and report readiness)

## Required secrets

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `D1_DATABASE_NAME`, `D1_DATABASE_ID`
- `D1_DEV_DATABASE_NAME`, `D1_DEV_DATABASE_ID`

Optional (recommended): GitHub Environment `d1-dev-refresh` with Bill as required reviewer for non-dry-run — not hard-required by the workflow YAML yet.

## Preconditions

- #3358 policy merged; sanitization CLI reports `refreshGate: "GO"`
- Identity check passes (`node scripts/ci/d1_prod_dev_identity_check.mjs`)
- Unit tests pass locally

## Steps

### Local verification (before any remote run)

```bash
node scripts/ci/d1_prod_dev_identity_check.mjs
node scripts/ci/d1_prod_dev_sanitize.mjs
npx vitest run tests/d1-prod-dev-sanitize.test.mjs tests/d1-prod-dev-refresh.test.mjs
```

### Dry run (safe default)

1. Actions → **OPS — D1 Prod→Dev Refresh (#3359)** → Run workflow
2. Inputs:
   - `reason`: Issue/reference text (e.g. `#3359 first dry-run`)
   - `confirm`: `confirm`
   - `dry_run`: `true`
   - leave `confirm_dev_reset` empty
3. Inspect privacy-safe evidence artifact / Issue #3359 comment (counts only; no source values)

### First remote Dev refresh (Bill only)

Cursor must not start this step autonomously.

1. Confirm dry-run evidence looks correct
2. Run the same workflow with:
   - `dry_run`: `false`
   - `confirm`: `confirm`
   - `confirm_dev_reset`: `RESET_LGFC_LITEDEV`
   - `reason`: explicit authorization note
3. Expect destructive reload of **Dev only** (`DELETE` + sanitized `INSERT` via `--env preview`)
4. Verify Preview app behavior; Production baseline unchanged

After implementation merges, Cursor stops before the first `dry_run=false` remote run and reports workflow name, secrets, inputs, identities, and destructive Dev behavior for Bill’s manual trigger.

## Rollback

- Production: no write rollback needed (export-only)
- Dev: re-run refresh, or restore Dev from a known-good prior Dev state if separately retained (no Dev R2 backup is introduced by this workflow)
