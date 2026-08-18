---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Evidence / Status Index
Owns: Evidence that Follow-up 5/5 (#2566) published advisory vs dispatcher watcher profiles, bounded mutation classes, protected-action denial, reusable prompt patterns, and five-follow-up integration verification for Program #1719 promotion readiness
Does Not Own: ChatGPT product automation configuration, production promotion merge, source/program closeout mutation, or Cursor self-approval
Canonical Reference: /docs/ops/pmo/queue-watch-and-dispatch-protocol.md
Related Issues: #2566, #1719, #2528, #2565, #2564, #2563, #2562, #1724
Last Reviewed: 2026-08-18
---

# Watcher action and mutation authority contract — #2566

## Purpose

Define a precise watcher contract that separates detection-only watches from watches authorized to perform bounded repository actions, so watchers do not repeatedly report actionable work while being unable to advance it.

## Scope

This report owns evidence that Follow-up 5/5 (#2566) published advisory vs dispatcher watcher profiles, bounded mutation classes, protected-action denial, reusable prompt patterns, and five-follow-up integration verification. It does not configure ChatGPT product automation, merge Production promotion, close source/program Issues, or authorize Cursor self-approval.

## Current known truth

Advisory watchers detect and notify only. Dispatcher watchers may perform only named mutation classes when the controlling Issue explicitly authorizes them. Generic words such as monitor, review, watch, or notify are not mutation authority.

## Intended final state

Watchers either report without mutating or execute only the bounded classes listed in the queue-watch protocol, with merge, issue closure, and other protected actions remaining owner-only.

## Predecessor

#2565 / PR #2628 integrated into `component/pmo-governance-workflow-automation` at `515bcd37ed51d71d31e04ff0b629c55eda7fbaad`.

## Profiles

| Profile | Mutation | Required authority text |
| --- | --- | --- |
| **Advisory watcher** | Detect and notify only | Explicit `Watcher profile: advisory` and `Mutation classes authorized: none`; choose exactly one write mode — `Allowed writes: none` or `Allowed writes: notice-comment-only` |
| **Dispatcher watcher** | Bounded mutations listed in the queue-watch protocol | Explicit `Watcher profile: dispatcher` plus a named mutation-class list in the scheduled prompt or controlling repository issue |

Generic words such as “monitor,” “review,” “watch,” or “notify” are not mutation authority.

## Bounded dispatcher mutations

When explicitly authorized, a dispatcher watcher may:

1. Comment on issues/PRs.
2. Consume `CHATGPT HANDOFF` with one `CHATGPT RESPONSE` or `CHATGPT CLOSEOUT`.
3. Optionally post a resume-style comment referencing that response/closeout. That comment is context-only and is **not** a gating wake or dispatch requirement. Cursor Local Bridge eligibility is labels/status only (#3013); there is no comment-marker protocol.
4. Assign source issue / active PR to `wdhunter645`.
5. Restore approved Cursor wake labels `agent:cursor` + `handoff:ready`.
6. Clear stale completed-predecessor blockers.
7. Create/update bounded Ops remediation issues.
8. Route the next eligible task in an already approved lane.

## Protected / owner-only (denied without separate authority)

- Merge
- Source / parent / program / umbrella issue closure
- Branch or tag deletion
- CI-gate or required-check changes
- Production configuration or secrets mutation
- Cursor Cloud invocation (`@cursor`) for local work
- Removing active wake labels from work still assigned to Cursor
- Unapproved lane start or unauthorized parallel execution

Aligned with `#1724` default-deny issue-mutation matrix:
`docs/ops/reports/issue-mutation-closeout-permission-1724.md`.

## Signal consumption

| Signal | Advisory | Dispatcher (authorized) |
| --- | --- | --- |
| `agent:ChatGPT` idle | Report idle review markers | Do not invent review completion |
| `CHATGPT HANDOFF` awaiting reply | Report age + requested action | One response/closeout + one resume when Cursor must continue |
| Stale predecessor blocker | Report blocker + successor | Clear stale blocker; activate/resume successor under lane rules |
| Missing Cursor wake pair | Report missing labels | Restore `agent:cursor` + `handoff:ready` |
| Silent stall | Report evidence gap | Correct transaction or remediate; never claim active without pickup evidence |

## Reusable prompt patterns

Canonical detect-only and bounded-dispatch prompt blocks live in
`docs/ops/pmo/queue-watch-and-dispatch-protocol.md` under **Reusable watcher prompt patterns**.

## Changed paths (allowlist)

| Path | Change |
| --- | --- |
| `docs/ops/pmo/queue-watch-and-dispatch-protocol.md` | Watcher profiles, bounded mutations, protected actions, signal consumption, prompt patterns; mutation-authority summary |
| `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` | Minimal dispatcher-task and stall-escalation alignment |
| `docs/ops/pmo/github-issue-closeout-protocol.md` | Minimal cross-reference: closeout remains protected vs advisory watches |
| `docs/ops/reports/watcher-action-mutation-contract-1719.md` | This report |

## Scenario review

| Scenario | Expected result |
| --- | --- |
| Advisory detection of actionable stall | Report + recommended owner; no label/assign/response/resume mutation |
| Stale predecessor blocker after verified closeout | Dispatcher clears blocker and routes successor when authorized |
| Missing Cursor wake labels on eligible task | Dispatcher restores wake pair when authorized |
| Remediation creation for launch-halting defect | Dispatcher creates/updates bounded Ops issue when authorized |
| Protected-action request (merge/close/delete/CI/prod) | Refuse; require separate owner authority |

## Mutation-permission comparison to #1724

| #1724 rule | Watcher contract alignment |
| --- | --- |
| Cursor default deny for close/reopen/relabel/state | Watchers default deny; dispatcher may only use listed classes when explicit |
| Merge is not closeout | Source/program close remains protected |
| Docs recommend ≠ permission to mutate | Advisory findings recommend; do not mutate |
| Atlas/Bill/controller own authorized closeout | Unchanged |

## Five-follow-up integration verification (Program #1719 promotion gate)

Originating review intake: #2528. Parent program: #1719.

| Follow-up | Issue | PR | Merge SHA on `component/pmo-governance-workflow-automation` | Issue state | Result |
| --- | --- | --- | --- | --- | --- |
| 1/5 | #2562 | #2602 | `cf9177c4decb35c9afaa6b543f2418bc5a54523e` | CLOSED | Integrated |
| 2/5 | #2563 | #2617 | `eb729385de1c523f91a81db91ca55fce3cb36764` | CLOSED | Integrated |
| 3/5 | #2564 | #2625 | `6202cc798f82887aa4a42040d18b5a34c4f42389` | CLOSED | Integrated |
| 4/5 | #2565 | #2628 | `515bcd37ed51d71d31e04ff0b629c55eda7fbaad` | CLOSED | Integrated |
| 5/5 | #2566 | *(this PR)* | *(pending component integration)* | OPEN until verified integration + closeout | **Promotion blocker until integrated** |

### Promotion-readiness restoration rule

Program #1719 promotion-readiness review may resume only after:

1. This Follow-up 5/5 PR is independently merged into `component/pmo-governance-workflow-automation`.
2. #2566 receives verified integration evidence and canonical `CHATGPT CLOSEOUT`.
3. ChatGPT/Bill confirm all five rows above show Integrated with merge SHAs on the component branch.

Until those conditions hold, treat Program #1719 promotion readiness as **blocked** by Follow-up 5/5. Terminal promotion-readiness review remains a separate ChatGPT/Bill-controlled step after verified integration.

## Acceptance mapping

| Criterion | Result |
| --- | --- |
| Advisory and mutation-authorized profiles explicitly separate | PASS — profile table + sections |
| Exact bounded dispatcher mutations listed | PASS — eight classes |
| Protected/owner-only actions remain prohibited | PASS — protected list |
| Scheduled prompts must carry explicit mutation authority | PASS — authority text + prompt patterns |
| Consumes `agent:ChatGPT`, `CHATGPT HANDOFF`, stale blockers, missing wake labels | PASS — signal table |
| Reusable detect-only and bounded-dispatch prompt patterns | PASS — queue-watch patterns + this report |
| Final verification of all five follow-ups before promotion readiness | PASS for 1–4; 5/5 pending this PR’s component integration |

## Boundaries honored

- No ChatGPT product-automation mutation
- No self-approve / self-merge / retarget to `main`
- No unrelated issue mutation
- Allowlist only
