---
Doc Type: How-to
Audience: Human + AI
Authority Level: Procedure
Owns: Operator steps to bind Cloudflare Pages Preview/Development D1 to lgfc-litedev while preserving Production lgfc_lite
Does Not Own: D1 schema design, Prod→Dev refresh workflow, sanitization policy, or Production credential rotation
Canonical Reference: /docs/reference/platform/component-environment-isolation.md
Related Issues: #3355, #3357, #3356
Last Reviewed: 2026-08-11
---

# Bind Pages Preview D1 to Development (`lgfc-litedev`)

## Purpose

Point Cloudflare Pages **Preview** Functions binding `DB` at Development D1 `lgfc-litedev` while leaving **Production** `DB` on `lgfc_lite`. Repo `wrangler.toml` already records both identities; Pages dashboard bindings must match.

## Preconditions

- Dev database exists: name `lgfc-litedev`, id `35232809-b4c1-4df9-9f39-2f178b13c378` (#3357).
- Production D1 remains: name `lgfc_lite`, id `22d0dc3e-ad34-43af-8e6a-2063df1a1e04`.
- Source Issue `#3357` (parent `#3355`) authorizes the change.
- Do **not** change Production bindings.

## Steps (Cloudflare Dashboard)

1. Open Workers & Pages → Pages project used by LGFC (`next-starter-template` / site project in account).
2. Open **Settings** → **Functions** → **D1 database bindings** (wording may vary slightly).
3. Confirm **Production** environment binding:
   - Variable/binding name: `DB`
   - Database: `lgfc_lite` (`22d0dc3e-ad34-43af-8e6a-2063df1a1e04`)
4. Set **Preview** environment binding:
   - Variable/binding name: `DB`
   - Database: `lgfc-litedev` (`35232809-b4c1-4df9-9f39-2f178b13c378`)
5. Save. Do not create a second Production binding to Dev.

## GitHub secrets (optional but recommended for CI checks)

Add repository secrets (values only; never commit):

| Secret | Expected value |
| --- | --- |
| `D1_DATABASE_NAME` | `lgfc_lite` |
| `D1_DATABASE_ID` | `22d0dc3e-ad34-43af-8e6a-2063df1a1e04` |
| `D1_DEV_DATABASE_NAME` | `lgfc-litedev` |
| `D1_DEV_DATABASE_ID` | `35232809-b4c1-4df9-9f39-2f178b13c378` |

Existing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` remain required for `d1-migrations.yml`.

## Apply schema to Dev (first remote Dev write)

From a trusted machine or after merge of the #3357 workflow:

```bash
node scripts/ci/d1_prod_dev_identity_check.mjs
npx wrangler d1 migrations apply lgfc-litedev --remote
```

Print and confirm name/id before apply. **Never** run Dev migrate commands against `lgfc_lite`.

## Verification

| Check | Expected |
| --- | --- |
| `node scripts/ci/d1_prod_dev_identity_check.mjs` | PASS; distinct IDs |
| Production Pages `DB` | `lgfc_lite` / `22d0dc3e-…` |
| Preview Pages `DB` | `lgfc-litedev` / `35232809-…` |
| Privacy-safe Dev probe | Bounded write visible in Dev; absent from Production (record on #3357) |

## Resume condition for Cursor

Comment on `#3357` with: Preview binding screenshot or binding list (no secrets), secrets-added confirmation (names only), and migration apply result for `lgfc-litedev`. Cursor then records isolation evidence / GO-HOLD for #3358/#3359.
