---
Doc Type: How-To
Audience: Operations, Engineering, and AI agents
Authority Level: Procedure
Owns: The record of the controlled recovery exercises for go-live task #3633-011 (#4469): what was run, where, when, the result, and what is still to run
Does Not Own: The Go decision, the deployment runbook (docs/how-to/website/go-live-deployment-runbook.md), the D1 backup design (#3268), or any Production change
Canonical Reference: /docs/governance/OPERATIONS-AND-RECOVERY.md
Related Issues: #4469, #3633, #4425, #4683, #3268
Last Reviewed: 2026-11-22
---

# Recovery exercise records (#3633-011)

## Purpose

One recorded exercise per recovery row: deployment rollback, D1 restore verification, B2/D1 relationships, and failed deployment. Each exercise runs in an approved environment with a recorded Product Authority Go and a documented restore path. Product Authority approved the remaining exercises on 2026-10-19 (#4469). All four rows are now recorded.

## Exercise records

| Row | Exercise | Environment | Date | Result | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D1 restore verification | Isolated scratch restore from the daily export | Non-Production scratch target | 2026-10-16 | Passed: confirmation, restore, evidence upload and result recording all succeeded | Workflow run 38966454925 (`restore-verify`); aggregate result only | Done |
| B2/D1 relationships | Every publishable photo address a site serves returns an image from B2 | Production (read-only, public URLs) and the Development database through the branch preview | 2026-10-19 | Production: 14 of 14 return an image. Development: 4 of 844 return an image, 840 return HTTP 404 | `scripts/ops/b2-d1-relationship-check.mjs`; counts below | Done, with a finding |
| Deployment rollback | Roll Production back one deployment and forward again | Production | 2026-11-22 | Passed: Production moved to the previous commit and back to the newest commit; the site returned HTTP 200 after each step | Record below; Pages deployment IDs `79c56450` and `b6721f39` | Done |
| Failed deployment | A build that fails leaves the last good deployment serving | Preview (a real failed build, observed; not induced) | 2026-11-20 (observed), recorded 2026-11-22 | Passed for the preview path: the build stage failed, the deploy stage never ran, no Production deployment was created and no exception Issue opened | Record below; Pages deployment `208290cb` | Done, with a limit stated below |

## B2/D1 relationship exercise, 2026-10-19

D1 holds the address of each photo; Backblaze B2 holds the file. Recovery has to keep the two in step, so the exercise reads the public photo list each site serves (the rows D1 says are publishable) and requests every address, expecting an image.

- **Production (`www.lougehrigfanclub.com`):** 14 photos listed, 14 returned an image, 0 failed. The 14 matches the rights audit of the same day (14 publication-eligible photos, 17 on rights hold and not listed).
- **Development database (branch preview):** 844 photos listed, 4 returned an image, 840 returned HTTP 404. The Development database lists photo records whose B2 files return 404, while Production holds 31 photo records in total (14 listed, 17 on rights hold). Why Development has them is not established here.

**Finding.** Development D1 is out of step with B2, so a preview shows broken photos. It does not affect Production. Bringing Development in step is a Production-to-Development refresh (the `ops-d1-prod-dev-refresh` workflow and its sanitization check), which is a separate decision. The check is read-only and uses public URLs, so it can also run on a schedule as the photo-address monitor in #4683.

## Deployment rollback exercise, 2026-11-22

Product Authority performed each step in the Cloudflare Pages dashboard. Claude Code observed the live deployment through the Cloudflare API (read only) and requested the site after each step. Times are UTC.

| Step | Action | Live Production deployment afterwards | Site check |
| --- | --- | --- | --- |
| About 15:51 | Retry of the last successful deployment | New deployment `1f9ae60d`, commit `b125cddc`, all stages succeeded. A retry redeploys the same commit; it is not a rollback. | Not checked |
| About 15:54 | Rollback to the previous Production deployment | `79c56450`, commit `ce9498d3` (deployed 2026-11-21 21:56) | HTTP 200 at 15:54 and 15:55 |
| About 15:56 | Rollback to the newest build (roll forward) | `b6721f39`, commit `b125cddc` (deployed 2026-11-21 22:07) | HTTP 200 at 15:56 |

**Result.** Passed. Production moved one commit back and forward again without a build or a visible outage. Each move was live within about a minute of the click.

**Where the control is.** Deployments, All deployments, the three-dot menu on a successful Production row other than the live one, then Rollback to this deployment (Cloudflare Pages documentation, Rollbacks). The newest row, a preview row and a row still building offer only Retry and Delete.

**Limits.** The roll forward landed on the earlier deployment of the newest commit, not on the retry. The exercise does not test a rollback across a D1 schema change; Pages rollback does not change D1 or other bindings.

## Failed deployment record, 2026-11-20 (observed)

The exercise plan was a throwaway branch with a failing build. It was not run, because the Pages project is set to `preview_deployment_setting: none`, so a throwaway branch would be skipped instead of built, and changing that setting is a Cloudflare write. Product Authority pointed to a failed deployment that already exists and is the same event.

| Item | Observed |
| --- | --- |
| Deployment | `208290cb-fbbc-44b0-8f59-08123cd88532`, environment Preview, branch `scorecard-history`, commit `3adcdf22`, 2026-11-20 14:23 UTC |
| Stages | queued, initialize and clone succeeded; **build failed** after about 5 seconds; deploy never ran |
| Cause | The branch holds scorecard data and has no `package.json`, so `npm run build:cf` stopped with `ENOENT` (exit code 254, then 1) |
| Production effect | No Production deployment was created at 14:23. Every Production deployment from 2026-11-19 to 2026-11-20 succeeded. |
| Alerting | No Operations Issue opened for the branch-only failure, as `docs/how-to/ops/pages-deploy-failure-alert.md` says (it acts only on the default branch). |

**Limit.** This is a preview-path failure with an unrelated cause. It shows that a failed build stops before deploy and that a branch-only failure creates no Production deployment and no alert. It does not show a failed build on `main` leaving Production on the last good deployment. Cloudflare Pages does not replace the live deployment with a build that failed, and the default-branch failure alert is in `pages-deploy-failure-alert.md` (#4689). Product Authority decides whether this record is enough or a failed `main` build is also wanted.

## Procedure

### Repeat the B2/D1 relationship check

1. Run `node scripts/ops/b2-d1-relationship-check.mjs --base https://www.lougehrigfanclub.com`.
2. Read the counts. Any failed photo is listed by its id and the reason (`http_404`, `not_an_image`, `timeout` or `network_error`).
3. Add `--fail-on-missing` to make the run exit with an error when any address fails.
4. Record the date and counts in the table above.

### Run the failed-deployment exercise again

1. Check the project's `preview_deployment_setting`. With `none`, a branch is skipped and never built. Enabling previews for one throwaway branch pattern is a Cloudflare project change and needs a Product Authority Go.
2. On a throwaway branch with no pull request, add a change that fails the Cloudflare Pages build and push it.
3. Confirm the preview build for that commit fails at the build stage and that no Production deployment is created.
4. Confirm no Operations Issue opens for a branch-only failure, or record the one that does.
5. Delete the throwaway branch, restore the preview setting, and record the result in the table above.

### Run the deployment rollback exercise again

Follow Part B of the rollback rehearsal in `docs/how-to/website/go-live-deployment-runbook.md`. A person with Cloudflare Pages deployment control does the clicks: use the Rollback control on an earlier successful Production row, then roll forward the same way. Record the live deployment ID and a site check after each step.

## Rollback

Revert this documentation commit. The rollback exercise changed Production and returned it to the same commit; the records above change no data and no deployment.
