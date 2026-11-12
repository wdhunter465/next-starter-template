---
Doc Type: Reference
Audience: Product Authority, Operations, and implementation agents
Authority Level: Controlled
Owns: The revised social posting strategy: how a post moves from the repository to the tools to the platforms, the daily schedule, and the messaging calendar through June 2027
Does Not Own: The post texts and photos (see data/social-post-queue.json); platform accounts, plans and credentials; the original design and its history (see /docs/reference/operations/social-daily-post-automation-design.md)
Canonical Reference: /docs/reference/operations/social-daily-post-automation-design.md
Related Issues: #5173, #5143, #5158, #5170, #4416
Last Reviewed: 2026-11-10
---

# Revised social posting strategy (2026-11-10)

## Decision

Product Authority, 2026-11-10: consistency of daily posting comes first. The RSS feed path (#5158) was awkward in practice: field-mapping mistakes put two wrong posts on the Facebook Page on 2026-11-09, polling can run 15 minutes late, and each Zap had to interpret a feed. It is retired from the daily path and can be revisited later. The feed route stays in the site, unused.

## Flow

```
queue + messaging calendar in the repository (reviewed in a pull request)
        |  GitHub cron, every 30 minutes around 10:00 New York (and 18:00 from 2027-06-01)
        v
OPS jobs (ledger prevents a second send)
   X ............ Buffer API, channel GehrigFanClub                  (ops-social-post-x.yml)
   Facebook Page, Instagram, Pinterest:
        one GitHub Issue per platform, labelled social-post + social:<platform>
        title = image address, body = the post text exactly         (ops-social-post-dispatch.yml)
        |
        v
one Zap per platform, trigger GitHub "New Labeled Issue", then the platform action
```

The Zap maps only two fields: Issue Body to the message, caption or description, and Issue Title to the photo address. Nothing else is mapped, so there is little to get wrong. Each platform keeps the simple connection it already has in Zapier and Buffer. The photo address is the existing site route `/api/social/image/<id>`, public only from the post's publish time.

## Platform differences

The queue's `platforms` list decides where a post goes. A photo that does not suit a platform (for example too tall for Instagram) is left off that platform in the queue, and no Issue is opened for it. The checks are in the queue checker, not in the Zaps.

## Schedule

| Dates | Posts per day |
| --- | --- |
| 2026-11-10 to 2027-05-31 | 1, at 10:00 New York |
| 2027-06-01 to 2027-06-08 | 2, at 10:00 and 18:00 New York |
| From 2027-06-09 | 1, at 10:00 New York |

A post later than 4 hours after its time is skipped and opens an Operations Issue (existing heartbeat, #5159). The queue checker also reports any day or slot in the next 14 days with no approved post.

## Messaging calendar

Held in `data/social-messaging-calendar.json` and enforced by the queue checker for posts from 2026-11-13 (earlier posts are grandfathered).

| Dates | Every post promotes |
| --- | --- |
| 2026-11-10 to 2027-01-31 | the website launch |
| 2027-02-01 to 2027-04-30 | the fundraiser |
| 2027-05-01 to 2027-05-27 | the fundraiser and auction |
| 2027-05-28 to 2027-06-08 | the fundraiser, auction and MLB Lou Gehrig Day 2027 |
| From 2027-06-09 | nothing promotional (no fundraiser, auction or website-launch wording) |

## Cost and limits

$0. Zapier Free allows 100 tasks a month; three Zaps at one post a day use about 90, and the June double-posting week adds about 24 more. Buffer Free holds 10 queued posts; the job sends each post at once, so the queue limit does not apply. Zapier's GitHub trigger polls about every 15 minutes on the Free plan, so Facebook, Instagram and Pinterest can post up to about 15 minutes after 10:00.

## Open items

- **Content supply (decided 2026-11-12).** Only five photos are rights-cleared. Product Authority chose to reuse them with new launch text: a photo may repeat but not within 4 days of its last use, and Instagram is listed only for the photos that fit its aspect ratio. Posts for 2026-11-13 to 2026-11-30 are queued; the posts from 2026-12-01 need the new footer wording (#2093). More cleared photos still make the rotation less repetitive.
- **Zaps.** Product Authority creates the three GitHub-triggered Zaps (`docs/how-to/ops/social-feed-zaps-setup.md`) and turns the three RSS Zaps off first, or each post goes out twice.
- **Verification.** Confirm the Zapier GitHub "New Labeled Issue" trigger is on the Free plan.
