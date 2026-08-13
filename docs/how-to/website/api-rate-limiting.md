---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Where LGFC API rate limiting is configured and how to change it safely on Pages
Does Not Own: WAF rule authoring in the Cloudflare dashboard; Workers-only ratelimits bindings
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #527
Last Reviewed: 2026-08-11
---

# API rate limiting (Pages)

## Purpose

State the single authoritative control plane for LGFC Production API rate limiting and avoid false confidence from ignored `wrangler.toml` fields.

## Scope

In scope: documenting where Pages API rate limiting is configured, how operators should change it, and verification expectations after deploy.

Out of scope: creating or editing Cloudflare dashboard WAF/Rate Limiting rules in this repository change; Workers-only `[[ratelimits]]` bindings for non-Pages deployments.

## Current known truth

| Layer | Status |
| --- | --- |
| `wrangler.toml` `[[ratelimits]]` | **Not used.** Pages build warns `Unexpected fields ... "ratelimits"` and ignores the key (#527). |
| `functions/api/_middleware.ts` | Optional: if `env.API_RATE_LIMITER.limit` exists, applies limits on mutating sensitive API routes; otherwise continues (graceful degrade). |
| Cloudflare dashboard Rate Limiting / WAF | **Intended authoritative enforcement** for the public Pages site. |

## Steps

1. Prefer creating or adjusting **dashboard** Rate Limiting / WAF rules for the Production hostname (and Preview if separately required).
2. Do **not** re-add `[[ratelimits]]` to `wrangler.toml` for this Pages project unless Cloudflare Pages documents support for that binding and Pages builds stop warning.
3. Keep middleware optional so missing bindings do not break deploys.
4. Changes that alter shared Production abuse controls require `protected-change-review` when they mutate live dashboard rules or introduce a new shared limiter namespace.

## Verification

- Pages build log: no `Unexpected fields ... "ratelimits"` warning.
- After dashboard rules exist: exercise a bounded write burst against a sensitive API and confirm 429 / rule counters (operator evidence).
- Smoke: public GET routes still return 200 after deploy.
