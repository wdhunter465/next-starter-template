---
Doc Type: Report
Audience: Human + AI
Authority Level: Supporting (Operations proposal for Product Authority confirmation; not a Go or freeze)
Owns: The proposed operating plan for the website launch window 2026-12-31 through 2027-01-02
Does Not Own: The Go/No-Go decision, the freeze declaration, Production changes, public announcements, or alert channels that reach Bill outside GitHub
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4762, #2093, #4414, #4421, #4439, #4657, #3866
Last Reviewed: 2026-10-27
---

# Launch-window operating plan (2026-12-31 to 2027-01-02)

## Status

This plan is the Operations proposal for [#4762](https://github.com/wdhunter465/next-starter-template/issues/4762). Product Authority recorded a Go on 2026-10-22 to write it. Items marked **Proposal** are not decided until Bill confirms them on this Issue. This document does not declare Go, No-Go, or freeze.

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
| Operations, primary | Cursor | First responder for Operations Issues during the proposed cover hours. |
| Operations, secondary | Claude Code | Takes the Issue if Cursor does not acknowledge within the response time. |
| Go-live tracker owner | Claude Code | [#4414](https://github.com/wdhunter465/next-starter-template/issues/4414). Not reassigned by this plan. |

## Cover hours

**Proposal.** America/New_York.

| Block | Dates | Primary | Secondary |
| --- | --- | --- | --- |
| Cover | 2026-12-31, 2027-01-01, 2027-01-02, 08:00–22:00 | Cursor | Claude Code |
| Outside cover | The same three dates, 22:00–08:00 | Cursor acknowledges at the outside-cover time below | Claude Code if that acknowledgement is missed |

Bill is not assigned a cover block. Escalation to Bill is tier 3.

## Response times

**Proposal.** Operations (Cursor) proposes these times and accepts them as the Operations proposal. They are not in force until Bill confirms them on #4762.

| Severity | Examples in this window | Acknowledge during cover | Acknowledge outside cover |
| --- | --- | --- | --- |
| Outage | Public site down, failed Production deploy | 15 minutes | 60 minutes |
| High | Member or admin sign-in failing, scheduled post missing | 30 minutes | Next cover block |
| Medium | Single monitored route failing, backup or certificate warning | 2 hours | Next cover block |
| Low | Report-only finding, no member-visible failure | Next cover block | Next cover block |

Acknowledgement means a comment on the Operations Issue naming who has it. If the primary holder misses the time, the secondary holder comments and takes diagnosis. Diagnosis does not authorize a Production change.

## Three-tier alert path

Recorded from the monitoring review on [#4657](https://github.com/wdhunter465/next-starter-template/issues/4657). Workflow changes that would implement gaps stay in their own Issues. This plan names responders only.

| Tier | What happens | Who |
| --- | --- | --- |
| 1. Automatic, safe | Re-run the failing check once. If it fails again, open one Issue with the severity, the check, the run link, and the last good deployment. Do not change or roll back anything. | Workflow |
| 2. Agent response | The Issue is an Operations Issue. Cursor acknowledges it. Claude Code takes it if Cursor misses the response time. A code fix is a normal reviewed pull request. | Cursor, then Claude Code |
| 3. Product Authority | Rollback unless a standing rollback Go is in force, a freeze exception, any change that disables other workflows, and every public statement. | Bill |

**Proposal.** Tier 3 reaches Bill by an Issue comment. Email or phone, and only for outage and failed-deploy alerts, waits for Bill's decision (monitoring review decision 3). This plan does not add that channel.

## Named responder for each monitored gap

From `docs/ops/reports/launch-monitoring-gap-review.md`. The owner role is who responds. Closing the gap is still that gap's own Issue.

| Gap | Responder during this window |
| --- | --- |
| 1. No automatic wake when an Operations Issue opens | Cursor acknowledges from the open chat wake loop. Claude Code is secondary. Implementing the wake is Engineering, not this plan. |
| 2. No synthetic sign-in | Engineering, after a test-account Go. Until then, Cursor reports the gap as at risk. |
| 3. Photo addresses not checked | Operations (Cursor), report only. |
| 4. Scheduled publish noticed late | Operations (Cursor), report only. |
| 5. Uptime probe covers few public routes | Engineering. Cursor watches the routes the probe already covers. |
| 6. Watchers do not share one failure path | Engineering. Decision still open on #4439. |
| 7. Alerts only reach GitHub | Product Authority for any channel outside GitHub. Until Bill decides, the responder path is the GitHub Issue. |
| 8. Certificate expiry and DNS | Operations (Cursor), report only. |
| 9. Failed Production deploy | Operations (Cursor) at outage severity, then Bill for rollback. |
| 10. Email delivery | Operations (Cursor). No test email is sent from this plan. The repository record stands until Bill reports the live `MAILCHANNELS_ENABLED` value. |
| 11. Fundraiser widget | Not in this window. Website launch is 2027-01-01. The widget check belongs to #4470 and starts to matter at fundraiser launch 2027-03-25. |
| 12. Secret expiry reminders | Operations (Cursor), report only. |
| 13. Performance baselines | Engineering, via #3633. Low for this window. |

## Smoke checks on 2027-01-01

Tied to [#4421](https://github.com/wdhunter465/next-starter-template/issues/4421). The Production smoke test on a candidate revision stays on that Issue. This window adds one non-Production pass and one live observation after Bill's Go.

| Check | Who | Pass |
| --- | --- | --- |
| `scripts/launch-readiness/manifest.json` routes, including phone width, against the revision Bill named | Cursor runs it. Claude Code reviews the record. | Every required route in the manifest is reported, and each failure is a linked Issue. A failure is not itself a rollback. |
| `tests/e2e/launch-readiness-public-routes.spec.ts` and `tests/e2e/launch-readiness-fanclub-routes.spec.ts` | Cursor | Both specs complete. Failures are linked Issues. |
| After Bill's website Go: public home, `/health`, `/join`, and `/login` respond | Cursor observes. Bill is the only person who can call the result website Go. | Each URL returns a page. Member-only and admin flows that need credentials are reported as not run until a test-account Go exists. |

## Rollback

**Proposal, from #4439.** During this window, a standing rollback Go would allow Operations to roll the site back to the last good deployment and report afterward. It would not allow a content change, a secret change, a public statement, or a freeze exception.

Until Bill confirms that standing Go, rollback is tier 3. Cursor reports the failure and the last good deployment. Bill decides.

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

## What this plan does not do

No workflow edit, no Production write, no secret, no test email, no public announcement, and no merge. Open pull requests stay on their own approval profile. `handoff:ready` is not a Go.
