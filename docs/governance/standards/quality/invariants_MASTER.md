---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# Quality — Invariants

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Define the non-negotiable invariants that must remain true in production.

## Primary invariants (authoritative references)
- Routes and auth boundaries: `/docs/reference/design/LGFC-Production-Design-and-Standards.md`
- Canonical navigation: `docs/reference/design/LGFC-Production-Design-and-Standards.md` (or `LGFC-Production-Design-and-Standards.md` as present)

## Governance invariants
- Exactly one intent label per PR.
- Drift gates must enforce file-touch allowlists.
- No unreviewed scope expansion.

## UX invariants (examples; confirm against design docs)
- Public header variant (logged out vs logged in).
- FanClub header variant.
- Logo always links to `/`.
- Footer link order and content.

## Platform invariants
- Cloudflare Pages build remains within defined constraints (see `/docs/governance/PR_GOVERNANCE.md`).
- No unapproved runtime/framework swaps.

## How invariants are enforced
- Authoritative docs define them.
- CI verifies them where possible.
- Operations verifies them post-merge using `/docs/governance/verification-criteria_MASTER.md`.

## Change rule
If an invariant must change:
- Update the authoritative design/governance doc first.
- Then implement in a scoped PR referencing that exact section.
