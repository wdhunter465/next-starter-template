---
Doc Type: Explanation
Audience: Human + AI implementation agents, PMO, Product Authority
Authority Level: Informational
Owns: Design approach for two Hivemind-survey-derived Chatterbox capabilities — categorized notification marking and a first-class pending-decision record with expiry — proposed against Chatterbox's actual schema
Does Not Own: Authorization to implement (see #3415, "does not by itself authorize implementation, branch creation, PR creation, Production changes, or task release"); Chatterbox's core architecture (chatterbox-architecture-rationale.md) or authority boundary (chatterbox-authority-boundary.md); the external design survey itself (chatterbox-external-design-survey.md)
Canonical Reference: /docs/explanation/chatterbox-notification-and-decision-design.md
Related Issues: #3415, #3544, #3527
Last Reviewed: 2026-08-16
---

# Chatterbox notification-category and pending-decision design

## Purpose

`chatterbox-external-design-survey.md` reviewed `hivementality-ai/hivemind` against Chatterbox's known gaps and filed five candidate patterns as *"Open — pending soak test."* The 2026-08-15/16 soak test (control Issue #3527; findings in `chatterbox-agent-participation-findings.md`, merged via #3541/#3543) validated two of them directly. This document proposes concrete mechanisms for those two — an additive design proposal, not a redesign, and not an authorization to build anything (per #3544 and #3415's own rule).

## Scope

Covers: a design proposal for (1) an event-level notification category and (2) a first-class pending-decision record with expiry, evaluated against the schema and API shape already established by migration `0050_chatterbox_core.sql` and the `functions/api/chatterbox/**` / `functions/_lib/chatterbox.ts` implementation, which currently live only on the `component/chatterbox-prototype` branch — neither exists on `main`, where this document and #3544 live.

Does not cover: implementation, migration authorship, or any commitment to build either proposal (see Intended final state); the other three Hivemind survey patterns (per-agent tokens, `@mention` parsing, hook precedence), which remain out of scope per #3544. Per Bill's direction (2026-08-16), near-term Chatterbox development targets `claude-code` and `cursor-local` collaborating in one room; both proposals below are evaluated against that narrower scope, not the full five-participant roster.

## Current known truth

From `chatterbox-agent-participation-findings.md`:

- The bridge relay mechanics work correctly end-to-end (Finding 1).
- Of five `CHECK_IN` events posted, only `claude-code`'s reflected an actual tool acting; the rest were Bill relaying registrations on inactive tools' behalf (Finding, corrected in #3543) — an availability gap, not a notification gap, and out of scope for this document.
- No participant, including one with some on-demand pull capability, had any way to distinguish an item needing a response from routine traffic (Finding 3) — this is the gap notification categorization addresses.
- The open question "what escalation criteria trigger PMO surfaces this to Bill now vs. keeps waiting" was named and left undecided (Design option section) — this is the gap a pending-decision record addresses.

Both proposals below reference implementation symbols (`buildCatchUpDigest`, `functions/api/chatterbox/events.ts`) that exist only on `component/chatterbox-prototype` as of this writing, cited from direct reading of that branch's source, not from `main` — flagged explicitly per file, below, so this doc stays accurate for a reader working only from `main`.

## Proposal 1 — event-level notification category

### Problem

`chatterbox_events.event_type` (`CLAIM, RELEASE, STATUS, QUESTION, ANSWER, COMPLETE, PMO_INSTRUCTION, PMO_ACCEPT, DECISION_RECORDED, CHECK_IN, CHECK_OUT, SYSTEM`) already provides a coarse category axis, but nothing distinguishes an urgent `QUESTION` from an FYI one, or flags `STATUS` updates that actually need a reply. On `component/chatterbox-prototype`, `buildCatchUpDigest` (`functions/_lib/chatterbox.ts`) returns `openQuestions`, `pmoInstructions`, and a bounded `tail` — everything not already an unanswered `QUESTION` or a recent `PMO_INSTRUCTION` lands in the undifferentiated tail, indistinguishable from routine noise. This is what let three of today's broadcast questions sit unanswered even for a participant that did look.

### Proposed mechanism

Additive column on `chatterbox_events`:

```sql
ALTER TABLE chatterbox_events ADD COLUMN notify_category TEXT
  CHECK (notify_category IN ('NEEDS_RESPONSE', 'FYI', 'BLOCKING') OR notify_category IS NULL);
```

- Set by the poster at event-creation time (`onRequestPost` in `component/chatterbox-prototype`'s `functions/api/chatterbox/events.ts`), optional. The column defaults to `NULL` at the database level; digest/triage logic treats `NULL` identically to `'FYI'`, so existing callers (including the bridge script, which never sets this field) are unaffected.
- `buildCatchUpDigest` gains a new bucket, `needsResponse`, populated from events where `notify_category IN ('NEEDS_RESPONSE', 'BLOCKING')` and no later event in the same room has `in_reply_to_event_id` pointing at it — "answered" is defined by the schema's existing reply-linkage field, not by `event_type`, so a `STATUS` update marked `NEEDS_RESPONSE` is treated the same as an unanswered `QUESTION` once something replies to it.
- The bridge's `question`/`status` commands gain an optional `urgency:` field mapping to `notify_category`; omitted, behavior is unchanged.

### Explicitly deferred

Actual push delivery (webhook, email, vendor API) is out of scope here, consistent with #3415's own MVP sequencing ("Push notifications are optional enhancements. Pull/check-in is the baseline" and explicit deferral of "sophisticated vendor wake integrations" until the communication model is proven). This proposal only makes the *pull*-time digest correctly triaged — it does not attempt to wake anyone up. Today's evidence (Finding 3, per-tool pull-capability table) showed no participant in the current two-agent scope has a confirmed push surface to build against yet.

## Proposal 2 — first-class pending-decision record with expiry

### Problem

#3415's own body already names `DECISION_REQUIRED` as a candidate protected task state alongside `DECISION_RECORDED` ("Protected decisions remain separate first-class states"). Migration `0050_chatterbox_core.sql` implemented `DECISION_RECORDED` as an event type but never built a `DECISION_REQUIRED` counterpart or any first-class object for it — `pmoInstructions` in the catch-up digest is a flat, unordered list with no urgency or expiry signal. A participant on a slow polling cadence has no way to tell "is anything waiting on Bill (or on me) right now" without reading full history.

### Proposed mechanism

New table, matching the survey's own fit-consideration ("this would be a genuinely new Chatterbox concept, closer to `chatterbox_tasks` than to `chatterbox_events`, not a small addition"):

```sql
CREATE TABLE IF NOT EXISTS chatterbox_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES chatterbox_rooms(id),
  raised_by_participant_id INTEGER NOT NULL REFERENCES chatterbox_participants(id),
  target_role_class TEXT, -- e.g. 'product_authority', 'pmo'; NULL = any PMO-eligible participant
  source_event_id INTEGER REFERENCES chatterbox_events(id), -- the QUESTION/PMO_INSTRUCTION that raised it
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL, -- default +24h at creation, mirrors Hivemind's ApprovalRequest default
  resolved_at TEXT,
  resolved_by_participant_id INTEGER REFERENCES chatterbox_participants(id),
  resolution_body TEXT
);
```

- New routes on `component/chatterbox-prototype`: `POST /api/chatterbox/decisions` (create, called from a new bridge `decide`-request command), `POST /api/chatterbox/decisions/:id/resolve` (approve/reject, PMO/product_authority role_class only — same role check pattern already used for `system_clerk` in that branch's `events.ts`), `GET /api/chatterbox/decisions?room=&status=`.
- Catch-up digest gains a `pendingDecisions` bucket, sorted by `expires_at` ascending, so the soonest-expiring item surfaces first.
- Expiry itself is passive (a computed `status = 'PENDING' AND expires_at < now` read at query time, not a background job) — consistent with Chatterbox's existing stateless-edge-function architecture; no cron/worker needed for v1.

### Explicitly out of scope for this proposal

Escalation *action* on expiry (auto-notify, auto-escalate) — this proposal only makes an expired decision visible and queryable, matching the same "make it visible, not automatic" posture #3415 takes toward its own cause→effect reconciler.

## Sequencing recommendation

Build **Proposal 2 (pending-decision record) first.** Rationale:

- It's more self-contained: one new table and three new routes, versus Proposal 1's change to the hot-path `buildCatchUpDigest` function and the shared `events.ts` write path every existing bridge command already depends on.
- It directly answers a question already on record as open in the merged findings doc, rather than a generally-observed gap.
- It's independently useful even with only two participants (`claude-code`, `cursor-local`) — a two-person room still benefits from "what's waiting on a decision" being a real, queryable thing, whereas notification categorization has more value once there's enough traffic volume for triage to matter.

This is a recommendation, not a decision — sequencing is PMO's/Bill's call per #3544's acceptance criteria.

## Intended final state

Neither proposal is authorized for implementation by this document. Both are candidates for Bill/PMO to accept, defer, or reject against #3544, per the same pattern `chatterbox-external-design-survey.md` established. If accepted, Proposal 2 is expected to land first per the sequencing recommendation above, as its own bounded PMO-authorized package (branch, allowlist, acceptance criteria) on `component/chatterbox-prototype`, not on `main`.
