---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How to create the three Zapier Zaps that post the daily social post to the Facebook Page, Instagram and Pinterest from GitHub hand-off Issues, and how to test and turn them off
Does Not Own: The hand-off job (see scripts/ops/social-post-dispatch.mjs); the posts themselves (see data/social-post-queue.json); the strategy (see /docs/reference/operations/social-posting-strategy-revised-2026-11.md)
Canonical Reference: /docs/reference/operations/social-posting-strategy-revised-2026-11.md
Related Issues: #5321, #5173, #5158, #5143, #5536
Last Reviewed: 2026-11-16
---

# Zapier Zaps for the daily social posts

## What this is

At each post's time (10:00 New York) the GitHub job `OPS — Social Post Hand-off to Zapier` opens one Issue per platform, labelled `social-post` and `social:<platform>`. The Issue **title** is the photo address and the Issue **body** is the post text. Each Zap watches for its label and posts. These replace the RSS Zaps (#5158). X is sent by Buffer from GitHub and needs no Zap.

## One repository, one label per platform (#5321)

All hand-off Issues open in this repository. No extra repositories, token or variables are needed. Each Issue carries two labels: `social-post` and `social:<platform>` (`social:facebook`, `social:instagram`, `social:pinterest`). Each Zap watches only its platform's label, so it never sees another platform's Issue. This works on the Zapier **Free** plan, which has no Filter step: the label is chosen in the trigger itself.

Which GitHub trigger to use, in order of preference (both are single-step Zaps, so they fit the Free plan):

1. **New Labeled Issue.** Repository: `wdhunter465/next-starter-template`. Label: `social:facebook` (or the other platform's label).
2. If the label cannot be chosen there, **New Issue Matching Search** with the search `repo:wdhunter465/next-starter-template is:issue label:social:facebook`.

Do not use plain **New Issue** on this repository: it fires for every Issue.

## Steps: create each Zap (three times)

1. Trigger: **GitHub**, event **New Labeled Issue** (or **New Issue Matching Search**, see above), set to that platform's label.
2. Action, one per Zap, using only the Issue's **Body** and **Title** (the Issue's own Title, not Milestone > Title):
   - Facebook: **Facebook Pages**, **Create Page Post**. Page: Lou Gehrig Fan Club. Message: Body. Photo: Title. Link: empty.
   - Instagram: **Instagram for Business**, **Publish Photo(s)**. Account: lougehrigfanclub. Caption: Body. Photo URL: Title.
   - Pinterest: **Pinterest**, **Create Pin**. Board: lougehrigfanclub. Title: a fixed title such as `Lou Gehrig Fan Club`. Description: Body. Image URL: Title. Link: `https://lougehrigfanclub.com`.
3. Leave each Zap off until you have checked the field mapping.

## Test

Do not use **Test action** on a live account: it posts for real. Use the sample Issue Zapier loads to check that Body and Title land in the right fields, then turn the Zap on. The first live run is the next 10:00 post. A Zap may post up to about 15 minutes after 10:00 on the Free plan.

## Turn off

Turn the Zap off in Zapier. Posts already published stay.

## Known limits

- A post that fails in a Zap is not retried by the site. Zapier's task history shows it, and the heartbeat (#5159) flags a post with no ledger row.
- A photo unsuitable for Instagram is left off Instagram in the queue; no Issue is opened for that platform.
- Hand-off Issues close themselves after 3 days.
