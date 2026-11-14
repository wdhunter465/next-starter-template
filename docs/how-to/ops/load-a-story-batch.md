---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How a batch of stories is checked and loaded into the D1 story inventory as pending (draft) rows
Does Not Own: Approving or publishing a story, rights decisions, the Production data read policy, or the story inventory design
Canonical Reference: /docs/reference/operations/production-data-read-policy.md
Related Issues: #5244, #5225, #5224, #5226, #5231
Last Reviewed: 2026-11-14
---

# Load a story batch (pending only)

## Purpose

Product Authority gives Claude Code stories. This is how they enter the D1 story inventory (`content_inventory`) without hand-edited rows (#5098). The standing Go (Product Authority, 2026-11-14, on #5225) covers loading **pending** (`draft`) rows only. It does not cover approving, publishing or any other write.

## Steps

1. **Receive and log.** Each story gets a tag (a lowercase slug) and a line in the batch log on #5225.
2. **Check the facts.** List every factual claim and check each against at least three independent sources (Product Authority, 2026-11-13: three agreeing sources are enough). Record the three URLs. A claim that fewer than three sources agree on, or that sources contradict, is not loaded as verified: remove it or mark the story `unverified`. Text is never rewritten without Product Authority's OK. A quotation needs its exact source.
3. **Credit excerpts.** A story that excerpts a book carries `excerpt_of` (work, author, page when known), and its credit line names the author and the work, and the page when given. Jonathan Eig, *Luckiest Man*: credit every excerpt. A permission record is separate: only a person sets `permission_granted` (#5226), and excerpts are not published as permitted until it is set.
4. **Write the batch** as `data/stories/<date>-<name>.json` (shape: `data/stories/example-batch.json`). At most 100 stories. Open a pull request for it.
5. **Dry run on dev.** Dispatch **OPS: Story batch load** with `target=dev`, `mode=dry-run`, `confirm_write=confirm`. Read the plan in the job summary.
6. **Apply on dev,** then **dry run and apply on prod**, with the same inputs and `mode=apply`. Each run posts its result on #5225.
7. **Verify.** The result lists every tag, how many were inserted and how many were skipped because the tag already existed.

## What the loader does and does not do

- It inserts each story as a canonical `draft` row with `INSERT OR IGNORE` by tag. A re-run is safe.
- It never updates or deletes a row, never publishes, never makes a rights decision and never writes to B2.
- Wrong-database guards refuse a dev run against Production and the reverse.

## Rollback

Each result prints the rollback SQL: `DELETE FROM content_inventory WHERE canonical = 1 AND status = 'draft' AND tag IN (...)`, limited to that batch's tags and to rows still in `draft`. Run it only with Product Authority's say-so.

## After loading

Approval, a cleared picture in B2 and the rights decision are separate steps. A story counts toward the 396 target only when it is approved and has a cleared picture (#5231).

## Verification

Run `npx vitest run tests/story-batch-load-5244.test.mjs`. A dry run never writes.
