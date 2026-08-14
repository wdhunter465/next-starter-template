---
Doc Type: Explanation
Audience: Human + AI implementation agents
Authority Level: Controlled
Owns: Architecture rationale and design tradeoffs for the #3415 Chatterbox prototype
Does Not Own: Field-by-field schema (see chatterbox-event-schema.md); operating steps (see chatterbox-operate-a-room.md); authority boundary (see chatterbox-authority-boundary.md)
Canonical Reference: /docs/explanation/chatterbox-architecture-rationale.md
Related Issues: #3415
Last Reviewed: 2026-08-14
---

# Chatterbox architecture rationale

## Why reuse this repository's D1/Workers stack instead of a new service

Zero incremental cost was a stated #3415 constraint. New `chatterbox_*`
tables on the already-provisioned Development D1 database and new
`functions/api/chatterbox/**` Pages Functions routes on the
already-provisioned Workers deployment need no new vendor, no new hosting,
and no new credential. A standalone service would need all three before a
single line of coordination logic exists. This tradeoff holds only for the
prototype's scope — any future push/notification adapter beyond what an
agent's own runtime already provides is a separate, later, explicitly
protected cost decision, not implied by this choice.

## Why the claim is enforced by a database constraint, not application logic

`canClaim()` in `functions/_lib/chatterbox.ts` is a pure precondition check
— it rejects a claim on a task that is not `AVAILABLE` or has unsatisfied
dependencies, with a specific reason. It is deliberately **not** the source
of the atomicity guarantee. Two application processes both observing
`AVAILABLE` and both deciding to write is a real race that a check-then-act
pattern cannot close. The actual guarantee is the partial unique index on
`chatterbox_claims(task_id) WHERE status = 'ACTIVE'` (migration 0046): the
database itself rejects the second concurrent insert. This mirrors an
already-proven pattern in this repository — `content_inventory`'s
canonical-tag partial unique index enforces "one canonical row per tag" the
same way, at the same layer, for the same reason.

## Why catch-up is a bounded digest, not a replay

A room meant to span a full program lifecycle (per #3415's own framing)
accumulates far more events than fit in one useful read, especially for a
context-limited agent checking in after days away. `buildCatchUpDigest`
returns open questions addressed to the caller (regardless of how old),
recent PMO instructions (capped), and a capped raw tail — with an accurate
`unreadCount` even when the tail itself is truncated. The alternative —
replay everything since the last checkpoint — degrades linearly with room
age and eventually exceeds what any participant can usefully consume in one
check-in. Compression is a first-class design requirement here, not an
optimization to add later.

## Why collision domains are ingested, not authored

This repository's PMO Issues already declare exact file-path allowlists and
serialization rules for every active component branch (e.g. "serialize any
PR touching `layout.tsx`"). `chatterbox_tasks.collision_domain` stores that
same information as a JSON array rather than inventing a second format
authors would have to keep in sync by hand. Chatterbox's role is to surface
and check what the governing Issue already says, not to become an
independent source of collision policy.

## Why REST/Pages Functions first, MCP later

Every agent participant in this ecosystem that matters for the prototype
already speaks MCP-style tool calls in its own runtime — but building an MCP
server is a thin wrapper concern, not a reason to delay the underlying
schema and claim semantics. This slice ships the REST-shaped Pages Functions
routes first (work units 1–3 from the launch package); an MCP server wrapping
the same routes is deferred to a later work unit, not abandoned.

## Why authentication is the existing shared `ADMIN_TOKEN`, not per-agent tokens

Per-agent identity tokens are the right end state (flagged explicitly as an
open Product decision in the #3415 launch package: "confirm claim-authority
token issuance for non-Claude, non-Cursor participants"). Provisioning new
credentials for this prototype would itself be a protected decision this
slice is not authorized to make. Reusing the existing `ADMIN_TOKEN` gate
(`requireAdmin`, already used by every `functions/api/admin/**` route) keeps
the API access-controlled with zero new credential provisioning, while the
`participant_key` field in every request body still identifies who is
acting for logging/audit/claim-ownership purposes. This is a deliberate,
named scoping choice for the prototype, not a silent security shortcut —
real per-agent tokens are the explicit next step before any use beyond
synthetic/sandbox testing.

## What this slice deliberately does not attempt

GitHub event ingestion beyond a citation field, ACK-stage tracking, the
cause→effect reconciler, and any notification adapter are all out of scope
for work units 1–3. Building coordination correctness first, before
orchestration sophistication, is the explicit ordering #3415 itself asks
for ("prove communication and coordination before sophisticated
orchestration").
