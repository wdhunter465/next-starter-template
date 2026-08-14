---
Doc Type: Reference
Audience: Human + AI implementation agents
Authority Level: Controlled
Owns: Chatterbox role_class values, their capability summaries, and the system_clerk event-type boundary
Does Not Own: The authority actually attached to a role (repository governance defines that — see chatterbox-authority-boundary.md); the event/task schema (see chatterbox-event-schema.md)
Canonical Reference: /docs/reference/chatterbox-role-model.md
Related Issues: #3415
Last Reviewed: 2026-08-14
---

# Chatterbox role model

Chatterbox **records and exposes** role assignments (issue #3415, comment
5280229024). It does not invent the authority attached to a role — that
comes from repository governance and the controlling GitHub Issues, cited
via each participant's `source_authority` field.

## Role classes

`chatterbox_participants.role_class` accepts exactly these values
(`ROLE_CLASSES` in `functions/_lib/chatterbox.ts`):

| `role_class` | Represents |
| --- | --- |
| `product_authority` | Records protected Product decisions. Not interchangeable with `pmo`. |
| `pmo` | Publishes/maintains the task graph, assigns eligibility, accepts/reworks, releases successors, routes Product decisions. |
| `implementation_agent` | Claims authorized implementation work, executes against the governing GitHub Issue, reports status/completion. |
| `engineering_validation` | Technical design/architecture reconciliation, implementation review, finalizing a design after early implementation resolves unknowns. |
| `independent_verifier` | Validates evidence or implementation where separation of duties is required. |
| `preparation_research` | Prepares/reconciles requirements/evidence without acquiring implementation authority. |
| `system_clerk` | Deterministic administration only (e.g. a GitHub Actions identity). See the boundary below. |

A participant is registered with exactly one `role_class` in this prototype.
Multi-role participation (issue #3415: "one agent may possess multiple
capabilities where governance permits") is not yet modeled — registering the
same real-world agent under two `participant_key`s is today's workaround,
and is an explicit v2 gap, not a silent limitation.

## Assignment record fields

Every `chatterbox_participants` row is a durable assignment record, per the
minimum fields issue #3415 (comment 5280229024) specifies:

- `participant_key` — identity.
- `role_class` — the class from the table above.
- `assigned_by` — who authorized this assignment.
- `source_authority` — the repository-governance record that permits it
  (an Issue, a rules doc path — not "trust me").
- `effective_at` / `revoked_at` — a revoked participant (`revoked_at` set) is
  excluded from every read and write path; there is no soft "inactive but
  still visible" state in this prototype.
- `capability_summary` — free-text, optional.

`assigned_by` and `source_authority` are required at registration
(`POST /api/chatterbox/participants` rejects a request missing either) —
Chatterbox will not record an assignment with no cited authority behind it.

## The `system_clerk` boundary

This is the one role class with a mechanically enforced restriction, not
just a documented one. `SYSTEM_CLERK_ALLOWED_EVENT_TYPES` in
`functions/_lib/chatterbox.ts` limits a `system_clerk` participant to
posting `STATUS`, `SYSTEM`, `CHECK_IN`, and `CHECK_OUT` events. `POST
/api/chatterbox/events` returns `403` if a `system_clerk` participant
attempts `COMPLETE`, `PMO_ACCEPT`, or `DECISION_RECORDED` — the three event
types that represent a substantive PMO/Product transition.

This mirrors, at the Chatterbox layer, the same class of structural
boundary GitHub itself already enforces for self-approval (a bot identity
attempting to approve its own pull request is rejected by the platform, not
by policy alone). The rule from #3415: **a clerk may execute an
already-authorized transition; it may not decide a substantive PMO/Product
transition.** See chatterbox-authority-boundary.md for the full non-authority
list this applies to beyond just event types.
