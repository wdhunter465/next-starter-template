---
Doc Type: Governance
Audience: Human + AI implementation agents, PMO, Product Authority
Authority Level: Controlled
Owns: What the #3415 Chatterbox prototype does and does not provide, the system_clerk structural boundary, and protected stops for this component
Does Not Own: Repository-wide agent/PMO governance (see docs/governance/AGENT-TEAM.md and related repository authority docs, which this component does not supersede or duplicate)
Canonical Reference: /docs/governance/chatterbox-authority-boundary.md
Related Issues: #3415
Last Reviewed: 2026-08-15
---

# Chatterbox authority boundary

Chatterbox coordinates authority; it does not create authority (#3415).
Everything below restates and mechanically enforces, at the Chatterbox
component level, boundaries repository governance already establishes
elsewhere. This document does not introduce new authority of its own.

## What Chatterbox provides

- A persistent, append-only room conversation per GitHub program/project.
- Participant identity and role-class visibility (`chatterbox-role-model.md`).
- An ingested (not authored) task graph with atomic claim/release.
- Durable questions/answers/status/completion events, with a citation field
  (`github_ref`) back to the exact Issue/PR/comment/SHA they concern.
- A bounded check-in / catch-up digest.

## What Chatterbox does not provide

- It does not replace GitHub Issues/PRs as the system of record or evidence
  source. A Chatterbox message never substitutes for a required GitHub
  Issue/PR update (#3415).
- It does not author repository governance, PMO rules, or role authority —
  every participant's `source_authority` field must cite an existing
  governance record; Chatterbox stores the citation, it does not become one.
- It does not grant implementation, merge, Production, publication,
  credential, or spending authority.
- It does not auto-graduate Pipeline work or decide Product/PMO judgments.
- It does not currently ingest live GitHub Issue/PR state automatically
  (deferred; see chatterbox-architecture-rationale.md).

## The `system_clerk` structural boundary

Repository governance already draws this line in prose: "Actions may
execute an already-authorized transition; Actions may not decide a
substantive PMO/Product transition" (#3415). Chatterbox enforces it
structurally for the one role class meant to represent deterministic
automation:

- `POST /api/chatterbox/events` returns `403` if a participant with
  `role_class = 'system_clerk'` attempts `event_type` `COMPLETE`,
  `PMO_ACCEPT`, or `DECISION_RECORDED` — checked server-side
  (`isSystemClerkEventAllowed` in `functions/_lib/chatterbox.ts`), not left
  to caller discipline.
- A `system_clerk` participant may post `STATUS`, `SYSTEM`, `CHECK_IN`, and
  `CHECK_OUT` only.

This is a policy-shaped rule enforced as code, not just documentation — the
same class of guarantee this repository already gets for free from GitHub
itself rejecting a bot's self-approval on its own pull request. A rule that
depends on the constrained actor choosing to honor it has a track record of
being violated by exactly that actor; this boundary does not depend on that.

## Protected stops (this component)

- No Production D1 write. All `chatterbox_*` tables and every route above
  are exercised in isolated Development D1 only during the prototype phase,
  per this repository's standing Production-protection rule — the same
  boundary every other D1 initiative in this repository observes, not a
  Chatterbox-specific exception.
- No credential/vendor commitment for any notification/push adapter.
- No autonomous PMO or Product decision performed by any Chatterbox
  automation (there is no reconciler yet to make this concrete, but the
  boundary is stated in advance of building one).
- No self-approval/self-merge by any Chatterbox-authored automation.

## Credential confirmation: `CHATTERBOX_PREVIEW_ADMIN_TOKEN`

The Development integration check (work unit 6) and GitHub ingestion (work
unit 5) workflows both call the deployed API using the
`CHATTERBOX_PREVIEW_ADMIN_TOKEN` repository secret — a credential Bill
provisioned specifically for Chatterbox (2026-08-15), reusing the same
`requireAdmin` contract every `functions/api/admin/**` route already relies
on, but under a name that declares its own scope rather than the earlier
shared, general-purpose `ADMIN_TOKEN` secret (rationale in
chatterbox-architecture-rationale.md).

**This closes the name-vs-scope gap the earlier shared-secret arrangement
had.** Per `docs/ops/reports/delivery-system-preview-isolation-audit.md`'s
explicit warning, Preview must carry its own `ADMIN_TOKEN` value, never
Production's — mirroring Production's value into Preview would expose the
full admin write surface against Preview D1 under a token that looks
Preview-scoped. Bill set `CHATTERBOX_PREVIEW_ADMIN_TOKEN`'s value directly
as the `ADMIN_TOKEN` configured in Cloudflare Pages' own Preview
environment (2026-08-15), rather than pointing at a shared secret whose
environment-scope had to be inferred or separately confirmed. Neither
Chatterbox workflow targets Production regardless.

**Scope tightened further (2026-08-15).** Per Bill's explicit instruction,
the Development integration check (work unit 6) now reads only
`CHATTERBOX_PREVIEW_ADMIN_TOKEN` — nothing else. It no longer reads
`CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` at all; those secrets
exist in this repository for unrelated D1/Pages tooling and are not part of
this check's credential surface, even though they were previously used to
resolve the check's target URL via the Cloudflare API. The workflow targets
the component branch's known Cloudflare Pages Preview alias directly
instead (see chatterbox-architecture-rationale.md).

## Relationship to repository-wide agent governance

This document narrows and applies existing repository rules to the
Chatterbox component; it does not create a parallel governance track. Where
this document is silent, repository-wide authority (`docs/governance/`,
`AGENTS.md`, PMO/Engineering rules) controls.
