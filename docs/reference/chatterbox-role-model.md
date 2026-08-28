---
Doc Type: Reference
Audience: Human + AI implementation agents
Authority Level: Controlled
Owns: Chatterbox role_class values, their capability summaries, the system_clerk event-type boundary, and the pmo/product_authority force-release boundary
Does Not Own: The authority actually attached to a role (repository governance defines that — see chatterbox-authority-boundary.md); the event/task schema (see chatterbox-event-schema.md)
Canonical Reference: /docs/reference/chatterbox-role-model.md
Related Issues: #3415, #3579, #3794
Last Reviewed: 2026-08-27
---

# Chatterbox role model

Chatterbox **records and exposes** role assignments (issue #3415, comment
5280229024). It does not invent the authority attached to a role — that
comes from repository governance and the controlling GitHub Issues, cited
via each participant's `source_authority` field.

## Role classes

`chatterbox_participants.role_class` accepts exactly these values
(`ROLE_CLASSES` in `functions/_lib/chatterbox.ts`), unchanged from the
original prototype:

| `role_class` | Represents |
| --- | --- |
| `product_authority` | Records protected Product decisions. Not interchangeable with `pmo`. |
| `pmo` | Publishes/maintains the task graph, assigns eligibility, accepts/reworks, releases successors, routes Product decisions, and is the target role for the #3794 PMO action queue. |
| `implementation_agent` | Claims authorized implementation work, executes against the governing GitHub Issue, reports status/completion. |
| `engineering_validation` | Technical design/architecture reconciliation, implementation review, finalizing a design after early implementation resolves unknowns. |
| `independent_verifier` | Validates evidence or implementation where separation of duties is required. |
| `preparation_research` | Prepares/reconciles requirements/evidence without acquiring implementation authority. |
| `system_clerk` | Deterministic administration only (e.g. a GitHub Actions identity). See the boundary below. |

A participant is registered with exactly one `role_class` in this package.
Multi-role participation is not yet modeled — registering the same
real-world agent under two `participant_key`s is today's workaround, an
explicit v2 gap, not a silent limitation.

## Assignment record fields

Unchanged from the original prototype: `participant_key`, `role_class`,
`assigned_by`, `source_authority` (both required at registration —
`POST /api/chatterbox/participants` rejects a request missing either),
`effective_at` / `revoked_at`, `capability_summary`.

**New in #3794:** registration optionally accepts a `credential` (at least
16 characters); its SHA-256 hash is stored as `credential_hash` and never
the token itself. A participant registered without one has no direct
credential and can only act through the bridge relay path — a deliberately
safer default, not a new gap (the relay's self-declared trust model already
existed; see `chatterbox-event-schema.md`'s Auth model section).

## The `system_clerk` boundary

Unchanged and still the one role class with a mechanically enforced
restriction, not just a documented one. `SYSTEM_CLERK_ALLOWED_EVENT_TYPES`
in `functions/_lib/chatterbox.ts` limits a `system_clerk` participant to
posting `STATUS`, `SYSTEM`, `CHECK_IN`, and `CHECK_OUT` events. `POST
/api/chatterbox/events` returns `403` if a `system_clerk` participant
attempts `COMPLETE`, `PMO_ACCEPT`, or `DECISION_RECORDED`.

The #3794 reconciliation sweep (`POST /api/chatterbox/reconcile`) posts its
escalation events as a registered `system_clerk` participant for exactly
this reason: `SYSTEM` is one of the types that role is structurally allowed
to post, and the sweep only ever executes an already-authorized transition
(expiring an overdue action, flagging it), never a substantive PMO/Product
decision.

## The `pmo` / `product_authority` force-release boundary (#3794 JULES-5)

New in this package: `POST /api/chatterbox/release` permits a participant
whose `role_class` is `pmo` or `product_authority` to release *any*
participant's active claim, not only their own — but only with a non-empty
`reason` in the request body. The release is recorded as an auditable
`RELEASE` event naming the forcing participant and the reason, targeted at
the original claimant (`canForceRelease` in `functions/_lib/chatterbox.ts`).

This is a controlled override, not automatic reclamation: `isClaimStale`
(same file) only *flags* a claim whose lease (`renewed_at`) is older than a
threshold — matching #3415's own caution that "a stale claim must be
flagged for reconciliation rather than blindly reassigned." Nothing in this
package reassigns a claim on a timer; a `pmo`/`product_authority`
participant must still act, and must still give a reason.

This mirrors, at the Chatterbox layer, the same class of structural
boundary GitHub itself already enforces for self-approval. The rule from
#3415 remains: **a clerk may execute an already-authorized transition; it
may not decide a substantive PMO/Product transition.** See
chatterbox-authority-boundary.md for the full non-authority list this
applies to beyond just event types and claim release.
