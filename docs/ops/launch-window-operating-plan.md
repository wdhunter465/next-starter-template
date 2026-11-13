---
Doc Type: Report
Audience: Human + AI
Authority Level: Supporting (Operations proposal for Product Authority confirmation; not a Go or freeze)
Owns: The proposed operating plan for the website launch window 2026-12-31 through 2027-01-02
Does Not Own: The Go/No-Go decision, the freeze declaration, Production changes, public announcements, or alert channels that reach Bill outside GitHub
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4762, #2093, #4414, #4421, #4439, #4657, #3866
Last Reviewed: 2026-11-13
---

# Launch-window operating plan (2026-12-31 to 2027-01-02)

## Status

This plan is the Operations proposal for [#4762](https://github.com/wdhunter465/next-starter-template/issues/4762). Product Authority recorded a Go on 2026-10-22 to write it. Items marked **Proposal** are not decided until Bill confirms them on this Issue. This document does not declare Go, No-Go, or freeze.

**Update 2026-11-13 (#4439).** Product Authority decided that Claude Code owns Day-2 operations and monitoring, Bill approves, and an alert opens an Issue that goes to Claude Code to remediate and restore service. Cursor is offline and holds no role in this window (`docs/governance/AGENT-TEAM.md`, Temporary override, #5221). Every Cursor assignment below is now Claude Code. Items marked **Proposal** still need Bill's confirmation.

Calendar of record used here:

- Final Go/No-Go and repository freeze: **2026-12-31**. Bill decides. He is the only authority for dates, Go/No-Go, freeze, and emergency changes.
- Website live: **2027-01-01**.
- This operating window: **2026-12-31 through 2027-01-02**.
- Fundraiser announcement **2027-02-01**, launch **2027-03-25**, close **2027-06-07 at 12:00 PM**. Those dates are committed to the Live Like Lou Foundation. They are context for this window. They are not actions inside it.

Evidence home for the window remains [#2093](https://github.com/wdhunter465/next-starter-template/issues/2093). The go-live tracker is [#4414](https://github.com/wdhunter465/next-starter-template/issues/4414).

## Holders

| Role | Holder | During this window |
| --- | --- | --- |
| Product Authority, CMO, Production merge, freeze, public statements | Bill | Tier 3 only. Not a standing watch shift. |
| Operations and monitoring | Claude Code | First and only responder for Operations Issues. Remediates and restores service, within the limits of tier 3. |
| Operations, backup responder | none | With one agent there is no secondary. A missed acknowledgement is visible on the Issue and goes to Bill (tier 3). |
| Go-live tracker owner | Claude Code | [#4414](https://github.com/wdhunter465/next-starter-template/issues/4414). Not reassigned by this plan. |

## Cover hours

**Proposal.** America/New_York.

| Block | Dates | Primary | Secondary |
| --- | --- | --- | --- |
| Cover | 2026-12-31, 2027-01-01, 2027-01-02, 08:00–22:00 | Claude Code | none |
| Outside cover | The same three dates, 22:00–08:00 | Claude Code acknowledges at the outside-cover time below | none |

Bill is not assigned a cover block. Escalation to Bill is tier 3.

## Response times

**Proposal.** Operations proposes these times. They are not in force until Bill confirms them on #4762. **Limit:** nothing wakes an idle Claude Code session when an Operations Issue opens (`docs/ops/ai/CLAUDE-CODE-RULES.md`, Operations interrupt, known limit). These times hold only while a session is running with a scheduled check-in, or once a wake mechanism exists. The wake is tracked in #4681 (open).

| Severity | Examples in this window | Acknowledge during cover | Acknowledge outside cover |
| --- | --- | --- | --- |
| Outage | Public site down, failed Production deploy | 15 minutes | 60 minutes |
| High | Member or admin sign-in failing, scheduled post missing | 30 minutes | Next cover block |
| Medium | Single monitored route failing, backup or certificate warning | 2 hours | Next cover block |
| Low | Report-only finding, no member-visible failure | Next cover block | Next cover block |

Acknowledgement means a comment on the Operations Issue naming who has it. If the holder misses the time, the Issue shows no acknowledgement and Bill sees it (tier 3). Diagnosis does not authorize a Production change.

## Three-tier alert path

Recorded from the monitoring review on [#4657](https://github.com/wdhunter465/next-starter-template/issues/4657). Workflow changes that would implement gaps stay in their own Issues. This plan names responders only.

| Tier | What happens | Who |
| --- | --- | --- |
| 1. Automatic, safe | Re-run the failing check once. If it fails again, open one Issue with the severity, the check, the run link, and the last good deployment. Do not change or roll back anything. | Workflow |
| 2. Agent response | The Issue is an Operations Issue. Claude Code acknowledges it, diagnoses, remediates and restores service. A code fix is a normal reviewed pull request. | Claude Code |
| 3. Product Authority | Rollback unless the standing rollback Go (approved 2026-10-19) applies, a freeze exception, any change that disables other workflows, and every public statement. | Bill |

**Proposal.** Tier 3 reaches Bill by an Issue comment. Email or phone, and only for outage and failed-deploy alerts, waits for Bill's decision (monitoring review decision 3). This plan does not add that channel.

## Named responder for each monitored gap

From `docs/ops/reports/launch-monitoring-gap-review.md`. The owner role is who responds. Closing the gap is still that gap's own Issue.

| Gap | Responder during this window |
| --- | --- |
| 1. No automatic wake when an Operations Issue opens | Claude Code, from a scheduled check-in. Implementing a real wake is Engineering and a CI and controller design decision for Bill, not this plan. |
| 2. No synthetic sign-in | Engineering, after a test-account Go. Until then, Claude Code reports the gap as at risk. |
| 3. Photo addresses not checked | Operations (Claude Code), report only. |
| 4. Scheduled publish noticed late | Operations (Claude Code), report only. |
| 5. Uptime probe covers few public routes | Engineering. Claude Code watches the routes the probe already covers. |
| 6. Watchers do not share one failure path | Engineering. Decision still open on #4439. |
| 7. Alerts only reach GitHub | Product Authority for any channel outside GitHub. Until Bill decides, the responder path is the GitHub Issue. |
| 8. Certificate expiry and DNS | Operations (Claude Code), report only. |
| 9. Failed Production deploy | Operations (Claude Code) at outage severity, then Bill for rollback. |
| 10. Email delivery | Operations (Claude Code). No test email is sent from this plan. The repository record stands until Bill reports the live `MAILCHANNELS_ENABLED` value. |
| 11. Fundraiser widget | Not in this window. Website launch is 2027-01-01. The widget check belongs to #4470 and starts to matter at fundraiser launch 2027-03-25. |
| 12. Secret expiry reminders | Operations (Claude Code), report only. |
| 13. Performance baselines | Engineering, via #3633. Low for this window. |

## Smoke checks on 2027-01-01

Tied to [#4421](https://github.com/wdhunter465/next-starter-template/issues/4421). The Production smoke test on a candidate revision stays on that Issue. This window adds one non-Production pass and one live observation after Bill's Go.

| Check | Who | Pass |
| --- | --- | --- |
| `scripts/launch-readiness/manifest.json` routes, including phone width, against the revision Bill named | Claude Code runs it. Bill reviews the record. | Every required route in the manifest is reported, and each failure is a linked Issue. A failure is not itself a rollback. |
| `tests/e2e/launch-readiness-public-routes.spec.ts` and `tests/e2e/launch-readiness-fanclub-routes.spec.ts` | Claude Code | Both specs complete. Failures are linked Issues. |
| After Bill's website Go: public home, `/health`, `/join`, and `/login` respond | Claude Code observes. Bill is the only person who can call the result website Go. | Each URL returns a page. Member-only and admin flows that need credentials are reported as not run until a test-account Go exists. |

## Rollback

**Decided.** Product Authority approved the standing rollback Go for the launch window on 2026-10-19 (decision 5 on #4657; recorded in `docs/ops/reports/day2-operations-readiness-p26.md` and `docs/how-to/website/go-live-deployment-runbook.md`). Rollback only, to the last good deployment, with a report afterward. It does not allow a content change, a secret change, a public statement, or a freeze exception. Claude Code, as Operations holder, may roll back under it and reports on the Operations Issue and on #2093.

Without that Go (anything beyond rollback), the decision is tier 3 and Bill decides.

## Daily status vocabulary

From #3866. Use one of these words in the daily window comment on #2093. They are not website Go.

| Word | Use |
| --- | --- |
| blocked | A named decision or holder is missing and the window cannot proceed on that item. |
| at risk | The item can still make the window, and a gap above is still open. |
| ready | The check or evidence for that item is complete. |
| go | Bill has said Go for that item. No one else uses this word as a decision. |
| no-go | Bill has said No-Go. |
| deployed | The named revision is the one serving the site. |
| verified | The smoke checks above have a recorded result. |
| monitoring | The window is open and the holders are watching. |

## Owners, evidence and backup items

The role table, daily status format, monitoring map, incident path and the remaining D1 backup items are in `docs/ops/reports/day2-operations-readiness-p26.md`, with the 2026-11-13 evidence refresh. Holder for every duty named there is Claude Code (see the update at the top of this plan); Bill decides Go, No-Go, freeze, rollback outside the standing Go, and every public statement.

## What this plan does not do

No workflow edit, no Production write, no secret, no test email, no public announcement, and no merge. Open pull requests stay on their own approval profile. `handoff:ready` is not a Go.
