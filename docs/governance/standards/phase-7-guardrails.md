---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# Phase 7 — Guardrails & Drift Prevention (LGFC-Lite)

## Goal
Prevent repeat regressions and CI / deployment drift. Make the repo predictable.

## Guardrails in scope
1) **Single authoritative build path**
   - Cloudflare Pages build command: `npm run build:cf`
   - Output directory: `out`
   - Next.js export via `output: "export"` in `next.config.ts`

2) **Environment enforcement**
   - Runtime (Pages Functions) fails fast on missing required email vars when email is enabled.

3) **Secret scanning**
   - Gitleaks workflow runs on PR/push.
   - Custom config ignores known safe templates and documentation paths.
   - Real secrets still fail CI.

4) **Rollback anchor**
   - Always keep a known-good commit SHA.
   - Rolling back is: revert PR or reset to the SHA and redeploy Cloudflare Pages.

## What “done” looks like
- No duplicate / stale workflow definitions.
- CI is quiet when repo is clean.
- CI is loud only when something is actually wrong (lint/typecheck/tests/secrets).
- Cloudflare deploys stop surprising you.

## /admin Route Security
`/admin` is 404 in-app for all users. Admin/mod access is enforced via Cloudflare Access (email allow-list) when enabled.
