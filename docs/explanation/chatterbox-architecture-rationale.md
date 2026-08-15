---
Doc Type: Explanation
Audience: Human + AI implementation agents
Authority Level: Controlled
Owns: Architecture rationale and design tradeoffs for the #3415 Chatterbox prototype
Does Not Own: Field-by-field schema (see chatterbox-event-schema.md); operating steps (see chatterbox-operate-a-room.md); authority boundary (see chatterbox-authority-boundary.md)
Canonical Reference: /docs/explanation/chatterbox-architecture-rationale.md
Related Issues: #3415
Last Reviewed: 2026-08-15
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
`chatterbox_claims(task_id) WHERE status = 'ACTIVE'` (migration 0050): the
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

## Why authentication is a dedicated Preview `ADMIN_TOKEN`, not per-agent tokens

Per-agent identity tokens are the right end state (flagged explicitly as an
open Product decision in the #3415 launch package: "confirm claim-authority
token issuance for non-Claude, non-Cursor participants"). This slice still
does not provision per-agent credentials — the `participant_key` field in
every request body identifies who is acting for logging/audit/claim-ownership
purposes, while all requests share one admin-level gate. This is a
deliberate, named scoping choice for the prototype, not a silent security
shortcut — real per-agent tokens are the explicit next step before any use
beyond synthetic/sandbox testing.

The Development integration check and the GitHub ingestion workflow (work
units 5 and 6, below) read their token from the `CHATTERBOX_PREVIEW_ADMIN_TOKEN`
repository secret — a credential Bill provisioned specifically for
Chatterbox (2026-08-15), setting its value as the `ADMIN_TOKEN` in Cloudflare
Pages' own Preview environment. This closes the earlier name-vs-scope gap:
both workflows previously reused the repository's general-purpose shared
`ADMIN_TOKEN` secret, where the secret's *name* was confirmed but its
*environment scope* could not be — per the Preview-isolation audit cited
above, a Production-scoped value under a Preview-sounding name would have
been undetectable by either workflow. `CHATTERBOX_PREVIEW_ADMIN_TOKEN`'s
name states its own scope directly, and its value was deliberately set
against Cloudflare's Preview environment specifically, not inferred from a
shared secret used by unrelated Production-facing routes.

## Why the Development integration proof runs against the real deployment, not a mock

`scripts/ci/chatterbox_dev_integration_check.mjs` exercises the live,
deployed API end-to-end — real HTTP calls, real D1 writes (Development
only), real concurrency between two genuinely simultaneous requests. That is
deliberate: this repository has zero D1 mocks across its existing 1,500+
tests, and the actual atomicity guarantee this prototype depends on (the
partial unique index on `chatterbox_claims`) is a property of real SQLite/D1
semantics that a hand-rolled fake could not reliably reproduce. A local test
of this script's own control flow does exist
(`tests/chatterbox-dev-integration-check.test.mjs`), backed by an in-memory
fake HTTP layer that reuses the same already-unit-tested pure business logic
— but that fake exists to catch bugs in the *script itself* (and did, twice,
during development) before spending a live dispatch cycle. It is explicitly
not offered as proof of the database-level guarantee; only a real dispatch
against Development D1 is.

## Why the Development integration check targets a known URL, not an API-resolved one

Cloudflare's branch-alias hostname sanitization (lowercasing, replacing
non-alphanumeric characters, truncating to a fixed length) is undocumented
enough in practice that guessing a `pages.dev` hostname without confirming
it risks a silent, permanent mismatch — `scripts/ci/chatterbox_resolve_preview_url.mjs`
was originally built to ask the Cloudflare API directly for the most recent
successful deployment on the target branch instead of guessing, using the
same `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` secrets already used by
the existing D1 write tooling.

That script is still correct and still used by the GitHub-linking ingestion
workflow (work unit 5, below), which stays `workflow_dispatch`-only and
deferred to Graduation regardless. For the Development integration check
(work unit 6), Bill gave a more specific instruction (2026-08-15): use only
`CHATTERBOX_PREVIEW_ADMIN_TOKEN` for this testing, not `CLOUDFLARE_API_TOKEN`
or any other secret. So instead of resolving the branch's Preview alias via
the Cloudflare API at run time, the workflow now targets the alias directly
— confirmed once against the live Cloudflare dashboard (2026-08-15) as
`component-chatterbox-prototy.next-starter-template-6yr.pages.dev`, matching
the same truncation pattern the resolver script exists to avoid guessing at.
Cloudflare keeps this alias pointed at the branch's latest successful
deployment automatically, so it does not need re-resolving on every run —
only if Cloudflare's aliasing behavior for this branch ever changes, at
which point the workflow's `preview_url` input (`workflow_dispatch` only)
or the `DEFAULT_PREVIEW_URL` step env (both triggers) would need updating.

## What this prototype deliberately does not attempt

ACK-stage tracking, the cause→effect reconciler, an MCP interface, and any
notification adapter beyond what Claude Code Remote sessions already provide
natively remain out of scope for this prototype, per the launch package's
own MVP boundary — not omissions discovered late. Building coordination
correctness first, before orchestration sophistication, is the explicit
ordering #3415 itself asks for ("prove communication and coordination
before sophisticated orchestration").
