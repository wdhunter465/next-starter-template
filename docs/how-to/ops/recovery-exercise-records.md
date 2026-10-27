---
Doc Type: How-To
Audience: Operations, Engineering, and AI agents
Authority Level: Procedure
Owns: The record of the controlled recovery exercises for go-live task #3633-011 (#4469): what was run, where, when, the result, and what is still to run
Does Not Own: The Go decision, the deployment runbook (docs/how-to/website/go-live-deployment-runbook.md), the D1 backup design (#3268), or any Production change
Canonical Reference: /docs/governance/OPERATIONS-AND-RECOVERY.md
Related Issues: #4469, #3633, #4425, #4683, #3268
Last Reviewed: 2026-10-19
---

# Recovery exercise records (#3633-011)

## Purpose

One recorded exercise per recovery row: deployment rollback, D1 restore verification, B2/D1 relationships, and failed deployment. Each exercise runs in an approved environment with a recorded Product Authority Go and a documented restore path. Product Authority approved the remaining exercises on 2026-10-19 (#4469).

## Exercise records

| Row | Exercise | Environment | Date | Result | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| D1 restore verification | Isolated scratch restore from the daily export | Non-Production scratch target | 2026-10-16 | Passed: confirmation, restore, evidence upload and result recording all succeeded | Workflow run 38966454925 (`restore-verify`); aggregate result only | Done |
| B2/D1 relationships | Every publishable photo address a site serves returns an image from B2 | Production (read-only, public URLs) and the Development database through the branch preview | 2026-10-19 | Production: 14 of 14 return an image. Development: 4 of 844 return an image, 840 return HTTP 404 | `scripts/ops/b2-d1-relationship-check.mjs`; counts below | Done, with a finding |
| Deployment rollback | Roll Production back one deployment and forward again | Production | Not yet run | Not run | See the rehearsal plan in the go-live runbook (#4425, Part B) | Waiting on a window and a Pages rollback control |
| Failed deployment | A build that fails leaves the last good deployment serving | A throwaway branch (preview only) | Not yet run | Not run | Plan below | Planned |

## B2/D1 relationship exercise, 2026-10-19

D1 holds the address of each photo; Backblaze B2 holds the file. Recovery has to keep the two in step, so the exercise reads the public photo list each site serves (the rows D1 says are publishable) and requests every address, expecting an image.

- **Production (`www.lougehrigfanclub.com`):** 14 photos listed, 14 returned an image, 0 failed. The 14 matches the rights audit of the same day (14 publication-eligible photos, 17 on rights hold and not listed).
- **Development database (branch preview):** 844 photos listed, 4 returned an image, 840 returned HTTP 404. The Development database lists photo records whose B2 files return 404, while Production holds 31 photo records in total (14 listed, 17 on rights hold). Why Development has them is not established here.

**Finding.** Development D1 is out of step with B2, so a preview shows broken photos. It does not affect Production. Bringing Development in step is a Production-to-Development refresh (the `ops-d1-prod-dev-refresh` workflow and its sanitization check), which is a separate decision. The check is read-only and uses public URLs, so it can also run on a schedule as the photo-address monitor in #4683.

## Procedure

### Repeat the B2/D1 relationship check

1. Run `node scripts/ops/b2-d1-relationship-check.mjs --base https://www.lougehrigfanclub.com`.
2. Read the counts. Any failed photo is listed by its id and the reason (`http_404`, `not_an_image`, `timeout` or `network_error`).
3. Add `--fail-on-missing` to make the run exit with an error when any address fails.
4. Record the date and counts in the table above.

### Run the failed-deployment exercise (not yet run)

1. On a throwaway branch with no pull request, add a change that fails the Cloudflare Pages build and push it.
2. Confirm the preview build for that commit fails and that no Production deployment is created (the Production site, its health endpoint and the deployment marker, once #4696 is merged, are unchanged).
3. Confirm no Operations Issue opens for a branch-only failure, or record the one that does.
4. Delete the throwaway branch and record the result here.

It was not run today because observing the failed preview check for a branch with no pull request needs a tool the agent session does not have, and a throwaway pull request would start the full CI and exception paths for no benefit. Product Authority can run it, or approve a pull request for it.

### Run the deployment rollback exercise (not yet run)

Follow Part B of the rollback rehearsal in `docs/how-to/website/go-live-deployment-runbook.md`. It needs a named quiet window, a person or workflow with Cloudflare Pages deployment control, and a recorded result in that runbook's rehearsal record.

## Rollback

Revert this documentation commit. The exercises above changed no data and no deployment.
