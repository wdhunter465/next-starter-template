---
Doc Type: How-to
Audience: Human + AI
Authority Level: Supporting
Owns: How to propose a rights-cleared picture for each story with the read-only matcher
Does Not Own: Writing the match to D1 (a separate, gated change that needs a Go) or any rights decision
Canonical Reference: /docs/reference/website/lou-gehrig-rights-privacy-publication-review.md
Related Issues: #5253, #4427, #5244
Last Reviewed: 2026-11-14
---

# Match a cleared picture to each story

Product Authority decided on 2026-11-14 (#4427) that a story with no picture gets one chosen from its content: a story about Gehrig in 1934 gets a cleared picture from 1934. With no match, a default cleared picture is used and the story is flagged for a better match.

## Steps

1. Export the stories and the cleared pictures to a JSON file shaped `{ "stories": [...], "pictures": [...] }`. Stories carry `id`, `tag`, `title`, `text`, `event_date`. Pictures carry `id`, `title`, `year`, `era`, `people`, `teams`, `tags`, `publication_eligible`, `rights_hold`. Read only what the Production data read policy allows, and log the read on the working Issue.
2. Run `node scripts/content-pipeline/match-story-pictures.mjs input.json proposal.json`.
3. Read the proposal. Each row says the picture, the reason (same year, near year, subject words or default) and whether the story is flagged.

## Rules

- Only pictures that are publication-eligible and off rights hold are ever proposed.
- The closest year wins, then shared subject words, then the picture used by fewer stories, then the lowest id. The same input gives the same output.
- The script is read-only. Writing the proposal into D1 needs a source Issue, a pull request and an explicit Go, with a dry run first.
