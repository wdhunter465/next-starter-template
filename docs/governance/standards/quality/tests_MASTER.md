---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# Quality — Required Tests

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Define the minimum required tests and checks for Day-2 operations to maintain production stability.

## Required checks for all PRs
- GitHub Actions checks must pass.
- Drift gate for the PR’s intent label must pass.
- Build must succeed.

## Required checks for UI/route changes
- Verify canonical routes still resolve.
- Verify auth redirects for `/fanclub/**`.
- Verify header/footer variants.

## Required checks for CI/governance changes
- Verify new rules trigger on a controlled test PR.
- Verify they do not block legitimate changes for the intended label.

## Runtime smoke tests (post-merge)
- GET `/`
- GET `/health`
- GET key public pages per navigation invariants
- Verify auth gate behavior

## References in repo
- `/docs/TESTS_REQUIRED.md` (existing baseline list)
- `/tests/api/README.md` (API test guidance)
