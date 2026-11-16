---
Doc Type: How-to
Audience: Human + AI
Authority Level: Supporting
Owns: How each daily social post is saved into the archive, what the saved row holds, how to run or back-fill it, and what a person still decides
Does Not Own: Which posts are sent (data/social-post-queue.json and the posting workflow), rights decisions, or approval to publish
Canonical Reference: /docs/reference/operations/social-daily-post-automation-design.md
Related Issues: #5097, #5143
Last Reviewed: 2026-11-16
---

# Saving daily social posts to the archive

## Purpose

Text plus photo together make up the LGFC archive (Product Authority, 2026-11-05). The text of each daily post used to exist only in Buffer, Zapier and the platforms. After the posting step, the workflow now asks the site to save each sent post as one `content_items` row, so the text sits beside the photo in D1.

## What is saved

One row per post, keyed `social-post-<post id>`, built on the server from the reviewed queue (`data/social-post-queue.json`) and the send ledger, never from anything the caller sends:

- `title` is the topic, `summary` is the post text, `content_type` is `timeline_fact`, `publication_target` is `social`, `source_name` is "LGFC daily post".
- `source_metadata` holds the photo id and alt text, the citation, the platforms planned, and the platforms the ledger shows as posted, each with its platform post id and time.
- A post is saved only once its publish time has arrived and the ledger shows it posted on at least one platform. A failed attempt saves nothing.

## What a person still decides

Automation sets no decision. Every row is `pending_review`, `not_ready` and `rights_status = unknown`; the photo keeps its own rights status. A person reviews the row and sets its rights and approval in the admin tools. A rerun refreshes only the sent-post details and never changes what a person decided.

## Procedure

1. **Normal run.** The scheduled X posting workflow runs `scripts/ops/social-archive-sync.mjs` after the posting step, for posts from the last 3 days. The step is marked continue-on-error, so a failure here never blocks the post and nothing is posted twice. The next run catches up.
2. **See what it would do.** With the bridge token in your environment: `node scripts/ops/social-archive-sync.mjs --dry-run`.
3. **Back-fill** the posts already in the queue: `node scripts/ops/social-archive-sync.mjs --all`. It is idempotent, and a post not yet recorded as sent is skipped, not failed. This writes to the Production database through the site, so it needs a recorded Go on #5097 before it is run there.
4. **Read the result.** The report lists, per post, the row id and the platforms, or why it was skipped or failed. Exit code 1 means a call failed.

## Not covered

The posts of 2026-11-04 to 2026-11-08 predate the queue file. Their exact text and platform post ids are not held in the repository, so they are not back-filled by this script; they need the posted text from the platforms and are listed on #5097.
