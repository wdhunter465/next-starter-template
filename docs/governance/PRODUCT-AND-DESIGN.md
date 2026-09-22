---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Product behavior ownership, UX and functional-requirement decision rules, design freeze and deviation policy, and product/design escalation boundaries
Does Not Own: Agent team approval routing, delivery Model A/B selection, platform/runtime isolation, CI gate implementation, or page-level visual specifications
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2687, #2686, #4174, #4213
Last Reviewed: 2026-09-22
---

# Product and Design

## Purpose

This document is the canonical **Product and Design** domain policy. It defines who owns product and design decisions, how locked design is frozen or adjusted, when deviations are allowed, and how conflicts escalate.

Detailed production behavior, routes, navigation, auth UX contracts, and page specifications live under `docs/reference/design/**`. Those files are **supporting specifications**, not co-owners of this domain policy.

Agent roles and protected-stop contracts remain in `docs/governance/AGENT-TEAM.md`. Delivery model selection remains in `docs/governance/PMO-PORTFOLIO.md` and `docs/governance/DELIVERY-AND-RELEASE.md`.

## Role-based ownership

| Role | Actor | Owns in this domain |
| --- | --- | --- |
| **Product Authority** | Current holder in `docs/governance/AGENT-TEAM.md` | Product go/no-go; material UX or functional-requirement decisions; final completed-product judgment for product outcomes |
| **PMO Admin** | Current holder in `docs/governance/AGENT-TEAM.md` | Final design package authorship; launch-control packaging; design documentation completeness |
| **Implementation / Operations** | Current holder in `docs/governance/AGENT-TEAM.md` | Scoped implementation of approved product/design work; no self-approval of product or design authority |
| **PR Approver / Engineering** | Current holder in `docs/governance/AGENT-TEAM.md` | Independent review of product/design PRs per delivery profile; not a substitute for Product Authority on material product decisions |
| **CMO** | Current holder in `docs/governance/AGENT-TEAM.md` (unassigned until recorded) | Merge approval when Product Authority is unavailable; may not approve own implementation |
| **Supporting design references** | `docs/reference/design/**` and `docs/governance/standards/design-authority_MASTER.md` | Locked behavior facts, page/route contracts, and enforcement pointers only |

Rules:

- Product Authority decisions recorded in the repository outrank competing design commentary in issues, PRs, chat, or agent memory.
- PMO Admin authors and maintains the design documentation package; Implementation / Operations implements within the approved allowlist.
- Implementation / Operations must not invent product direction, unlock frozen design, or treat supporting specs as independent policy owners.
- Supporting design references must cite this domain policy (directly or through the production design standards hub) and must not restate competing domain ownership.

## Authority stack inside this domain

When product or design sources conflict inside this domain, resolve in this order:

1. Locked Product Authority decisions recorded on the source Issue or PR (or an approved design lock)
2. This domain policy (`docs/governance/PRODUCT-AND-DESIGN.md`)
3. Primary production behavior specification: `docs/reference/design/LGFC-Production-Design-and-Standards.md`
4. Topic-specific supporting specs under `docs/reference/design/**` (for example auth, homepage, FanClub, Join/Login)
5. Source GitHub issue allowlist and acceptance criteria for the active task
6. Historical explanation or evolution notes (non-binding)

`docs/governance/standards/design-authority_MASTER.md` is an enforcement and routing aid only. It does not own product or design policy.

## Decision rules

| Decision class | Authority | Required record |
| --- | --- | --- |
| New product capability or user-facing behavior | Product Authority go/no-go; PMO Admin packages design | Source issue + design package |
| Locked route, navigation, header, footer, auth, or Store invariant | PMO Admin updates supporting design specs first; Product Authority when material | Updated supporting spec section cited by implementation PR |
| Visual or copy change within an unlocked surface | PMO Admin design package or explicit issue authorization | Source issue allowlist |
| Platform/runtime hosting model that affects UX contracts | Product Authority + Platform domain (do not resolve here alone) | Cross-domain disposition on the source issue |
| Emergency product/UX rollback | Operations and Recovery path; Product Authority for lasting product change | Incident/source issue disposition |

No agent may treat an implementation convenience, screenshot, prior PR, or draft comment as a product decision.

## Freeze rules

A product or design surface is **frozen** when any of the following is true:

- The supporting design document marks the invariant as LOCKED.
- Product Authority has recorded a lock or freeze decision on the source issue or approved design lock file.
- The production design standards document lists the behavior as canonical production behavior.

While frozen:

- Implementation may repair drift back to the locked specification.
- Implementation may not redesign, reorder, relabel, or replace the frozen surface without an authorized adjustment.
- “Nice to have” redesign must not ride along with ops, CI, docs, or bugfix PRs.

## Adjustment rules

An adjustment updates locked product or design authority before or with implementation.

Required sequence:

1. Confirm Product Authority is required (material change) or that PMO Admin may author a non-material documentation correction within existing Product Authority intent.
2. Update the owning supporting specification under `docs/reference/design/**` (and this domain policy only when ownership or decision rules change).
3. Cite the exact updated section(s) from the implementation PR.
4. Keep the diff inside the source-issue allowlist.

Adjustment PRs that change locked UX or functional requirements without updating the supporting specification are out of process.

## Deviation rules

A **deviation** is temporary permission to ship while a supporting specification and implementation remain intentionally mismatched.

Deviations require:

- explicit Product Authority or PMO Admin authorization on the source issue;
- a named follow-up issue or acceptance criterion to close the gap;
- no silent expansion of the mismatch beyond the recorded bound.

Unauthorized deviation is drift. Drift must be corrected to the locked supporting specification or escalated.

## Escalation rules

Stop and escalate to Product Authority, with PMO Admin as process partner, when:

- two active product/design sources disagree and the source issue does not resolve precedence;
- a material UX, route, auth, navigation, or acceptance-framing decision is unresolved;
- an approved design cannot satisfy acceptance criteria without replanning;
- a requested change would unlock or rewrite frozen production behavior without recorded Product Authority intent.

Routine wording fixes, reference routing corrections, validation remediation, and bounded allowlist implementation are not escalation events.

## Approval rules

| Change type | Design-doc update first? | Approval |
| --- | --- | --- |
| Docs-only supporting-spec correction aligned to existing Product Authority intent | Yes (the docs PR is the change) | PMO Admin; CMO may merge if Product Authority is unavailable and a CMO holder is recorded |
| Implementation matching already-locked supporting specs | No additional design ownership change | Per delivery profile (`docs/governance/DELIVERY-AND-RELEASE.md`) |
| Material product/UX change | Yes | Product Authority go/no-go, then PMO Admin review/merge |
| Component-child drafting under an authorized Model B program | Per child allowlist | Component auto-integration only when the child profile allows it; does not activate `main` policy alone |

Implementation / Operations never self-approves product or design authority.

## Supporting specification map

| Topic | Supporting owner (non-policy) |
| --- | --- |
| Production behavior hub | `docs/reference/design/LGFC-Production-Design-and-Standards.md` |
| Auth/session and auth redirects | `docs/reference/design/auth-model.md` |
| Join/Login UI | `docs/reference/design/join-login.md` |
| Homepage layout | `docs/reference/design/home.md` |
| FanClub area | `docs/reference/design/fanclub.md` and related FanClub specs |
| Style tokens and visual language | `docs/reference/design/style-guide.md` |
| Design-lock records | `docs/reference/design/locks/**` |
| Enforcement pointer (non-owner) | `docs/governance/standards/design-authority_MASTER.md` |

Page and feature specs under `docs/reference/design/**` may be LOCKED as behavior facts. LOCKED means the specification is frozen for implementation; it does not make that file a Domain Policy co-owner.

## Drift detection

A change is product/design drift when it:

- alters a locked invariant without updating the owning supporting specification;
- treats a supporting specification as higher authority than this domain policy or Product Authority;
- changes header, footer, navigation, route, auth, or Store behavior without explicit source-issue authorization;
- introduces competing “this file wins” domain-policy language outside this document’s authority stack.

## Canonical references

| Topic | Owner |
| --- | --- |
| Repository precedence | `docs/governance/REPOSITORY-AUTHORITY.md` |
| Agent roles and protected stops | `docs/governance/AGENT-TEAM.md` |
| Delivery approval profiles | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Production design behavior hub | `docs/reference/design/LGFC-Production-Design-and-Standards.md` |

## Supersession

Within the Product and Design domain, this file supersedes competing domain-policy claims previously implied by:

- `docs/governance/standards/design-authority_MASTER.md` as a policy owner;
- “this document wins” / independent SOURCE OF TRUTH framing in `docs/reference/design/**` that competed with domain ownership.

Those files remain active as supporting specifications or enforcement pointers after subordination. Shared constitutional routing updates outside this allowlist are reserved for #2690.
