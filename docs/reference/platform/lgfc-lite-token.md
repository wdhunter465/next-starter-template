---
Doc Type: Reference
Audience: Human + AI
Authority Level: Supporting
Owns: Definition of the Cloudflare API token `lgfc-lite-token`, its dependents, the consequences of changing it, and the LGFC Lite naming history
Does Not Own: Token values; secret provisioning steps; Platform and Environment Domain Policy; incident response
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #4575, #4534, #4537
Last Reviewed: 2026-10-13
---

# `lgfc-lite-token` and LGFC Lite

## Do not change this token

`lgfc-lite-token` is the primary Cloudflare API token for GitHub's connection to Cloudflare (Product Authority, 2026-10-13). Do not delete, roll, rename, shorten, edit the permissions of, or let it expire, except by the procedure in "Changing it safely" and only by Product Authority.

Cloudflare's token list shows a **Last used** date for it that is old (Feb 12, 2026 when checked on 2026-10-13). **That date cannot be trusted as evidence the token is unused.** It was nearly misread as proof the token was dead. Never revoke a token because of that column.

This page holds names only. It never contains a token value, and none may be added.

## What it is

| Item | Value |
| --- | --- |
| Cloudflare token name | `lgfc-lite-token` (My Profile, API Tokens) |
| Kind | Cloudflare API token, no expiry set (as shown 2026-10-13) |
| Resource scope | One account (the LGFC Cloudflare account) |
| Permissions shown by Cloudflare | `Account.D1`, `Account.Cloudflare Pages` and three more (the list is truncated on screen) |
| Permissions the repo documents it needing | D1 Edit, Cloudflare Pages Edit, Workers Scripts Edit, Workers KV Edit (`LGFC-D1-DATABASE-DESIGN-and-OPERATIONS-GUIDE.md`), plus User Details Read (the preflight check in `scripts/ci/verify_cloudflare_d1_auth.mjs`) |
| GitHub secret it is used through | `CLOUDFLARE_API_TOKEN`, with `CLOUDFLARE_ACCOUNT_ID` (GitHub, Settings, Secrets, Actions) |
| Owner | Product Authority |
| Other Cloudflare token | `LGFC GitHub Actions D1 Sync`, also in active use. It is not covered by this page and must not be changed either without the same care. |

### To confirm (Product Authority)

The repository cannot prove these. Until recorded here they are assumptions:

1. That the value stored in the GitHub secret `CLOUDFLARE_API_TOKEN` is the `lgfc-lite-token` value, and which Cloudflare token backs the `LGFC GitHub Actions D1 Sync` name.
2. The exact five permissions on the token (Cloudflare truncates the list).
3. Whether any other tool (Zapier, a local machine, Cursor) holds a copy of its value.
4. Where the value is stored outside GitHub (for example a password manager), for recovery.

## What depends on it

About 36 GitHub Actions workflows read `CLOUDFLARE_API_TOKEN`. By purpose:

| Dependent | Workflows (examples) | If the token stops working |
| --- | --- | --- |
| Production D1 migrations on merge to `main` | `d1-migrations.yml`, `lgfc-d1-migrate.yml` | New migrations are not applied. The site keeps serving, but code that needs a new column can break on Production. |
| Daily and quarterly D1 backups to R2 | `ops-d1-backup-scheduled-daily-3268.yml`, `ops-d1-backup-scheduled-quarterly-drill-3268.yml`, backup preflights | Backups stop and the restore guarantee is lost until it is fixed. |
| Scheduled data and content jobs | `b2-d1-daily-sync.yml`, `snapshot.yml`, `gehrig-content-discovery.yml`, `ops-chatterbox-reconciliation-sweep.yml` | Photo and content sync, snapshots and discovery stop. |
| Content, rights and library workflows | `gehrig-*` backfill and approval workflows, `library-*` loads, `ops-gehrig-retrosheet-ingest-4263.yml`, `production-content-preview-preflight-2859.yml` | Rights approvals, imports and previews cannot write to D1. |
| Pages build recovery and Dev data | `ops-cf-pages-retry.yml`, `ops-d1-prod-dev-refresh.yml`, `ops-d1-dev-migration-*`, `seed-club-home-pilot.yml` | Retry of failed Pages builds and Development refreshes fail. |
| Preflight identity check | `scripts/ci/verify_cloudflare_d1_auth.mjs` and `d1_prod_dev_identity_check.mjs` | Fails closed, which blocks the workflows above. |

Find the current list with `grep -rl CLOUDFLARE_API_TOKEN .github/workflows`.

## What happens if it is changed

| Change | Effect |
| --- | --- |
| **Deleted or revoked** | Every dependent above fails at once on its next run. Nothing breaks visibly on the public site at that moment. Failures show up as red workflows, ops-exception Issues, and later as missing backups and unapplied migrations. |
| **Rolled (value replaced) without updating the GitHub secret** | Same as deleted. |
| **Expired** (it has no expiry now; a new one would need a reminder) | Same as deleted, on the expiry date. |
| **Permissions reduced or edited** | Only the dependents that need the removed permission fail, which is harder to diagnose. D1 Edit removal breaks migrations, backups and content writes. Pages Edit removal breaks Pages retry. |
| **Renamed** | Cloudflare tracks tokens by ID, so a rename does not break anything, but this page and the asset register would stop matching. Update both. |
| **Scope changed to another account or an IP restriction added** | Dependents fail, because GitHub-hosted runners use changing addresses. |

### What is not at risk

- The public website at `www.lougehrigfanclub.com` keeps being served from Cloudflare Pages. Pages deploys run through Cloudflare's own GitHub connection (the Cloudflare Pages check on each PR), which is believed not to use this token. **To confirm.** The D1 binding is set in the Pages project, not by the token.
- The data already in D1 and R2 is not deleted by a token change.

### What is at risk

- **The repository's automation.** Migrations, backups, content sync and rights workflows all stop together, and some of them are the only protection for Production data (backups).
- **Recovery time.** Fixing it needs Product Authority at the Cloudflare dashboard, because agents do not hold credential decisions. A failure on a weekend stays failed until Product acts.
- **Silent drift.** If migrations stop but code keeps merging, Production can fall behind the schema the code expects.

## Changing it safely

Only Product Authority does this. No agent creates, rolls or deletes a token.

1. Create the new Cloudflare token first, with the same permissions and account scope. Leave `lgfc-lite-token` untouched.
2. Update the GitHub secret `CLOUDFLARE_API_TOKEN` to the new value.
3. Run `scripts/ci/verify_cloudflare_d1_auth.mjs` through a workflow that uses it (for example a manual D1 preflight) and confirm it passes.
4. Confirm the next daily backup and the next migration run succeed.
5. Only then retire the old token, and record the change and date here and in `lgfc-asset-register.md`.

## LGFC Lite: why the name exists

The original LGFC design (2024 to 2025) was larger and more complicated than the project needed. **LGFC Lite** was the decision to replace it with a lighter, streamlined design that allowed an immediate launch on Cloudflare Pages. The repository and the Cloudflare website were built on LGFC Lite in approximately October 2025.

The name stayed on the things built then:

- the Production D1 database `lgfc_lite` (created 2025-11-25);
- the Cloudflare token `lgfc-lite-token`;
- the rollback tag `lgfc-lite-v1.0-baseline` (see `docs/archive/research/lgfc-lite-baseline.md`).

These names are historical and load-bearing. **Do not rename `lgfc_lite` or `lgfc-lite-token` for tidiness.** A rename of the database changes identifiers used by `wrangler.toml`, workflows and backups. A mismatch between a name here and the real token can mislead the next reader exactly as the stale "Last used" date did.

See also: `docs/reference/platform/CLOUDFLARE.md`, `docs/reference/platform/lgfc-asset-register.md`, `docs/explanation/lgfc-design-evolution.md`.
