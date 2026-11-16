---
Doc Type: Reference
Audience: Product Authority, Operations, and implementation agents
Authority Level: Controlled
Owns: The revised social posting strategy: how a post moves from the repository to the tools to the platforms, the daily schedule, and the messaging calendar through June 2027
Does Not Own: The post texts and photos (see data/social-post-queue.json); platform accounts, plans and credentials; the original design and its history (see /docs/reference/operations/social-daily-post-automation-design.md)
Canonical Reference: /docs/reference/operations/social-daily-post-automation-design.md
Related Issues: #5173, #5143, #5158, #5170, #4416, #5196
Last Reviewed: 2026-11-14
---

# Revised social posting strategy (2026-11-10)

## Decision

Product Authority, 2026-11-10: consistency of daily posting comes first. The RSS feed path (#5158) was awkward in practice: field-mapping mistakes put two wrong posts on the Facebook Page on 2026-11-09, polling can run 15 minutes late, and each Zap had to interpret a feed. It was retired from the daily path, and Product Authority removed the Zapier RSS Zaps and the feed route from the repository on 2026-11-12 (#5158).

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

The queue's `platforms` list decides where a post goes. The checks are in the queue checker, not in the Zaps.

**Media rule: fit, pad, never crop (Product Authority, 2026-11-12, #5196).** A photo is adapted to each platform by fitting the whole photo inside the allowed frame and filling the rest with one neutral background. It is never cropped and never distorted. The original is never changed.

| Item | Standard |
| --- | --- |
| Background colour, every platform | `#f5f1e8` (the paper tone of the cleared photos) |
| Instagram | Limits: ratio 4:5 to 1.91:1, JPEG, up to 8 MB, width 320 to 1440 px (Instagram Graph API, `ig-user/media`). A photo inside the ratio is only scaled to 1080 px wide. A taller photo is padded at the sides to 1080x1350. A wider one is padded above and below to 1080x566. The Instagram Issue title is `/api/social/image/<id>?for=instagram`. |
| Pinterest | 2:3 recommended; the original is sent. A photo taller than 2:3 (width/height under 2/3) may be cut off in feeds (Pinterest creative best practices). See the per-photo table below. |
| X | JPG, PNG, GIF or WEBP up to 5 MB; photos between 2:1 and 3:4 (width/height from 0.75 to 2.0) show in full, others are cropped in the feed preview only (X media best practices). The original is sent and the full photo stays one tap away. A padded X variant is not built (decision open for Product Authority). |
| Facebook Page | Organic Page photo upload accepts native aspect (Graph API `/{page-id}/photos`); max 10 MB. Feed *guidance* prefers 4:5. Research on #5196; Product chooses A (original) vs B (reuse 4:5 pad) on #5291. Until then the original is sent. |

### Cleared photos vs platform rules (recorded 2026-11-15, #5196)

Sizes from `social-audit` evidence (`photo.width` / `photo.height`). Ratio is width÷height.

| Photo | Size | Ratio | Instagram | Pinterest (2:3) | X feed preview (3:4…2:1) |
| --- | --- | --- | --- | --- | --- |
| 858 | 1858×2914 | 0.638 | Pad (below 4:5) | May cut off (taller than 2:3) | Preview crop (below 3:4) |
| 859 | 1024×768 | 1.333 | In range (scale only) | OK | Full |
| 860 | 1774×2272 | 0.781 | Pad (below 4:5) | OK | Full |
| 862 | 1859×2015 | 0.923 | In range (scale only) | OK | Full |
| 864 | 2424×3397 | 0.714 | Pad (below 4:5) | OK | Preview crop (below 3:4) |

Live check 2026-11-15: post `2026-11-15-daily` (photo 859) — dispatch run `43728316005` success; Instagram hand-off #5295 title uses `?for=instagram`; that URL returned HTTP 200 (JPEG served). Facebook #5294 and Pinterest #5296 opened the same run.

How the Instagram variant is made: before each hand-off, the posting job fetches the original from the site (public only from the publish time), pads it with `scripts/ops/social-pad-variant.mjs`, and stores it in the photo bucket at `social-variants/instagram/<photo id>.jpg`. The upload is additive and never overwrites or deletes. The image route serves that object for `?for=instagram`, only after the post's publish time and only while the photo is rights-cleared. If the variant is missing the route returns an error: it never falls back to the original for Instagram. The geometry and the Instagram limits are covered by `tests/social-pad-variant-5196.test.mjs`. No Cloudflare setting or binding is changed.

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

- **Content supply (decided 2026-11-12).** Only five photos are rights-cleared. Product Authority chose to reuse them with new launch text: a photo may repeat but not within 4 days of its last use, and Instagram posts use a padded variant of the photo (#5196), so no cleared photo is left off Instagram. Posts for 2026-11-13 to 2026-11-30 are queued; the posts from 2026-12-01 need the new footer wording (#2093). More cleared photos still make the rotation less repetitive.
- **Zaps.** Product Authority creates the three GitHub-triggered Zaps (`docs/how-to/ops/social-feed-zaps-setup.md`) The old RSS Zaps are removed.
- **Verification.** Confirm the Zapier GitHub "New Labeled Issue" trigger is on the Free plan.
