---
Doc Type: Explanation
Audience: Human + AI implementation agents, PMO, Product Authority
Authority Level: Informational
Owns: An independent survey of external prior art evaluated against Chatterbox's known design gaps, for Bill/PMO to accept, defer, or reject during Chatterbox's Development-level testing
Does Not Own: Chatterbox's actual architecture (see chatterbox-architecture-rationale.md); the authority boundary (see chatterbox-authority-boundary.md); any commitment to build anything listed here
Canonical Reference: /docs/explanation/chatterbox-external-design-survey.md
Related Issues: #3415
Last Reviewed: 2026-08-14
---

# Chatterbox external design survey — Hivemind

## Purpose

Bill asked whether `hivementality-ai/hivemind` (a public, MIT-style open-source
multi-agent orchestration platform) has anything worth borrowing for
Chatterbox. This document collects the **spirit** of the patterns found there
— not their code — against Chatterbox's own known gaps, so Bill/PMO can
accept, defer, or reject each one deliberately, informed by the pseudo-project
soak test rather than by this survey alone. Nothing here is authorized for
implementation by this document; each item is a candidate, not a task.

Snapshot reviewed: `hivementality-ai/hivemind@0798de22` (2026-08-08), read-only,
no code copied or vendored.

## Why this is a pattern survey, not a porting plan

Hivemind and Chatterbox solve adjacent problems with fundamentally different
architectures:

| | Hivemind | Chatterbox |
| --- | --- | --- |
| Runtime | Single live Ruby/Rails process (Postgres, Redis, Sidekiq, ActionCable) | Stateless Cloudflare Pages Functions + D1, no shared process |
| Agents | Run *inside* Hivemind as sessions in the same app | Run in entirely separate vendor runtimes (Claude Code, Cursor, Grok, ...) with no shared process |
| Coordination unit | A live session Hivemind itself owns | A GitHub Issue/PR Chatterbox never owns or replaces |

Several Hivemind mechanisms (e.g. injecting a sub-agent's result directly into
a parent's *live* session) only work because everything runs in one process.
Those are not portable at all — not even in spirit — and are excluded below.
What follows is only the subset of patterns that describe a *problem shape*
Chatterbox also has, independent of Hivemind's specific implementation.

## Patterns worth evaluating

### 1. Per-agent identity with hashed, revocable, expirable tokens

**What Hivemind does:** Two mechanisms — "Slack Multi-Bot" gives each agent
its own bot token/identity so messages post as that agent's own name and
avatar, not a shared account (`README.md` "Slack Multi-Bot" section); general
API access uses per-token bearer credentials (`hv_...`), SHA-256 hashed at
rest, individually revocable, with optional expiration (`README.md`
"Authentication" section; `app/models/api_token.rb`).

**The spirit:** Identity and credential lifecycle are treated as a first-class
concern with a specific hygiene bar — hashed storage, per-principal
revocation, optional expiry — not just "a token exists."

**Chatterbox gap it addresses:** The weak-identity problem Bill raised
directly — every Chatterbox participant is currently self-declared via
`participant_key` in the request body, gated only by the single shared
`ADMIN_TOKEN`. This is already named as the explicit next step in
`chatterbox-architecture-rationale.md` ("per-agent identity tokens are the
right end state"); this pattern gives a concrete bar to build toward rather
than an open-ended "add tokens later."

**Fit consideration:** Chatterbox's participants span multiple vendors with
no shared account system (unlike Hivemind's Slack bots, which all live inside
one Slack workspace Hivemind administers). A Chatterbox equivalent would be
per-`participant_key` tokens minted and stored server-side (D1), not a new
vendor integration.

### 2. Categorized, toggleable completion/decision notifications

**What Hivemind does:** A dedicated trigger service
(`app/services/web_push/notification_triggers.rb`) fires push notifications
keyed to specific event categories — `task_completions`, `needs_input`,
`budget_alerts`, `heartbeat_finding` — each independently toggleable per user.

**The spirit:** Notification is categorized and opt-in per category, not one
undifferentiated stream — a human can want completion pings without wanting
every heartbeat finding, or vice versa.

**Chatterbox gap it addresses:** The exact push/pull asymmetry Bill described
— PMO currently has no proactive way to learn a `COMPLETE` event was posted;
someone has to poll. The specific mechanism Hivemind uses (VAPID web push to
a PWA) doesn't apply, but the categorization idea sharpens the "notify PMO on
completion" job already proposed into something less one-size-fits-all —
e.g., separate categories for `COMPLETE`, a targeted unanswered question, and
a `system_clerk` anomaly, each independently mutable.

**Fit consideration:** Chatterbox's practical notification channel is GitHub
itself (issue comment, @-mention) since that's the one channel every
participant vendor already has some relationship with — not a new push
infrastructure.

### 3. A first-class pending-decision record with default expiry

**What Hivemind does:** `ApprovalRequest`
(`app/models/approval_request.rb`) is a dedicated, queryable record — states
`pending` / `approved` / `rejected` / `expired`, a default 24-hour expiry set
at creation, and an explicit `expire!` transition — rather than a decision
living only as one entry in an activity log a reader has to interpret.

**The spirit:** A decision awaiting a human is a distinct, queryable object
with its own lifecycle and a default time-to-live, not just an event type
mixed into a general append-only stream.

**Chatterbox gap it addresses:** Sharpens a gap already named in this
session's design evaluation — `pmoInstructions` in the catch-up digest has no
urgency or expiry signal, so a participant on a slow or irregular polling
cadence could miss a time-sensitive ask between check-ins. A first-class
pending-decision concept (rather than a digest-filtering tweak) would make
"is anything waiting on Bill right now" a direct query instead of an
inference from event history.

**Fit consideration:** This would be a genuinely new Chatterbox concept
(closer to `chatterbox_tasks` than to `chatterbox_events`), not a small
addition — worth weighing against the launch package's explicit MVP boundary
before committing to it.

### 4. Hook/authority precedence: task > template > team

**What Hivemind does:** `Task#effective_hooks_for` resolves behavior hooks
with explicit precedence — task-level overrides beat template-level, which
beat team-level defaults (`app/models/task.rb`).

**The spirit:** A named, explicit precedence order for "which authority wins
when more than one applies," resolved in code rather than left to convention.

**Chatterbox gap it addresses:** Directly relevant to the governance-reactivity
question raised earlier this session ("how will Chatterbox react if
governance procedures are updated") — today nothing in Chatterbox
distinguishes task-level citations from component-level or repo-level
governance, or defines which wins on conflict. This pattern is a reasonable
shape for that resolution order if/when the deferred cause→effect reconciler
gets built, without requiring the reconciler itself right now.

**Fit consideration:** Speculative — useful mainly as a shape to reuse later,
not something to build ahead of the reconciler it would serve.

## Pattern considered and explicitly not recommended

### Check-then-write task locking

Hivemind's own task-transition lock (`Task#lock_transition!`,
`app/models/task.rb`) is application-level and non-atomic: it raises if
`transition_locked?` is already true, then performs a separate `update!` —
a real check-then-act race window between two concurrent callers, mitigated
only by a five-minute timeout, not prevented.

This is exactly the class of race Chatterbox's atomic-claim design
(`chatterbox_claims(task_id) WHERE status = 'ACTIVE'` partial unique index)
was built to close at the database level instead. Reviewing Hivemind's
approach here is useful as **validation that Chatterbox's existing design
choice is stronger**, not as something to adopt. Recorded here so this
comparison doesn't need to be re-derived later.

## How to use this document

None of the four candidate patterns above are approved for implementation by
this document. The recommended path is to let the pseudo-project soak test
(Development/Preview only, per Bill's confirmed scope) surface which of these
gaps are actually felt in practice — a real multi-day, multi-agent run may
show that some of these are unnecessary for Chatterbox's actual scale, or that
a simpler mechanism suffices. Fill in the table below once that evidence
exists, rather than deciding from this survey alone.

| Pattern | Chatterbox gap | Disposition | Evidence / rationale |
| --- | --- | --- | --- |
| Per-agent tokens (hashed, revocable, expirable) | Weak shared-identity | *Open — pending soak test* | |
| Categorized completion/decision notifications | PMO push/pull asymmetry | *Open — pending soak test* | |
| First-class pending-decision record with expiry | Time-sensitive PMO asks missed on slow polling cadence | *Open — pending soak test* | |
| Task/template/team hook precedence | Governance-change reactivity | *Open — speculative, revisit only alongside the reconciler* | |
| Check-then-write task locking | (N/A — comparison only) | *Rejected — Chatterbox's DB-constraint approach is already stronger* | See "Pattern considered and explicitly not recommended" above |

## What this document does not do

It does not authorize building any of the above. It does not modify
Chatterbox's schema, API, or authority boundary. It does not claim Hivemind's
implementation is correct or secure by virtue of being open source — only
the four items above were reviewed, and only for pattern shape, not for
security or correctness of Hivemind's own code.
