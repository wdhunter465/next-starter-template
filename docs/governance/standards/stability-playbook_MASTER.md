---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# Governance — Stability Playbook

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Provide the operational playbook used to keep production stable, detect regressions early, and restore last-known-good state quickly.

## Stability principles
- Prefer rollback over debugging in production.
- Minimize blast radius: smallest change, smallest scope.
- Verify using repeatable commands and observable outputs.
- Documentation is operational infrastructure.

## Monitoring (minimum)
Operations must continuously be able to validate:
- Public site returns HTTP 200 and expected headers.
- `/health` is reachable and returns success.
- Auth redirects for `/fanclub/**` behave correctly.
- Deploy pipelines (Cloudflare Pages + GitHub Actions) are green.

## Change safety gates
Before merge:
- Drift gates must pass for the selected intent label.
- Required tests must pass (see `/docs/quality/tests_MASTER.md`).
- Verification plan is written in the PR.

After merge:
- Execute the verification checklist (see `/docs/governance/verification-criteria_MASTER.md`).

## Known high-risk areas
- Navigation invariants and routing.
- Auth gating for `/fanclub/**`.
- Cloudflare build configuration and Node runtime changes.
- CI governance (intent labels, allowlists, drift-gate scripts).

## When to stop and revert
Revert immediately if:
- Cloudflare deploy fails.
- Core routes regress.
- Drift gates were bypassed or incorrectly configured.
- A security-sensitive route is exposed or behavior changes unexpectedly.

## Post-incident follow-up (required)
- Record a postmortem under `/docs/postmortems/`.
- Add a prevention gate (test, CI rule, invariant, or verification step).
