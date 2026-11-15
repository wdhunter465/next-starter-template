---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical CI Specification
Owns: CI/CD workflows, required checks, build/test invariants
Does Not Own: Product design; operational on-call procedures
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Last Reviewed: 2026-02-20
---

# Platform — GitHub Actions Operations

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Define how GitHub Actions is used operationally to enforce governance and to validate production readiness.

## What Actions must enforce (Day-2)
- One-PR one-intent label policy.
- File-touch allowlists per intent label (drift gates).
- ZIP safety (no ZIPs committed; history purge policy if relevant).
- Required tests and build checks.

## Where rules live
- `.github/` governance docs (maps, intent labeler config).
- Repo governance docs:
  - `/docs/governance/PR_GOVERNANCE.md`
  - `/docs/governance/pr-intent-labels.md`
  - `/docs/governance/ci-preview-invariants.md`

Operator and re-run procedure: `docs/how-to/ci/pr-gate-success-workflow.md`.

## Required documentation on changes to CI
Any CI change must include:
- What governance rule it enforces
- What files it is expected to touch
- How to verify it works
- Rollback plan (revert PR)

## References
- `/docs/governance/PR_GOVERNANCE.md`
- `.github/CI_GUARDRAILS_MAP.md`
