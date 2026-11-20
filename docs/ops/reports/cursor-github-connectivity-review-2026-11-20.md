---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Informational
Owns: The research review of Cursor Local to GitHub connectivity and wake options for #3213, dated 2026-11-20, with a fit assessment against the current LGFC design
Does Not Own: The wake design, runner contract, Cursor runtime routing, any adoption or experiment decision, or Product Authority disposition
Canonical Reference: /docs/reference/ci/repository-runner-contract.md
Related Issues: #3213, #4982, #5344, #5377, #5012
Last Reviewed: 2026-11-20
---

# Cursor to GitHub connectivity review, 2026-11-20

## Purpose and limits

This is the overdue research checkpoint of #3213 (scheduled 2026-09-08). It asks what supported, zero-incremental-cost mechanism could give Cursor Local reliable, timely GitHub event awareness and wake, with less complexity or exposure than a self-hosted runner on a public repository.

Limits of this review, stated up front:

- Findings come from search results that summarise official pages (Cursor documentation and changelog, the GitHub changelog, the MCP specification). Full pages were not read end to end. Community forum posts appear only as leads or as reports of defects and are not the basis of any recommendation.
- Plan and pricing details change often. Nothing here is a purchase or plan decision.
- No setting, workflow or label was changed. Product Authority decides disposition.

## What LGFC runs today

Evidence from the repository and Issues, not from Cursor's machine:

- A local wake loop and poller on Cursor's host reads the ready queue. The 2026-11-15 wake-path trial on #4982 found the poller works once Product Authority has started Cursor's continuous workflow: Cursor took the Operations interrupt, then found `agent:cursor` Issues with `status:ready` or `status:active`.
- The 2026-11-20 continuous-pass update on #4982 shows the wake loop, runner keepalives and a stop-hook nudge in use.
- The gap recorded on #5344 (2026-11-18): Cursor did not run the continuous workflow unattended and left `ops:priority:1` and `ops:priority:2` Issues unclaimed for many hours. The mechanism works while a session runs; it does not start one by itself.
- The repository runner contract and the wake contract describe the self-hosted runner design. Events are durable on the GitHub side because the queue is Issue labels.

The comparison question is therefore narrow: what could start or wake Cursor without a person starting the session.

## Candidates

| Candidate | Event model | Cursor wake | GitHub coverage | Host offline | Security | Complexity | Support | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Current: local poller and wake loop** | Polling of the label queue | Yes while a session runs; not unattended (#5344) | Whatever labels and queries cover | Queue is durable on GitHub; wake waits for the host | No inbound port; local scripts | Loop, watchdog, poller, runner | LGFC-built | Zero added |
| **B. Cursor Automations on GitHub events** | Push from GitHub to Cursor's service | Starts a **cloud** agent, not Cursor Local | PR opened, pushed, merged; PR and issue comments; PR and issue label changes; CI completion; review submitted; webhook | Not host dependent | PR triggers do not run on fork PRs; comment and issue text can carry prompt injection into the agent | None on LGFC's host | First-party | Listed as included in Pro; usage draws on the plan's pool, overage is on-demand |
| **C. Cursor self-hosted worker (`agent worker start`)** | Outbound-only connection; Cursor sends tool calls over it | A GitHub-triggered agent can be routed to your own machine ("self-hosted routing" noted in the web release notes); the exact trigger-to-worker path was not verified | As B | Worker must be online; offline behaviour not verified | Outbound HTTPS only; no inbound exposure | One CLI process | First-party | Machine is ours; model usage billed to the plan |
| **D. Cursor Agent SDK hooks** (`onPullRequest`, `onIssue`, `onWorkflowRun`) | Event hooks through the account's GitHub connection | Programmatic invocation | PR, issue, workflow run | Not host dependent if hosted | Account connection; no PAT or public webhook said to be needed | Needs code | First-party | Plan requirements and pricing are not clearly documented |
| **E. GitHub Agentic Workflows** (general availability 2026-10-28) | GitHub Actions events | Runs its own agent in Actions; does not wake Cursor Local | Repository events | Not host dependent | Read-only defaults, sandbox and firewall, validated outputs, threat-detection job; secrets only for the chosen AI engine | Workflow files | First-party GitHub | The AI engine's usage is a cost; GitHub-hosted minutes are free on public repositories |
| **F. MCP subscriptions** (specification 2026-07-28, `subscriptions/listen`) | Long-lived event stream from an MCP server | Only if a client acts on the stream | Only what a server publishes | Needs a connected client | Opt-in filters | Needs a server that publishes repository events | Specification; four tier-one SDKs | None by itself |

### Notes on each

- **B** is already partly adopted: the Grok documentation pilot (#5377) is built on Automations started by GitHub events. Cursor documents that more than one trigger can be set, and that PR triggers skip forks, which suits a public repository. Two community reports describe webhook triggers failing (a 401 and a 400) with no confirmed fix; they are leads, not facts. The decisive limit is the runtime: the repository's runtime boundary makes local Cursor the default and requires source-Issue authority to use cloud (`Agent.md`, Cursor runtime boundary).
- **C** is the nearest match to "event, then Cursor on our own machine, without opening an inbound path". It needs a bounded test to settle three unknowns: whether a GitHub-triggered Automation can target the My Machines worker, what happens when the Chromebook is offline, and which plan the worker requires. The documentation seen conflicts on plan requirements (personal workers on Teams; shared pools needing an Enterprise service account) and on worker limits.
- **D** is promising but its plan requirements and pricing were reported as undocumented. Watch.
- **E** does not wake Cursor. It could run event-driven deterministic or advisory work inside GitHub, but its zero-cost status depends on the engine chosen. Not a fit for this question.
- **F** is the right shape in the long run (events pushed to a client) but nothing in LGFC's stack publishes repository events over MCP today. Claude Code has its own PR-activity subscription; no equivalent exists for Cursor Local.

## Naming: Grok

The pricing text read for this review lists **Grok Bot** as a separate Cursor product that shares the plan's usage pool with the editor, CLI and Cloud Agents. Forum reports describe it handing repository work to a Cursor cloud agent and offering a GitHub connector with its own "issue assigned" routines. LGFC's Documentation maintenance role uses Grok through Cursor Automations (#5377). Documents should say which Grok surface is meant (the Grok model in a Cursor Automation, or Grok Bot) and should not use one name for both.

## Fit assessment against the current design

- No candidate is clearly better than the current design on its own. Each either wakes a cloud agent (B, D), needs unverified behaviour (C), or does not wake Cursor at all (E, F).
- The recorded weakness of the current design is the unattended start (#5344), not event delivery. B and C aim at exactly that weakness.
- B has the lowest complexity and no inbound exposure but changes the runtime from local to cloud, which needs source-Issue authority and a decision on prompt-injection exposure from Issue and comment text.
- C could keep the work on LGFC's own machine while removing the polling loop's dependence on a session already running, but is unproven for LGFC's plan.
- Cost: B, C and D draw on the plan's included usage; any overage is billed. That stays zero incremental only while within the pool and with on-demand usage off. Cursor Pro is already on the vendor table with a June 2027 cancellation target (`docs/reference/platform/lgfc-asset-register.md`).

## Recommendation for Product Authority (not a decision)

1. Do not retire the review series yet; no superior replacement exists.
2. Fix the recorded gap first (#5344): the unattended start. Solutions B and C are only worth testing if that gap remains after #5344 is closed.
3. If a test is wanted, run one bounded experiment under its own Issue with `Runtime: either`: a Cursor Automation triggered by the `agent:cursor` label on a `status:ready` Issue, routed to the worker on My Machines, in a non-Production setting, with a cap on runs and a measure of missed events and time to claim. Success is a claim within minutes with the Chromebook offline and online, and no change to protected paths.
4. Record the usage cost of the Grok pilot and of any experiment against the plan's pool before widening.

## Sources

Cursor documentation and changelog: Automations (`cursor.com/docs/cloud-agent/automations`, `cursor.com/help/ai-features/automations`), Agent SDK GitHub guide (`cursor.com/docs/agent-sdk/guides/github`), Self-Hosted Machines (`cursor.com/docs/cloud-agent/self-hosted`), CLI changelog (`cursor.com/docs/cli/changelog`; v2026.08.11 and v2026.08.26 entries), web release notes (`cursor.com/docs/release-notes/web`), Models and Pricing (`cursor.com/docs/models-and-pricing`), legacy plans page. GitHub changelog: Agentic Workflows generally available, 2026-10-28; public preview, 2026-06-11. MCP specification 2026-07-28: Subscriptions (`modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions`) and the changelog. Community forum threads on webhook defects and Grok Bot were used as leads only.

## Next review

The series asks for a successor Issue dated for the 8th of the following month once Product Authority records a disposition for this review. The next date is 2026-12-08.
