---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Prod → Dev D1 data-classification and sanitization contract for lgfc_lite → lgfc-litedev
Does Not Own: Remote refresh Action (#3359), Cloudflare dashboard bindings, Production backup/R2 policy
Canonical Reference: /config/d1/prod-dev-sanitization-manifest.v1.json
Related Issues: #3355, #3358, #3357, #3359
Last Reviewed: 2026-08-11
---

# Prod → Dev D1 sanitization / data-classification policy

## Purpose

Define the machine-consumable classification contract for any Production-derived rows that may later be copied from Production D1 `lgfc_lite` into Development D1 `lgfc-litedev`.

## Scope

- In scope: table/column classification, fail-closed schema drift, deterministic transforms, synthetic fixtures, privacy-safe counts, Product HOLD list, GO/HOLD recommendation for #3359.
- Out of scope: executing a remote Production export/import; GitHub Action wiring (#3359); changing Production backups.

## Current known truth

- Identities: Production `lgfc_lite` / `22d0dc3e-ad34-43af-8e6a-2063df1a1e04`; Dev `lgfc-litedev` / `35232809-b4c1-4df9-9f39-2f178b13c378`.
- Canonical contract file: `config/d1/prod-dev-sanitization-manifest.v1.json`.
- Engine + drift gate: `scripts/ci/d1_prod_dev_sanitize.mjs`.
- Unknown tables/columns fail closed.
- Source field values must never appear in logs, PR bodies, fixtures, or CLI summaries.

## Classification vocabulary

| Class | Meaning |
| --- | --- |
| `copy_as_is` | Safe to copy after row filters |
| `transform` | Deterministic replacement (email/name/text) |
| `redact` | Null / empty / fixed sentinel |
| `randomize` | Deterministic non-reversible stand-in (e.g. vote hash) |
| `exclude` | Table or column never copied |
| `replace_with_fixture` | Drop Production rows; insert synthetic fixture set |
| `hold_for_product` | Block refresh until Product dispositions |

## Hard exclusions

- `member_sessions` — auth sessions
- `login_attempts` — security telemetry
- `join_email_log` — recipient email delivery metadata
- `d1_migrations` — Wrangler-managed

## Members

Default: `replace_with_fixture` with a single synthetic admin (`dev-admin@example.invalid`). Production membership rosters never copy. Product decision **PD-3358-02** records this proposed default.

## Open Product decisions

1. **PD-3358-01** — `photos.people`: copy as-is vs redact/randomize for memorabilia tags.
2. **PD-3358-02** — confirm fixture-only members vs transforming Production members.

## Referential integrity notes

- Excluding sessions/login attempts means Dev auth must use fixture members only.
- `content_items` rows whose `privacy_flag` is not in the allowlist are excluded (unknown flags fail closed).
- Refresh Action must not emit rows that require unresolved `hold_for_product` columns.

## GO / HOLD for #3359

**HOLD** remote refresh Action implementation for Production→Dev data move until **PD-3358-01** is dispositioned and the manifest `go_hold_recommendation` flips to `GO`.

Policy package + unit tests may land under #3358 while that HOLD remains.

## Intended final state

#3359 consumes this manifest, refuses drift/unknowns/holds, writes only privacy-safe counts, and never mutates Production.
