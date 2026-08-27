---
Doc Type: Explanation
Audience: Human + AI implementation agents, PMO, Product Authority
Authority Level: Informational
Owns: Proposed redesign of Chatterbox's coordination model as a self-hosted "room actor" pattern — borrowing Cloudflare Durable Objects' architectural properties (single-writer room serialization, durable append-only event log, per-participant checkpoint, alarm-driven proactive reconciliation, dual live/poll delivery) without depending on Cloudflare's Durable Objects product; a per-participant action queue with acknowledge/expire/escalate semantics closing the historical "PMO saw it but didn't close it" gap; and the delivery-tier distinction needed to actually serve a scheduled-pull participant like ChatGPT
Does Not Own: Authorization to implement (this document proposes, per the same pattern chatterbox-notification-and-decision-design.md and chatterbox-external-design-survey.md already established — it does not authorize a branch, PR, or Production change); Chatterbox's original architecture rationale/authority boundary docs; any change to the GitHub write-credential trust boundary (`TRUSTED_ACTORS`) — that remains a separate, still-open governance decision; the knowledge/governance-Q&A retrieval layer named below, which is out of scope for this document
Canonical Reference: /docs/explanation/chatterbox-self-hosted-room-actor-redesign.md
Related Issues: #3415, #3527, #3544, #3579, #3686
Last Reviewed: 2026-08-27
---

# Chatterbox as a self-hosted room actor (no Cloudflare Durable Objects)

## Purpose

This document originates from two conversations on 2026-08-27: (1) research into how Cloudflare's own "Cloudflare AI" tooling uses Durable Objects (the Agents SDK's per-room/per-workspace actor model, SQLite storage, WebSocket Hibernation, Alarms), and (2) Bill's stated objective for what Chatterbox should actually empower the LGFC Agentic Team to do — a shared space to work, real connectivity between agents, PMO that reliably hears status and follows through on admin duties (closing/updating Issues), agents that can ask questions of the whole team and of the governance model, workflow-inhibitor identification, and a path toward a proactive rather than reactive team with near-100% uptime.

A prior Operations issue, **#3686**, already authorized adopting Cloudflare's actual Durable Objects product for this. Per Bill's direction here: that attempt is being redirected, not executed. The reasoning: building the equivalent pattern *within* infrastructure LGFC already controls (D1, Cloudflare Pages Functions, GitHub Actions) keeps full customization control and avoids Cloudflare Durable Objects' own usage limits and billing model. This document is that redesign — it borrows the *architectural properties* Durable Objects demonstrate, not the product itself.

## Scope

Covers: a self-hosted design that reproduces, on LGFC's existing Cloudflare/D1/GitHub Actions stack, the properties that made the Durable Object research relevant — single-writer room serialization, a durable ordered event log, per-participant checkpointing, scheduled proactive reconciliation, and delivery paths matched to what each participant can actually do (hold a live connection vs. poll on a fixed cadence) — plus a new mechanism, the PMO action queue, that directly targets the historical failure Bill named: work finishing without the Issue getting closed, the tracker updating, or the dashboard reflecting truth.

Does not cover: implementation, migration authorship, or any commitment to build this (see Intended final state); the knowledge/governance-Q&A retrieval layer (flagged as a separate future work unit in Layer 5); resolving the GitHub write-credential trust boundary (Layer 6, explicitly left open, same as prior Chatterbox docs).

## What #3686 got right, and what changes here

#3686 correctly identified the real gap: Chatterbox's D1-plus-stateless-functions design has no single point of coordination and no proactive/scheduled component, and #3579 separately found a real check-in race (a participant's checkpoint could advance past a concurrently-written event) and a participant-identity impersonation risk (any caller holding the shared admin token could assert any `participant_key`). Both findings are adopted unchanged below — they are true regardless of which infrastructure hosts the fix.

What changes: #3686's mechanism was "resolve `room_key` to a Cloudflare Durable Object instance." This document instead asks what property that DO would actually be providing, and reproduces each one on infrastructure LGFC already runs, with no new vendor product, limit, or subscription cost:

| Durable Object property | Why #3686 wanted it | Self-hosted equivalent used here |
|---|---|---|
| One resident actor per room, serializing all writes | Fixes the check-in race and claim-collision risk | A D1 transaction per mutating operation, using the same partial-unique-index pattern Chatterbox's claims table already proves works (`idx_chatterbox_claims_active_task`), generalized to event-sequence and checkpoint-advance writes |
| Alarms API (self-scheduled future wake) | Lets the room proactively chase non-responders / expire stale items without a human-driven session | A GitHub Actions scheduled workflow (this repo already runs several, e.g. `ops-d1-dev-migration-diagnostic.yml`) hitting a `/reconcile` endpoint on a fixed cadence |
| WebSocket Hibernation (push to connected clients, cheaply) | "Real-time" delivery for agents that can hold a connection | **Named as a genuine capability gap below, not reproduced** — see "What we give up" |
| SQLite storage private to the room, with PITR | Durable per-room state, restorable | D1 already provides durable relational storage; PITR is not reproduced (D1 does not offer point-in-time recovery at this granularity) — accepted as a known, minor loss |

## What we give up by not using an actor-hosting primitive

This needs to be said plainly rather than glossed over: Cloudflare Pages Functions are stateless and invoked per request. There is no resident process to hold a WebSocket connection open between requests the way a Durable Object can. **True push delivery is the one property this redesign cannot reproduce without hosting an always-on process somewhere** — and standing up that process is exactly the kind of new infrastructure commitment this redesign is trying to avoid.

The mitigation is the same posture Chatterbox's original MVP already took ("push is optional, pull is baseline"), sharpened by tier:

- An agent running a live, actively-working session can poll on a short interval (seconds to low minutes) and get delivery that is *practically* indistinguishable from push for coordination purposes, without needing a held-open socket.
- A participant like ChatGPT, bound to its own product's ~12-minute Watcher cadence, was never going to receive a push anyway — no infrastructure decision on Chatterbox's side changes that ceiling. What Chatterbox controls is whether what ChatGPT finds when it does check in is complete and actionable (see Layer 3).

True real-time push is named here as an explicit **non-goal for this design**, not a silent gap — if it's needed later, that is the point at which standing up an actor-hosting primitive (Cloudflare Durable Objects or otherwise) would need to be revisited on its own merits, not bundled into this redesign.

## Proposed architecture

### Layer 1 — Room event log with atomic high-watermark check-in (fixes #3579's race)

Keep the existing shape (`chatterbox_rooms`, `chatterbox_events`, `chatterbox_checkpoints`) largely as-is. Fix the specific race #3579 found: today, nothing guarantees a participant's checkpoint advance and its event-read happen against the same snapshot. Required semantics, inside one D1 transaction:

```text
BEGIN
  high_watermark := SELECT MAX(id) FROM chatterbox_events WHERE room_id = ?
  digest := SELECT * FROM chatterbox_events
              WHERE room_id = ? AND id > :last_seen AND id <= :high_watermark
              ORDER BY id
  UPDATE chatterbox_checkpoints SET last_seen_event_id = :high_watermark
              WHERE room_id = ? AND participant_id = ?
COMMIT
```

An event written after `high_watermark` was captured is, correctly, left for the *next* check-in — it cannot be silently skipped, and it cannot be double-delivered either.

### Layer 2 — Delivery tier matched to participant capability

No change to the underlying data between tiers — one event log, one queue, read two ways:

- **Tier A (frequent poller):** an agent in an active session polls the same check-in endpoint on a short interval while it's working. This is the closest approximation to real-time available without an actor-hosting primitive (see above).
- **Tier B (scheduled pull, e.g. ChatGPT's ~12-minute Watcher cadence):** `GET /api/chatterbox/queue?participant=<key>&since=<checkpoint>` — a plain HTTP endpoint, nothing ChatGPT-specific required on Chatterbox's side. What makes this "suffice for the workflow," per Bill's framing, is that the response is pre-triaged and actionable (Layer 3), not just an undifferentiated event tail.

### Layer 3 — PMO action queue with acknowledge + expiry + escalation

This is the direct answer to the failure mode Bill named: an agent finishes Issue #XYZ, but the Issue never gets closed, the tracker never updates, and the dashboard silently goes stale. The missing piece was always a distinction between *PMO saw the completion* and *PMO acted on it* — today nothing captures that distinction at all.

New table, `chatterbox_pmo_actions` (a generalization of the pending-decision record already proposed in `chatterbox-notification-and-decision-design.md`, widened from "decisions" to "required PMO follow-through"):

```sql
CREATE TABLE IF NOT EXISTS chatterbox_pmo_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES chatterbox_rooms(id),
  source_event_id INTEGER NOT NULL REFERENCES chatterbox_events(id),
  task_ref TEXT NOT NULL,                 -- e.g. the GitHub Issue number
  action_type TEXT NOT NULL CHECK (action_type IN (
    'CLOSE_ISSUE', 'UPDATE_TRACKER', 'RELEASE_SUCCESSOR', 'OTHER'
  )),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'ACKED', 'DONE', 'EXPIRED'
  )),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  completed_by_participant_id INTEGER REFERENCES chatterbox_participants(id)
);
```

Flow:

1. An agent posts a `COMPLETE` event targeting the `pmo` role class. This creates a `PENDING` row.
2. PMO's Tier B queue pull returns all `PENDING` rows for its role, sorted soonest-expiring first.
3. **The row is not cleared by being read.** PMO must call `POST /api/chatterbox/pmo-actions/:id/complete` *after* it has actually closed the Issue and updated its tracker. Read and action are different events, recorded separately — this is the one change that would have caught every historical case Bill described.
4. The scheduled sweep (Layer 4) checks for `PENDING` rows past a missed-cycle threshold (e.g. two missed Tier-B pull windows) and escalates: posts a directly-visible event to Bill, rather than letting it rot silently the way it did before.

### Layer 4 — Scheduled reconciliation sweep (the Alarm-API substitute)

A GitHub Actions scheduled workflow, running on a fixed cadence (e.g. every 15–30 minutes — cheap, already the pattern this repo uses for other ops workflows), hits a `/reconcile` endpoint that:

- Escalates any `chatterbox_pmo_actions` row still `PENDING` past its threshold (per Layer 3).
- Cross-checks any row marked `DONE` against the actual GitHub Issue state via the GitHub API — if PMO claimed `CLOSE_ISSUE` but the Issue is still open, flag the mismatch instead of trusting the self-report. This is the mechanism that makes the dashboard trustworthy again: GitHub's Issue state is the verified ground truth, Chatterbox's queue is the workflow layer on top, not a second competing bookkeeping system.
- Expires any pending-decision record past its own `expires_at` (the mechanism already proposed in `chatterbox-notification-and-decision-design.md`, unchanged here).

### Layer 5 — Governance/CI knowledge surface (named, not designed here)

"Agents asking questions about repo governance to improve adherence" and "self-sufficiency on CI/ops" are retrieval and access-grant problems, not room-transport problems — they need a queryable corpus (governance docs, CI status, repo structure) exposed as a tool any room participant can call, independent of the event log. Flagged here so it isn't lost; deliberately out of scope for this document, which is about the room and queue mechanics only.

### Layer 6 — Credential/trust boundary (explicitly unresolved, unchanged from prior docs)

Whether PMO's actual GitHub writes (closing Issues, per Layer 3's ack callback) flow through the existing human-comment bridge (`TRUSTED_ACTORS`, hardcoded to Bill today) or a separately scoped credential is the same open question `chatterbox-agent-participation-findings.md` already named. This redesign sharpens *where* that decision has to be made (Layer 3's completion callback needs to actually call something) without resolving it.

## What this design does and does not fix

- **Fixes:** the #3579 check-in race; delivery that works for both an actively-polling session and a scheduled-pull product like ChatGPT from one data source; the specific historical failure of completed work never getting closed out in GitHub or reflected on the dashboard, via explicit ack/expire/escalate state instead of an implicit "was it seen" assumption; proactive reconciliation without depending on a human-driven session staying open.
- **Does not fix:** true real-time push (named as a non-goal, not a silent gap — see "What we give up"); ChatGPT's own polling cadence, which is its product's limit, not Chatterbox's; any new GitHub write scope for agents (Layer 6 stays open); the governance/CI knowledge layer (Layer 5, separate future scope).

## Relationship to #3686

#3686 remains open and authorized for the Cloudflare-Durable-Object approach. Given this redesign targets the same problem with a different (self-hosted, no-new-vendor-cost) mechanism, recommend Bill explicitly dispose of #3686 — close it as superseded by this document, or amend it — rather than leave two open Operations issues describing conflicting technical approaches to the same problem. Not done unilaterally here since #3686 is Bill's issue to disposition.

## Sequencing recommendation

1. **Layer 1** (atomic high-watermark check-in) first — it's a pure correctness fix to existing code, independently valuable, and everything else assumes it.
2. **Layer 3 + 4** (PMO action queue, ack/expire/escalate, reconciliation sweep) next — this is the mechanism that directly targets the named historical pain point (stale dashboard, unclosed Issues) and is self-contained: one new table, two new routes, one scheduled workflow.
3. **Layer 2** (Tier A/B delivery split) can land alongside Layer 3, since the queue endpoint is what Layer 3 extends.
4. **Layer 5 and 6** as separate, later-authorized work units — one needs a retrieval/tooling design of its own, the other needs a credential-trust decision only Bill/PMO can make.

This is a recommendation, not a decision — sequencing and authorization remain PMO's/Bill's call, per the same pattern the earlier Chatterbox proposal docs established.

## Intended final state

Neither this document nor any part of it authorizes implementation. It is a design proposal for Bill/PMO to accept, defer, reject, or resequence — consistent with `chatterbox-notification-and-decision-design.md` and `chatterbox-external-design-survey.md`'s own pattern. If accepted, each layer above is expected to land as its own bounded, PMO-authorized implementation package (branch, allowlist, acceptance criteria), not as a single undifferentiated cutover.
