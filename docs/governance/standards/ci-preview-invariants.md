---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# CI Preview Invariants (Cloudflare Pages)

## Purpose
Repository-only checks (lint/build/path allowlists) do not prove the deployed website behaves correctly.
This repo includes a CI gate that validates the *deployed preview* for each PR using Playwright invariants.

## What CI Enforces
- Core public routes load (no 404/blank)
- `/health` responds OK
- Auth-gated routes do not expose protected content when logged out
- Header/footer contain required navigation targets (sanity)

## What CI Does NOT Enforce
- Pixel-perfect visual design
- Content completeness beyond invariants
- Manual review outcomes
- Production URL correctness (preview job targets PR preview deployments)

## How Preview URL Resolution Works
The workflow polls GitHub for a Cloudflare Pages preview URL using:
1) PR comments (Cloudflare bot often posts a preview URL)
2) Check-run output on the PR head SHA
3) Deployment status metadata (best effort)

If no preview URL is found within 20 minutes, the job fails.
