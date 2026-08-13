---
Doc Type: Operational Workflow
Audience: Human + AI operators
Authority Level: Operational Procedure
Owns: GitHub communication markers, cross-lane routing, lightweight problem adjustment, local Cursor wake/resume, acknowledgment, and task-level handoff behavior
Does Not Own: Role authority, delivery and promotion policy, PR approval, Production authorization, incident recovery strategy, or runner host maintenance
Canonical Reference: /docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md
Related Issues: #2396, #2492, #2640, #2641, #2639, #2648, #2997, #3013, #3212, #3424
Last Reviewed: 2026-08-13
---

# Cross-Lane ChatGPT / Cursor Communication Workflow

## Purpose

Define the GitHub communication procedure used by PMO / Engineering, Implementation / Operations, Administration & Communications, and Day-2 Operations.

This procedure carries decisions and evidence. It does not create decision authority.

ChatGPT and Cursor are operating team members. They communicate directly through this workflow whenever the canonical GitHub surfaces are available.

## Operating rule

A communication handoff stops only the affected task or incident unless the recorded decision or evidence requires a broader hold.

A PR handoff for Task A does not stop independent Task B Development work.

Direct agent-to-agent GitHub communication is preferred. Human relay through Bill is the least-desired fallback and is used only when the canonical channel is unavailable or materially impaired, Product Authority intervention is intentionally required, or an emergency prevents safe direct routing.

Bill is not expected to copy, interpret, translate, or relay routine agent assignments, acknowledgments, review findings, remediation requests, status updates, resumes, or completion messages.

## Communication preference hierarchy

1. Direct ChatGPT ↔ Cursor communication using a canonical structured event on the source GitHub Issue.
2. Administration & Communications routing, retry, acknowledgment, and escalation through repository automation or the controller.
3. Human relay through Bill as the least-desired fallback under the bounded exceptions above.

A human-relayed message does not complete an agent handoff. The responsible agent must write the decision or event back to GitHub before repository work depends on it.

## Authority

- Repository documents and GitHub Issues remain authority.
- Durable role ownership is defined in `docs/governance/AGENT-TEAM.md`.
- Promotion transitions are defined in `docs/governance/DELIVERY-AND-RELEASE.md`.
- Administration & Communications policy is defined in `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`.
- Runner and controller transport authorized events; they do not make product, Engineering, approval, recovery, or Production decisions.

## Minimum communication vocabulary

- `PROBLEM FOUND`
- `GUIDANCE`
- `ADJUSTMENT`
- `HOLD`
- `PLAN CHANGE REQUIRED`
- `RESUME`
- `IMPLEMENTATION HANDOFF`
- `PR REVIEW REQUEST`
- `APPROVED FOR INTEGRATION`
- `PROMOTION CANDIDATE READY`
- `PRODUCTION GO`
- `OPERATIONAL INCIDENT`
- `RECOVERY VERIFIED`
- `CLOSEOUT`

Legacy `CHATGPT HANDOFF`, `CHATGPT RESPONSE`, `CHATGPT CLOSEOUT`, and `LOCAL CURSOR RESUME` markers remain supported adapters until the controller migration is complete.

## Event envelope

A cross-lane event records:

```text
Event:
Subject:
Source role / lane:
Target role / lane:
Profile:
Status:
Evidence:
Requested action:
Blocking scope:
Decision authority:
Acknowledgment required:
Supersedes:
Resume condition:
```

Only include fields that apply, but the subject, source, target, evidence, requested action, and blocking scope must be clear.

## Source-Issue-first rule

For a task, project, or incident handoff, the receiving agent responds on the source Issue first using the canonical event envelope.

- The source Issue is the primary cross-agent routing surface.
- PR reviews, PR comments, inline threads, checks, deployments, and artifacts are supporting technical evidence.
- A PR-only disposition does not complete routing back to the implementation agent.
- When a PR review controls further work, the source-Issue event must reference the PR, candidate SHA, disposition, evidence, and requested next action.
- Local Cursor execution is triggered by labels/status alone (`agent:cursor` + `handoff:ready`); no linked resume comment is required (#3013).

A handoff is incomplete when the target role/lane, requested action, blocking scope, or acknowledgment state is missing or ambiguous.

## Direct team-member response requirements

When ChatGPT receives an `IMPLEMENTATION HANDOFF` or `PR REVIEW REQUEST`, ChatGPT must communicate the disposition directly to Cursor through the source Issue before reporting the result externally.

When Cursor receives `APPROVED FOR INTEGRATION`, `ADJUSTMENT`, `PLAN CHANGE REQUIRED`, `HOLD`, or `RESUME`, Cursor must acknowledge through the canonical workflow and must not require Bill to relay the decision.

When canonical GitHub routing is unavailable and Bill relays a message, the originating or receiving agent must write the event back to GitHub as soon as the channel is restored.

## Lightweight problem adjustment

Most discoveries use this path:

```text
PROBLEM FOUND
  -> route to the role that made the controlling decision
  -> GUIDANCE or ADJUSTMENT
  -> Administration & Communications records and acknowledges
  -> RESUME
```

### Problem report

```text
PROBLEM FOUND
Subject: #<issue or incident>
Profile: <sandbox | development | promotion-candidate | production | day-2>
Observed fact:
- <what was discovered>

Impact:
- <why the current action cannot proceed as intended>

Evidence:
- <checks, paths, logs, screenshots, or links>

Blocking scope:
- <task | project | promotion | production | repository assessment>

Independent work:
- <safe to continue | not safe and why>

Decision requested from:
- <owning role>
```

### Guidance or adjustment

```text
GUIDANCE
Subject: #<issue or incident>
Decision:
- <bounded clarification>

OR

ADJUSTMENT
Subject: #<issue or incident>
Decision:
- <bounded change within existing objective and authority>

Resume condition:
- <exact condition>
```

Use `PLAN CHANGE REQUIRED` only when product outcome, architecture, acceptance criteria, dependency structure, delivery model, promotion path, Production boundary, or recovery strategy materially changes.

## Implementation handoff

When Implementation / Operations completes bounded Development work:

```text
IMPLEMENTATION HANDOFF
Issue: #<issue>
PR: #<PR or none>
Branch:
Head SHA:
Profile: development
Summary:
Validation:
Changed scope:
Protected or material concerns:
Requested action:
Independent successor safe: <yes | no with reason>
```

The affected task enters review or integration disposition. An independent successor may continue when the source authority and dependency state allow it.

## PR review request and disposition

```text
PR REVIEW REQUEST
Issue:
PR:
Candidate/head SHA:
Profile: <development | promotion-candidate | production>
Acceptance evidence:
Checks:
Protected scope:
Requested disposition:
```

PR Approver / Engineering responds on the source Issue with one of:

- `APPROVED FOR INTEGRATION`
- `ADJUSTMENT`
- `PLAN CHANGE REQUIRED`
- `HOLD`

The source-Issue disposition references the PR and candidate SHA. PR comments and reviews provide detailed technical evidence but do not replace the cross-agent response.

Automated Development eligibility is recorded as deterministic CI eligibility, not as human Engineering approval.

## Promotion Candidate communication

```text
PROMOTION CANDIDATE READY
Release unit:
Candidate SHA:
Development scope included:
Qualification plan/results:
Repository standards reconciliation:
Rollback evidence:
Unresolved gaps:
Decision requested:
```

Promotion Candidate is mandatory before Production. No event may route Sandbox or Development directly to Production.

## Operational incident communication

```text
OPERATIONAL INCIDENT
Incident:
Evidence:
Known impact:
Assessment hold: <applied | not applied>
Current scope:
Owner needed:
```

After assessment:

```text
ADJUSTMENT
Incident:
Impact / probable cause / containment:
Targeted hold:
Resolution owner:
Unaffected work resume: <authorized | not authorized>
```

Day-2 Operations authorizes hold release. Administration & Communications records the state and routes `RESUME`.

## Local Cursor wake and resume adapter (Bridge decommissioned — #3013 / #3212 / #3424)

Cursor Local Bridge is **decommissioned as the primary local auto-start path** (#3424). Primary wake is GitHub Actions `lgfc-cursor-dispatch` (`docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`). Eligibility for Cursor Local work remains Issue **labels and status only** (`agent:cursor` + `handoff:ready`, open, not already handed off — see `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`).

When Bridge was still operated, it no longer required, read, or gated launch on a `LOCAL CURSOR RESUME` (or `CHATGPT RESPONSE`/`CHATGPT CLOSEOUT`) comment (#3013). Posting a resume comment is not necessary to trigger Cursor Local wake and has no effect on eligibility.

Any of the legacy markers named in this workflow may still be posted as ordinary cross-agent context/evidence — Cursor reads comments after launch the same way it reads the Issue body — but none of them are transport or gating mechanisms for current dispatch wake, and none should be described as Bridge launch triggers.

## Acknowledgment and retry

Administration & Communications tracks whether a routed event was acknowledged.

- Repeated identical events must not create duplicate work.
- A retry may refresh attention but must preserve the same event/action identity.
- A stale event must not overwrite a newer review, check, decision, hold, resume, merge, or closeout.
- Missed acknowledgment routes to the recorded escalation role.
- Missing acknowledgment must not be silently replaced by human relay.

## Communication integrity checks

The workflow must identify or fail closed on:

- missing source or target role/lane;
- missing source-Issue event;
- required acknowledgment not received;
- findings or instructions available only through Bill or another external relay;
- PR-only review disposition without source-Issue routing;
- stale, duplicate, contradictory, or superseded events;
- use of retired or unrecognized identities;
- local resume without an exact controlling decision reference.

## Runner and controller boundary

The runner/controller may:

- detect and normalize events;
- publish routing and evidence;
- retry bounded communication;
- apply authorized labels/comments/checks;
- execute deterministic authorized automation.

It must not:

- invent authority;
- make subjective decisions;
- impersonate human review;
- skip promotion profiles;
- merge to `main` without Production authority.

Runner host/service failure routes to Day-2 Operations. Communication state and retry remain Administration & Communications responsibilities.

## Decision propagation

A decision made in chat, email, or another external surface must be written to the relevant GitHub Issue, PR, incident, or canonical repository document before repository work depends on it.

Human relay through Bill is the least-desired fallback. The agent receiving or originating the relayed decision owns durable write-back; Bill is not the routine write-back operator.

## Closeout

`CLOSEOUT` records task, project, program, release, or incident disposition after required execution, validation, approval, promotion, Production, and evidence conditions are satisfied.

Closeout does not block an independent Development successor unless a substantive invariant is missing or contradictory.

## Required references

- Roles: `docs/governance/AGENT-TEAM.md`
- Administration & Communications: `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- Lane/profile contract: `docs/reference/operations/operating-lanes-and-promotion-profiles.md`
- Delivery and promotion: `docs/governance/DELIVERY-AND-RELEASE.md`
- Queue/dispatch: `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- Runner: `docs/reference/ci/repository-runner-contract.md`
