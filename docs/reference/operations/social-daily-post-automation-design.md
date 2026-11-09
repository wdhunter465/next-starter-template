---
Doc Type: Reference
Audience: Product Authority, Operations, and implementation agents
Authority Level: Controlled
Owns: The design for publishing the daily social posts from a scheduled GitHub Actions job without a Claude session: requirements, options, the recommended architecture, the queue and ledger data model, failure handling, rollout phases and the decisions Product Authority must make
Does Not Own: The daily post recipe (recorded on #4416); the posts themselves (see /docs/reference/operations/social-daily-post-queue-2026-11.md); the Zapier payload contract for fundraiser posts (see /docs/reference/operations/social-crosspost-zapier-payload-contract.md); platform accounts, plans, costs and credentials; the 2026-12-01 and 2027-01-01 footer wording (see #2093)
Canonical Reference: /docs/reference/operations/social-crosspost-zapier-payload-contract.md
Related Issues: #5143, #5144, #4785, #4416, #4938, #4253, #4917, #5075, #2093, #5131
Last Reviewed: 2026-11-09
---

# Daily social posts from a schedule, not from a session

## Purpose

Records a design so the daily post goes out on time whether or not anyone has a Claude session open. It is design only: nothing here is provisioned, no credential is created and no workflow exists yet. Each phase below becomes its own Issue after Product Authority answers the decisions at the end.

## Why now

- The posts for 2026-11-06 and 2026-11-07 were missed. A missed date is not recovered (Product Authority, 2026-11-08).
- Today a post exists only when a Claude session builds and sends it: Buffer for X, and Zapier actions for the Facebook Page, Instagram and Pinterest. No session means no post.
- The photo bucket is private (#5131). A photo address is a signed link that expires after one hour, and both Buffer and the Zapier actions take only an address that anyone can download. A post queued for later loses its image.

## Requirements

1. **Unattended.** A post is published at its set time with no person and no session.
2. **Idempotent.** A post is never sent twice to one platform, even if the job runs again or is delayed.
3. **Independent platforms.** A failure on one platform does not stop the others.
4. **$0.** Zapier Free (100 tasks a month, two-step Zaps) and Buffer Free (3 channels, 10 queued posts); no trial or paid plan (Product Authority, 2026-10-28 and 2026-11-04). Extra free tools are allowed.
5. **Rights.** Only photos from the public rights-cleared list; nothing else is ever sent.
6. **Reviewed content.** The text, photo and alt text are reviewed before they can go out.
7. **Visible failure.** A failed or missing post opens one Operations Issue, using the existing escalation (`scripts/ci/ops_runtime_escalation.mjs`).
8. **No catch-up.** A post that is late beyond a set window is skipped, not sent a day late.

## What exists today

| Piece | State |
| --- | --- |
| `ops-scheduled-content-publish.yml` | A cron job (14:00 and 15:00 UTC, which is 10:00 in New York across the clock change) that calls `POST /api/scheduled-content/publish-due`, idempotent, authenticated by a bounded bridge token. It publishes website content blocks and then posts a payload to one Zapier webhook. |
| Zapier webhook | `SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL` is not provisioned. Webhooks by Zapier is likely a premium app, not on the Free plan (#4785, to be confirmed on Zapier's pricing page). |
| Buffer | X channel `GehrigFanClub` connected. Free plan: 10 queued posts at a time. The API key or token route for an unattended caller is not confirmed. |
| Zapier actions | Facebook Pages "Create Page Post", Instagram for Business "Publish Photo(s)" and Pinterest "Create Pin" work through Claude's connector only. |
| Daily queue | `social-daily-post-queue-2026-11.md` holds four days of posts, written by hand. |

## Options

| Option | How it works | For | Against |
| --- | --- | --- | --- |
| A. Platform APIs called directly from the job | The job posts to Meta (Page and Instagram), Pinterest and X with its own tokens. | No middleman, no Zapier task limit, full control of failures. | Needs developer apps and possibly app review; Meta tokens expire and must be renewed; X has no free tier for new developers (pay per use about $0.015 a post, about $0.20 with a link, #4938). |
| B. Feed plus Zapier "RSS" triggers | The job publishes each due post to a public feed on the site. One Zap per platform watches the feed (RSS by Zapier, a free built-in app) and posts. | Free plan fits (a Zap is trigger plus one action); no webhook; no developer app; Zapier already holds the platform connections. | Zapier polls about every 15 minutes on the Free plan, so a post can be up to a quarter hour late; 3 tasks a day (about 90 of 100 a month) leaves little room; relies on Zapier staying free and connected. |
| C. Buffer as the scheduler | Queue posts in Buffer ahead of time. | Buffer sends on time even if the job is late. | 10 queued posts, and images must be public for the whole wait; only X is connected. |
| D. Manual posting in each platform's own scheduler | A person schedules in the native tools. | Free, no automation to break. | Not automation; already named as the fallback (Product Authority, 2026-11-04). |

**Recommendation: B for Facebook, Instagram and Pinterest, and A or C for X, with D as the standing fallback.** B is the only route that is free, needs no new developer apps and keeps working with Zapier's existing connections. For X, the job posts through Buffer if Buffer gives an unattended token (to be checked); otherwise X is paid per use or stays manual, which is Product Authority's call. Option A for the Meta platforms stays open as a later move if Zapier's limits bite.

## Recommended architecture

```
queue in the repository (reviewed in a pull request)
        |  every 30 minutes, 09:30 to 14:30 New York time (GitHub cron, in UTC)
        v
GitHub Actions job "publish due social posts"
   1. select posts whose time has arrived and that have no ledger row
   2. check the rules (rights-cleared photo, 280 characters, alt text, footer)
   3. copy the photo to a public social-image location (below)
   4. X: send through Buffer; write the post to the public feed
   5. write a ledger row per platform; open one Operations Issue on any failure
        |
        v
public feed on the site  --->  one Zap per platform (Facebook Page, Instagram, Pinterest)
```

### Public social-image location

**Decision update, 2026-11-09 (#5156):** the second public bucket is replaced by an image route on the site, `/api/social/image/<post id>`. It streams the one photo of one queued post from the private bucket, and only after that post's publish time has arrived and while the photo is still rights-cleared. It needs no new bucket, key or secret, copies nothing and has nothing to delete. The paragraph below describes the bucket option that was considered first and stays available if the route's bandwidth ever matters.

The photo has to be downloadable by the platforms at the moment they fetch it, and the main bucket is private. A post's photo is public the moment it is posted, so the job copies only that photo to a small separate public location (a second B2 bucket set to public, kept to images already published to social platforms, named by hash). No other file is ever copied there. The copy is deleted after a set number of days. This keeps the private bucket private and respects the rule that only rights-cleared items are public.

### Queue

Phase 1 is a reviewed file in the repository, one entry per post, changed only by pull request: `id`, `publish_at` (New York time), `topic`, `text`, `photo_id`, `alt_text`, `platforms`, `sources`, `status`. Phase 2 moves it to the D1 table proposed in #5075 once Product Authority approves that design.

### Ledger

A record of what was sent: post id, platform, the platform's own post id, time, attempt count. It is what makes the job idempotent. The repository is protected from direct pushes, so the ledger lives in D1 behind a bounded bridge endpoint, the same pattern as `publish-due` (a credential that can only record a post, not edit anything). A GitHub issue comment per post is the fallback if a database change is not wanted.

### Schedule and lateness

GitHub cron is best effort and can be delayed or skipped under load, so the job runs every 30 minutes across a window and relies on the ledger. A post may go out up to 4 hours after its set time (a rule value for Product Authority to set); after that it is skipped and an Operations Issue records the miss.

### Alerts

- A platform failure or a skipped post opens or updates one Operations Issue.
- A heartbeat: if the day's post has no ledger row by 12:00 New York time, an Issue opens.
- Token and quota watch: Meta tokens (renew before they lapse), Zapier tasks used against 100, Buffer queue size.

## Cost

$0 with option B plus Buffer on the Free plan. The one item that could cost is X: about $2 to $18 a quarter if X is sent through its own API (#4938). A second B2 bucket for social images stays far inside the free storage allowance.

## Risks

- Zapier's Free plan or its RSS trigger could change; the Zaps and the feed are small and easy to move to option A.
- A feed item is public the moment it is written. Only already-public content goes in it.
- Tokens expire (Meta). The alert above is the control.
- Instagram needs a photo within its aspect-ratio limits; the queue lists a crop or a skip per post.
- The footer changes on 2026-12-01 and 2027-01-01 (#2093); the queue carries the footer per post, so a change is a queue edit, not a code change.

## Rollout phases

| Phase | Deliverable | Needs |
| --- | --- | --- |
| 0, now | Posts prepared in the queue; a person or a session posts them. Optional interim: a scheduled Claude task (fresh session at 10:00 each day) runs the recipe. It is still a Claude session, only one that does not need a person. | Product Authority decides whether to run the interim task |
| 1 | Queue file, a checker for the rules, and a dry-run job that reports what would be posted. No posting. | D5 |
| 2 | Public social-image location and the ledger endpoint. | D3, D4 |
| 3 | X posting from the job. | D2 |
| 4 | Feed and the three Zaps (Facebook Page, Instagram, Pinterest). | D1 |
| 5 | Alerts, heartbeat and token watch. | none |
| 6 | D1 queue table from #5075; footer changes. | #5075 go |

## Decisions for Product Authority

- **D1.** Approve option B (feed plus Zapier RSS triggers) for Facebook, Instagram and Pinterest?
- **D2.** X: send through Buffer if it gives an unattended token, pay per use (about $2 to $18 a quarter), or keep X manual?
- **D3.** Approve a second public B2 bucket holding only the images of posts already published, deleted after a set time?
- **D4.** Ledger in D1 behind a bounded endpoint, or an issue comment per post?
- **D5.** Lateness window (proposed 4 hours) and send time (proposed 10:00 New York); review of the queue by pull request each week?
- **D6.** Run the interim scheduled Claude task for the days before Phase 4?

## Verification still to do

- Whether Buffer offers a token for an unattended caller on the Free plan.
- Whether RSS by Zapier is on the Free plan with the per-platform actions, and its real polling interval.
- Whether the Instagram action accepts a photo at the address of the public social-image location.
- Meta token lifetime for the Page and Instagram connection.
