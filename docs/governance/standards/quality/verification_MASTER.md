---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# Quality — Verification Procedure

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Provide a repeatable verification procedure used after changes and during incident recovery.

## Verification procedure (Day-2)
1) CI verification
- Confirm all checks are green.
- Confirm intent label matches file changes.

2) Deploy verification
- Confirm Cloudflare Pages deploy succeeded.
- If preview is used, confirm preview deploy.

3) Runtime verification
- Check `/` and `/health`.
- Check canonical public routes.
- Validate `/fanclub/**` gating behavior.
- Validate header/footer invariants.

4) Evidence capture
- Record verification commands + outcomes in PR.
- For significant changes, append to `/docs/ops/deploy-log.md`.

## Pass/fail policy
- If any required check fails: do not merge.
- If post-merge verification fails: revert immediately.

## References
- `/docs/governance/verification-criteria_MASTER.md`
