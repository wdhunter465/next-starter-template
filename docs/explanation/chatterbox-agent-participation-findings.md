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

Over #3527: five `CHECK_IN` events were posted covering all five approved
participants (events 12–18). Only the two `claude-code` check-ins (events
12, 13) reflect an actual tool connecting and acting — `claude-code` was
this live, human-driven session. The other four (`chat`/ChatGPT — event
14, `cursor-local` — event 15, `google-jules` — event 16, `grok` — event
17) are Bill relaying a registration on that participant's behalf via the
`/chatterbox checkin` command (command on its own line, `participant:
<key>` on the following line, per the bridge's parser), self-declared per
the bridge's own trust model (see #3527's body: "the participant a
command speaks as is self-declared in the comment body ... not inferred
from the GitHub actor"). A `CHECK_IN` event existing for a participant key
is not evidence that the tool was running or took any action; confirmed
directly for `cursor-local`, whose local machine was off at the time. `claude-code`
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

As of this writing, four QUESTION events (21, 22, 23, and follow-up 25)
broadcasting the same ask sit open and unanswered. Zero ANSWER events exist
from any participant other than `claude-code`, and `claude-code` only
produced STATUS/QUESTION content because Bill was driving that session
interactively in real time — it is not evidence of an autonomous agent
noticing and acting on room activity.

Bill separately checked with two of the other registered participants
directly:

- **ChatGPT**: reported seeing "fresh activity" on #3527 as of 09:06 ET —
  but this was not a passively received notification. Per Bill's
  clarification, OpenAI's GitHub connector is pull-only and initiates
  outbound on explicit prompt; it does not receive inbound notifications
  from GitHub. Bill had to prompt it to connect and check before it saw
  anything, and it still did not self-sustain afterward: it read once, on
  direct instruction, and did not register the open QUESTION events as
  something requiring a reply.
- **Grok**: reported seeing no notification at all for #3527. Untested
  whether an equivalent explicit "connect and check" prompt would surface
  anything, the way it did for ChatGPT — Grok was not asked to pull in the
  same way.

## Finding 3 — no participant has an inbound path; only some have a working on-demand pull

| | ChatGPT | Grok | Cursor Local / Google Jules |
|---|---|---|---|
| Passive/push notification into #3527 | No | No | Untested this run |
| On-demand pull connector, invoked by explicit human prompt | Yes — confirmed working | Untested — not asked | Untested this run |
| Acts without a human re-prompting each time | No | No | Untested this run |

This confirms the design survey's already-named, still-open gap ("PMO
push/pull asymmetry" — see `chatterbox-external-design-survey.md` pattern
2) applies **symmetrically**: it is not only PMO that has no proactive way
to learn something happened, no participant does. An earlier version of
this finding described ChatGPT and Grok as two distinct gap types (a
"triage gap" vs. a "wiring gap"); that was incorrect and has been corrected
here. Both have the identical structural gap — no inbound path exists for
either — and the only confirmed difference is that ChatGPT has a working
on-demand pull connector Bill can invoke by asking, while Grok's equivalent
capability is simply untested, not shown to be absent.

Because there is no passive surface for either tool, a framing/labeling fix
("mark Chatterbox questions as escalation-worthy") has nothing to attach
to — it was considered as a cheap fix in an earlier draft of this document
and is not viable given this correction. Closing this gap for any pull-only
tool requires either continued manual re-prompting (no improvement over
today), or pairing the tool with something that re-invokes it on a
schedule without a human doing it by hand each time (see Finding 4).

## Finding 4 — a scheduling primitive for PMO durability already exists and was proven working today

Separately from any individual agent's own capabilities, this session's
own environment provides a scheduling primitive (`send_later` /
equivalent recurring-wake tooling) that was used during this same session
to schedule a self check-in on PR #3541 roughly an hour out, and it fired
as expected. A Claude-based PMO running in this kind of environment could
use the same mechanism to durably re-invoke itself on a cadence — check
the room, chase non-responders, synthesize open items — without depending
on whether a given vendor product (e.g. ChatGPT's Scheduled Tasks) exists,
is enabled, and is paired with a working write-capable connector. This is
a more immediately testable path to "durably present" than the
liaison-durability question named as open below, though it only solves
durability for whichever tool is acting as PMO — it does not by itself
give Grok, ChatGPT, Cursor Local, or Google Jules an inbound path when
they are not PMO.

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
  entirely a byproduct of Bill's live prompting, not persistence). Finding
  4 names a candidate mechanism proven to work in this session, but no
  disposition has been made on building a PMO around it.
- Whether PMO's writes into the room should continue to flow through the
  GitHub-comment bridge (`TRUSTED_ACTORS` is hardcoded to `wdhunter465`
  only today, so a non-human PMO would need its own trusted identity added
  — a governance change) or get a separate, directly scoped API
  credential (mechanically simpler, but moves PMO's actions outside
  GitHub's system of record, which this design has otherwise deliberately
  kept everything inside).
- What escalation criteria trigger "PMO surfaces this to Bill now" versus
  "PMO keeps waiting/chasing" — this is the same shape as the design
  survey's already-flagged, still-open gap 3 (a first-class pending-decision
  record with expiry).

No disposition has been made on any of the above. This document records
findings and options for Bill/PMO to accept, defer, or reject, per the same
pattern `chatterbox-external-design-survey.md` uses.
