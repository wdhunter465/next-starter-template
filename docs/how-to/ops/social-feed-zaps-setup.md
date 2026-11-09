---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How to create the three Zapier Zaps that post the daily social post to the Facebook Page, Instagram and Pinterest from the site's social feed, and how to test and turn them off
Does Not Own: The feed and image routes (see functions/api/social/feed.ts and functions/api/social/image/[id].ts); the posts themselves (see data/social-post-queue.json); the design and its decisions (see /docs/reference/operations/social-daily-post-automation-design.md); the daily recipe on #4416
Canonical Reference: /docs/reference/operations/social-daily-post-automation-design.md
Related Issues: #5158, #5143, #4416
Last Reviewed: 2026-11-09
---

# Zapier Zaps for the daily social feed

## What this is

The site publishes `https://www.lougehrigfanclub.com/api/social/feed`, an RSS feed. A post appears in it at its publish time (10:00 America/New_York) and not before. Each Zap watches the feed and posts each new item to one platform. On the Free plan, RSS by Zapier checks about every 15 minutes, so a post can go out up to a quarter hour late. Each Zap uses 1 task per post, 3 tasks a day, about 90 of the 100 free tasks a month.

X is not part of these Zaps (see #5157).

## Create each Zap (three times)

1. Trigger: **RSS by Zapier**, event **New Item in Feed**. Feed URL: `https://www.lougehrigfanclub.com/api/social/feed`.
2. Action, one per Zap:
   - **Facebook Pages**, **Create Page Post**. Page: Lou Gehrig Fan Club (103961431551844). Message: the item's Description. Link: leave empty. Photo: the item's Enclosure URL.
   - **Instagram for Business**, **Publish Photo(s)**. Account: lougehrigfanclub (17841451674874751). Caption: the item's Description. Photo URL: the item's Enclosure URL.
   - **Pinterest**, **Create Pin**. Board: lougehrigfanclub (1041176076293290189). Title: the item's Title. Description: the item's Description. Image URL: the item's Enclosure URL. Link: `https://lougehrigfanclub.com`.
3. Leave each Zap **off** until the test below passes.

## Test before turning on

1. Zapier loads a sample item from the feed. Before 10:00 on a day with a queued post the feed is empty; use the previous day's item as the sample, and use Zapier's **Test action** only if you accept that it posts for real.
2. The Instagram image must be a JPEG within Instagram's aspect-ratio limits. Photo 864 is taller than 4:5 and photo 859 is wide; check each post's crop (see /docs/reference/operations/social-daily-post-queue-2026-11.md) or skip Instagram for that day.
3. Turn a Zap on, and confirm the next 10:00 post appears once on that platform.

## Turn off

Turn the Zap off in Zapier. Posts already published stay.

## Known limits

- The feed lists the 20 newest published posts. A Zap created late does not repost old items; it starts from the newest item at creation.
- A post that fails in a Zap is not retried by the site. Zapier's task history shows the failure; the Phase 5 heartbeat (#5159) will flag a missing post.
