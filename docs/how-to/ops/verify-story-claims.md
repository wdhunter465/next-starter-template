---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How a story's factual claims are checked against trusted sources before the story is loaded or approved
Does Not Own: Editorial approval, rights decisions, or loading stories (see the story batch loader how-to)
Canonical Reference: /docs/reference/projects/content-collection-production-definition.md
Related Issues: #5224, #5225, #5226
Last Reviewed: 2026-11-14
---

# Verify a story's claims against trusted sources

## Purpose

Product Authority's rule (2026-11-13): a story is accurate enough when each of its factual claims is supported by at least three trusted sources. Jonathan Eig's *Luckiest Man* is a trusted source and the preferred tie-breaker when sources disagree. This procedure and `scripts/content-pipeline/verify-story-claims.mjs` apply that rule. Automation does the objective check and flags the rest. It does not decide a disputed fact.

## Steps

1. **List the claims.** For each story, write every factual claim a reader could check: dates, places, people, numbers, quotations, rankings. Each goes in the story's `claims` list in the batch file (`data/stories/<batch>.json`, shape in `data/stories/example-verification.json`).
2. **Cite the sources.** For each claim, list the sources and whether each one says `agree` or `disagree`. For a source that disagrees, put what it says in `says`. A web source gives its URL. A book gives its title, author and the page when known.
3. **Check the trusted list.** Only sources on `data/stories/trusted-sources.json` count. A source that is not on the list is reported and does not count toward the three. Product Authority confirms or edits the list.
4. **Run the check.**
   ```
   node scripts/content-pipeline/verify-story-claims.mjs data/stories/<batch>.json
   ```
   It prints each story as `READY` or `WORK` with a line for each flagged claim. It writes nothing and exits 1 when any story needs work.
5. **Fix what is flagged.** Find another trusted source, correct the claim, or remove it. Do not change a story's text without Product Authority's OK, and a quotation needs its exact source.
6. **Load only what is ready.** A story marked `three_source_verified` in the loader needs three distinct sources (`docs/how-to/ops/load-a-story-batch.md`).

## How a claim is judged

| Result | Meaning |
| --- | --- |
| `verified` | At least three distinct trusted sources agree and none disagrees. |
| `verified` (tie-break) | Eig is among at least three agreeing trusted sources, and the disagreement is recorded. |
| `conflict` | A trusted source disagrees and the tie-break does not apply. The report names the sources on each side. |
| `insufficient` | Fewer than three distinct trusted sources agree. Several pages from the same source count once. |
| `invalid` | A source is missing `agree` or `disagree`, or the claim has no text. |

A story is `verified_ready` only when it has at least one claim and every claim is `verified`.

## Eig credit

When a story excerpts *Luckiest Man*, its credit line names Jonathan Eig and the book, and the page when known (the loader enforces this). A permission record is separate: only a person sets `permission_granted` (#5226).

## Verification

Run `npx vitest run tests/verify-story-claims-5224.test.mjs`. The check is read-only.
