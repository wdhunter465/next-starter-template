---
Doc Type: How-to
Audience: Human + AI
Authority Level: Procedure
Owns: How to run the Prod→Dev D1 sanitization / schema-drift check locally
Does Not Own: Remote refresh Action execution, Cloudflare bindings, Production exports
Canonical Reference: /docs/reference/operations/d1-prod-dev-sanitization-policy.md
Related Issues: #3358, #3355, #3359
Last Reviewed: 2026-08-11
---

# Run Prod → Dev D1 sanitization check

## Purpose

Validate the versioned sanitization manifest covers the locked schema fingerprint, report open Product holds, and run unit tests that prove sensitive synthetic values cannot survive sanitization.

## Scope

- In scope: local Node CLI + Vitest.
- Out of scope: remote D1 export/import; applying sanitized rows to `lgfc-litedev`.

## Preconditions

- Checkout contains `config/d1/prod-dev-sanitization-manifest.v1.json`.
- Dependencies installed (`npm ci` or equivalent).

## Steps

1. Schema coverage + hold summary (privacy-safe JSON only):

```bash
node scripts/ci/d1_prod_dev_sanitize.mjs
```

2. Unit / negative tests:

```bash
npx vitest run tests/d1-prod-dev-sanitize.test.mjs
```

## Verification

- CLI exits `0` when every fingerprint table/column is classified.
- CLI prints `refreshGate: "HOLD"` while Product holds remain (expected under #3358).
- Tests fail if a new table/column is unclassified or if fixture emails/names leak into sanitized output.

## Rollback

Delete or revert the #3358 allowlisted files; no Production state is changed by this check.
