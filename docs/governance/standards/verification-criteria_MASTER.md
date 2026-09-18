---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# Governance — Verification Criteria

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Define the minimum verification requirements that must be satisfied for production changes, and the evidence that must be recorded.

## Verification levels
### Level 0 — Docs-only
- Validate links, references, and file paths are correct.
- Ensure no operational instructions contradict authoritative standards.

### Level 1 — CI/Build
- GitHub Actions checks must pass (drift gates, lint/build/test as applicable).
- Cloudflare Pages preview (if enabled) must deploy successfully.

### Level 2 — Runtime smoke
Minimum post-merge checks:
- `/` returns 200
- `/health` returns success
- Canonical public routes resolve (per NAVIGATION invariants)
- `/fanclub/**` unauth redirects to `/`
- Logged-in vs logged-out header variants behave as specified

### Level 3 — Incident regression checks
When changes relate to an outage/regression:
- Reproduce the failure on the pre-fix version (where feasible).
- Demonstrate the fix.
- Add a prevention gate (test/invariant/CI rule).

## Evidence recording
Evidence must live in the repo:
- PR description includes verification commands and observed outcomes.
- If operationally significant, add notes to `/docs/ops/deploy-log.md`.
- If incident: add a postmortem doc.

## Fail policy
If verification is incomplete:
- Do not merge.
If regression is observed after merge:
- Revert immediately.
