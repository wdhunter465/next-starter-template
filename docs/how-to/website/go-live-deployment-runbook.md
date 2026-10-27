---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: The step order for the 2027-01-01 go-live deployment: preconditions, deployment identity, deploy and verify, communications hold, rollback, takedown, and the rollback rehearsal plan and record
Does Not Own: The Go decision, the freeze declaration, Cloudflare account administration, or any Production action by itself
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4425, #4414, #2093, #4417, #4439, #4440, #4421, #4424, #2905, #2901, #4696
Last Reviewed: 2026-10-22
---

# Go-live deployment runbook

## Purpose

One ordered procedure for putting the launch revision on Production and being able to take it back. It connects the existing smoke test, launch checklist, rollback and takedown procedures, and adds what they lack: how to identify a deployment, who decides at each step, the communications hold, and a rehearsal that proves rollback works instead of only naming it.

This runbook authorizes nothing. Every Production step needs the Go named in the step.

## Roles

Role names only. Product Authority names the holders (see the Day-2 readiness proposal, #4439).

| Duty | Role |
| --- | --- |
| Go, No-Go, freeze, announcements, rollback Go | Product Authority |
| Executes deploy checks and rollback | Operations |
| Fixes | Engineering |
| Records evidence on #2093 | PMO Admin |

## Preconditions (all must be true before the deploy step)

| # | Condition | Evidence |
| --- | --- | --- |
| 1 | Freeze scope accepted and the freeze declared | #4417 and #2093 |
| 2 | Launch-readiness run passed on the candidate (about 2026-12-17) | P-08, #4421 |
| 3 | SEO, sitemap, social card and analytics consent checks passed | P-11, #4424 |
| 4 | Production bindings and isolation evidence attached for the candidate | P-27, #4440 |
| 5 | Publish job provisioned and piloted | P-20, #4433 |
| 6 | Owners and monitoring in place | P-26, #4439 |
| 7 | Rollback rehearsal record shows rollback worked | This runbook, "Rollback rehearsal" |
| 8 | Product Authority records Go for the candidate revision on #2093 | #2093 |

A missing row is a stop, not a guess.

## Deployment identity

Every deploy, rollback and roll-forward records the same five facts on #2093:

| Fact | Where to read it |
| --- | --- |
| Commit SHA | The live file `/deploy-info.json` (`sha` and `builtAt`), then the merged pull request and the "Latest commit" in the Cloudflare comment on its pull request |
| Cloudflare Pages deployment ID and its deployment URL | The Pages project's Deployments list (Production environment) |
| Site build ID | The first comment in the page HTML of any page (`<!--…-->` right after the doctype). Fetch the home page and read it |
| Time deployed and time verified | Deployments list and the verification record |
| Person who executed | Operations holder |

The live site publishes the commit it was built from at `/deploy-info.json`. Read `sha` and `builtAt`. A build with no commit available writes `sha` as `unknown` and still succeeds (#4696).

## Procedure

Run these in order on the go-live day: Deploy, Verify, then either release the communications hold or Roll back. Takedown is a separate action that can happen at any time.

### Deploy

1. Confirm the preconditions table.
2. Product Authority records Go on #2093 naming the commit SHA.
3. The candidate commit is on `main`. Production deploys from `main` through the Pages Git integration (confirm in the Pages dashboard that the Production branch is `main`; the dashboard was not viewed when this was written).
4. Wait for the deployment to show success in the Deployments list. Record the deployment identity facts above.
5. Do not announce anything. The communications hold applies until verification passes.

### Verify

1. Run the Production smoke test (`docs/how-to/website/website-production-smoke-test.md`): public routes, guest and admin boundaries, launch-readiness surfaces.
2. Run the launch-readiness specs against Production (`scripts/launch-readiness/manifest.json`, `tests/e2e/launch-readiness-*.spec.ts`), including a phone-width check.
3. Confirm the health endpoint reports `ok` and `db_ok`.
4. Confirm the project root `pages.dev` address matches the decision made on #4440.
5. Confirm the next 10:00 AM publish run succeeded, once the publish job is provisioned.
6. Record each result with the commit SHA in the launch evidence template (`docs/ops/reports/website-public-launch-evidence-template.md`) and link it from #2093.
7. Status word for the day is `deployed`, then `verified` when steps 1 to 6 pass.

### Communications hold

From the Go until Product Authority authorizes the first public message:

- No launch, coming-soon or fundraiser posts on any social platform (P-22).
- The 10:00 AM publish job may only publish staged rows that Product Authority has already approved (freeze scope, #4417).
- Editors and Operations do not post. A message is released only by a written authorization on #2093.
- A failed verification keeps the hold in place and moves to rollback or a fix.

### Rollback

Use when verification fails or a stop condition below appears.

#### Decide

1. Operations sets the status word to `blocked` or `at risk` on #2093 and opens an exception Issue.
2. Product Authority gives the rollback Go (or the standing rollback Go, if one is recorded).
3. Operations rolls back. Product Authority decides whether to also hold or cancel the launch.

#### Roll back the site (code and static content)

Fastest path, no repository change:

1. In the Cloudflare Pages dashboard, open the Production environment's Deployments list and select the last deployment recorded as verified.
2. Use the dashboard's rollback action for that deployment (confirm in the dashboard that the action is offered for it).
3. Record the new deployment identity and the time.
4. Run the smoke test and the launch-readiness specs against Production. Record the results.
5. `main` still contains the bad commit. Until it is reverted, any later merge to `main` redeploys it. Engineering opens a revert or fix pull request linked to the exception Issue. During the freeze that change needs a freeze exception (#4417).

Fallback if the dashboard rollback is not available: a revert pull request through the freeze exception path, then wait for the deployment, then verify.

#### What a site rollback does not undo

- Database changes. A schema migration or data written by the site stays as it is. D1 recovery is a separate path (Time Travel bookmark, or a restore from the daily export, both under #3268) and needs its own Go, an exact target and the documented restore steps.
- Posts already sent to social platforms.
- Content already published by the 10:00 AM job. Use the takedown steps below.

#### Roll forward

After the fix is merged and the new deployment is verified, record the identity and set the status word to `verified`. Product Authority releases the communications hold.

## Takedown

For one piece of published content, use `docs/how-to/website/takedown-soft-delete-and-recovery.md` (admin suppress action, recorded reason and source, reversible). It needs no deployment and is the fastest way to remove a single item. Member account deletion uses the same document.

## Stop conditions

- A public route regression on auth, legal or join flows.
- False live fundraiser claims appear.
- Admin-only staging content appears on a public route.
- Any change to Production without the Go named in the step.
- Member or authentication data exposed in a page, log or report.

## Rollback rehearsal

The 2026-09-24 tabletop named the rollback path without running it. The acceptance for this runbook is a record that shows rollback worked.

### Plan

| Part | What | Environment | Needs |
| --- | --- | --- | --- |
| A. Procedure check | Walk the Roll back and Roll forward sections with the dashboard open, without pressing anything, and confirm each control exists | Production dashboard, read-only | Dashboard access |
| B. Live rehearsal | Roll Production back one deployment, verify, then roll forward to the latest deployment, verify again | Production | Product Authority's recorded Go, a quiet window, and no staged post due during the window |
| C. Data recovery check | Review the D1 restore proof from #3268 and confirm the drill workflow is understood | Non-Production restore target | None beyond what #3268 already allows |

Part B is the only part that touches Production. A live rehearsal rolls real visitors back by one deployment for a few minutes, so it needs a window, an announcement to the team only, and the Go. If Product Authority declines a live rehearsal, record the decline and do part A and C only. That leaves the rollback "named but not proven", and the Go packet row must say so.

### Status, 2026-10-19

Product Authority approved the standing rollback Go for the launch window (rollback only, report afterward) and the remaining recovery exercises on 2026-10-19 (#4657, #4469). That is approval to run the rehearsal. It is not yet scheduled, for three reasons:

- **Part A (procedure check):** needs the Cloudflare Pages dashboard, which the agent sessions cannot reach. Someone with dashboard access walks the Roll back and Roll forward sections and confirms each control exists, then records it below.
- **Part B (live rehearsal):** needs a named quiet window with no staged post due, and a person or a workflow able to roll the Pages project back one deployment and forward again. Agent sessions have no Pages deployment control, and no workflow does this today. Building one would add a Production-capable workflow with the Cloudflare token, which is a protected change for Product Authority to decide. Product Authority names the window, and either runs the dashboard steps with the agent recording, or approves that workflow.
- **Deployment identity:** read `sha` from `/deploy-info.json` on the site before and after the rehearsal (#4696). The Pages dashboard remains the source for the deployment ID.

**Part C (data recovery check): done.** The isolated restore drill of 2026-10-16 (workflow run 38966454925, `restore-verify`, manual dispatch, approved by Product Authority) completed with conclusion `success`: confirmation, restore, evidence upload and result recording all passed, and the alert and failure-record steps were skipped. It follows the 2026-10-01 restore proof recorded on #3268. Aggregate result only; no row content was recorded.

Until Part B is run, the Go packet's Rollback row must say rollback is named but not proven.

### Rehearsal record (completed after the rehearsal)

| Field | Entry |
| --- | --- |
| Date, window and executor | Part C: 2026-10-16, workflow run 38966454925. Parts A and B: not yet scheduled (see Status) |
| Deployment identity before | |
| Deployment identity after rollback | |
| Smoke and launch-readiness result after rollback | |
| Minutes from decision to verified rollback | |
| Deployment identity after roll forward | |
| Result after roll forward | |
| Problems found and fixes opened | No deployment marker on the site (#4696) |
| Product Authority acceptance | |

## Inputs from earlier projects

#2905 (cross-route qualification, rollback proof and Production handoff for #2858) and #2901 (candidate qualification and rollback for #2857) are closed. Read on 2026-10-08:

- #2905's closeout records a rollback package as a multi-step revert chain (#3192, then #3191, then #3187) on the `component/fanclub-responsive-completion` branch, with no Production action. The handoff report it names (`docs/ops/reports/fanclub-responsive-qualification-handoff-2905.md`) is not on `main`.
- #2901's stated rollback is disabling member photo upload while keeping the staff-managed gallery. Its evidence files were not found on `main` either.

Neither is a rollback of a Production deployment, so neither proves the procedure in this runbook. They are useful as feature-level rollback precedent. Operations links their closeout comments to #2093, and the rehearsal above is what proves deployment rollback.

## Validation

Valid when Product Authority accepts the runbook on #4425, the rehearsal record is filled in and accepted, and the evidence is linked from the #2093 Go packet.

## Rollback of this document

Revert the documentation commit. No system state is created.
