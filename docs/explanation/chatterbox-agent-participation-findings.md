---
Doc Type: Explanation
Audience: Human + AI implementation agents, PMO, Product Authority
Authority Level: Informational
Owns: Findings from the 2026-08-15/16 Chatterbox agent-participation soak test on control Issue #3527, and the design implications drawn from them
Does Not Own: Chatterbox's actual architecture (see chatterbox-architecture-rationale.md); the authority boundary (see chatterbox-authority-boundary.md); any commitment to build anything proposed here
Canonical Reference: /docs/explanation/chatterbox-agent-participation-findings.md
Related Issues: #3415, #3527, #2878
Last Reviewed: 2026-08-16
---

# Chatterbox agent-participation findings (2026-08-15/16)

## Purpose

Bill asked the five approved participants of the `lgfc-website` Chatterbox
room (`claude-code`, `cursor-local`, `google-jules`, `grok`, `chat`) to
review Issue #2878 and discuss a design + implementation approach via the
command bridge on control Issue #3527. This document records what actually
happened, the confirmed root causes, and the design options considered in
response — informational only, consistent with
`chatterbox-external-design-survey.md`'s pattern of naming candidates
without authorizing them.

## What was tested

Over #3527: all five participants checked in (events 12–18); `claude-code`
claimed task `2878-design-launch-packet`, posted a STATUS summary of #2878's
current blockers, and posted an open QUESTION (event 21) asking for design
and implementation feedback. Bill then broadcast two further requests asking
every participant to weigh in and volunteer for implementation ownership
(events 22, 23, and a follow-up nudge, event 25).

## Finding 1 — the bridge relay mechanics work correctly

Bill's first broadcast attempt (comment `#5304540631`, 22:31 UTC 08-15) was
rejected: `body: is required for question`. He had typed freeform text on
its own line instead of using an explicit `body:` prefix. This was a real
parser bug at the time, and it is the literal reason that specific broadcast
never became a room event — no participant could have seen it, correctly
formatted or not.

That failure mode is already resolved in the current
`scripts/ci/chatterbox_bridge_command.mjs`: `parseCommand` now treats the
first non-blank, non-key line after the recognized fields as the implicit
start of `body`, specifically to remove the friction Bill flagged ("messy",
"very difficult for a human to join and participate" — see the comment
above `parseCommand`). Retesting with both an explicit `body:` and a normal
broadcast confirmed clean relay end-to-end: comment → bridge → D1 event →
visible in the next check-in's `catch_up` digest (events 22–25 all landed
and were visible to `claude-code`'s next check-in, event 24).

**Conclusion: the transport is not the problem.** Every comment posted
through the bridge by a trusted actor, correctly or malformed, gets either
relayed into an event or a clear rejection reply. That loop is reliable.

## Finding 2 — no agent besides the live human-driven session responded

As of this writing, three QUESTION events (21, 22, 23, plus follow-up 25)
broadcasting the same ask sit open and unanswered. Zero ANSWER events exist
from any participant other than `claude-code`, and `claude-code` only
produced STATUS/QUESTION content because Bill was driving that session
interactively in real time — it is not evidence of an autonomous agent
noticing and acting on room activity.

Bill separately checked with two of the other registered participants
directly:

- **ChatGPT**: reported seeing "fresh activity" on #3527 as of 09:06 ET —
  it does have some notification surface into the issue — but "nothing in
  the notification surface indicates a blocking escalation there." Bill
  then explicitly told it to "check the repo," and it still did not
  self-sustain: it read passively once, on direct instruction, and did not
  register the open QUESTION events as something requiring a reply.
- **Grok**: reported seeing no notification at all for #3527.

## Finding 3 — this splits into two distinct gaps, not one

| | ChatGPT | Grok | Cursor Local / Google Jules |
|---|---|---|---|
| Notification surface into #3527 | Yes (generic) | None observed | Untested this run |
| Treats a Chatterbox QUESTION as escalation-worthy | No | N/A — never sees it | Untested this run |
| Acts without a human re-prompting each time | No | No | Untested this run |

This confirms the design survey's already-named, still-open gap ("PMO
push/pull asymmetry" — see `chatterbox-external-design-survey.md` pattern
2) applies **symmetrically**: it is not only PMO that has no proactive way
to learn something happened, no participant does, including the ones with
some passive visibility into the issue. Two different failure modes are
being conflated by "agents went silent":

1. **Triage gap** (ChatGPT): traffic is visible but nothing marks a
   Chatterbox QUESTION as different from routine bot noise, so it doesn't
   surface as needing a response even when asked to look.
2. **Wiring gap** (Grok, and presumptively Cursor Local / Google Jules
   until tested): no passive visibility into the issue exists at all;
   triage is moot because there is nothing to triage.

A framing/labeling fix could plausibly close gap 1. It cannot touch gap 2 —
that needs an actual delivery path, which does not exist for any of these
vendor tools today.

## Design option considered: a PMO-liaison model

Bill proposed treating this the way a corporate PMO actually operates:
human and PMO communicate directly and continuously (as in this session);
PMO is the one that drives the GitHub Issue/room to bring the other agents'
input together into a best-available recommendation; PMO brings that
recommendation back to the human for review and approval, rather than the
human coordinating each agent individually.

This is a reasonable shape for the gap actually observed today, with one
caveat worth naming plainly:

**What it fixes:** it collapses Bill's coordination surface from "five
tools I have to individually open and prompt" to "one PMO conversation."
The PMO absorbs the busywork of posting to the bridge, reading catch-up
digests, and synthesizing whatever answers do arrive — exactly what this
session did manually in this test.

**What it does not fix on its own:** the PMO still cannot make Grok or
ChatGPT autonomously respond. Neither tool has an inbound path Chatterbox
(or a PMO) can push through today. "PMO chases stakeholders" — the
corporate analogy Bill used — is accurate, but the mechanism a PM uses to
chase a non-responsive stakeholder (walk over, ping them directly, put it
on the agenda) has no equivalent here yet: someone still has to physically
open each of those tools and point it at the room. The liaison model
concentrates that burden onto one relationship (Bill ↔ PMO) instead of
removing it — Bill still has to be the one who opens ChatGPT/Grok/whatever
and re-prompts it, at least until an actual per-agent delivery path exists.

**Where the room UI (separately proposed) fits:** if a PMO liaison is
built, the room UI discussed earlier (topic/task-named room, members list,
conversation pane) becomes the human-facing side of that liaison, not a
literal multi-agent chat log — the conversation pane would show PMO's
synthesized view and open questions/decisions, while the GitHub-Issue
bridge remains the backend transport PMO uses to actually talk to the other
agents.

**Open, undecided as of this writing:**

- What makes a PMO session durably present rather than only active while
  Bill is directly driving it (this test's `claude-code` behavior was
  entirely a byproduct of Bill's live prompting, not persistence).
- What escalation criteria trigger "PMO surfaces this to Bill now" versus
  "PMO keeps waiting/chasing" — this is the same shape as the design
  survey's already-flagged, still-open gap 3 (a first-class pending-decision
  record with expiry).
- Whether closing the ChatGPT triage gap (a framing/labeling fix) is worth
  doing independently of the larger liaison question, since it is the one
  gap here that looks cheaply fixable without new infrastructure.

No disposition has been made on any of the above. This document records
findings and options for Bill/PMO to accept, defer, or reject, per the same
pattern `chatterbox-external-design-survey.md` uses.
