---
Doc Type: How-to
Audience: Human + AI
Authority Level: Supporting
Owns: How to collect candidates from lougehrig.com with the opt-in collector source, and what the tags on them mean
Does Not Own: Importing the candidates into D1 (a separate, gated change that needs a Go), any rights decision, or what the fan club shows
Canonical Reference: /docs/reference/website/lou-gehrig-rights-privacy-publication-review.md
Related Issues: #4839, #4368, #4527
Last Reviewed: 2026-11-21
---

# Collect candidates from lougehrig.com

lougehrig.com is the Lou Gehrig site run for CMG Worldwide. Product Authority asked on 2026-10-24 that its photo gallery, About pages and news be collected, with the URL and provenance of everything found. The collector reads the site's own WordPress REST API (pages, posts and media) and the gallery page's captions. It records metadata and provenance only: it downloads nothing, stores nothing in B2 and writes nothing to D1.

## Steps

1. Run `node scripts/content-pipeline/collect-gehrig-external-sources.mjs --sources lougehrig --out <file>`. The source is opt-in: it is not in the default list, so scheduled discovery is unchanged. It needs outbound access to `lougehrig.com`. In a Node setup that ignores the proxy, set `NODE_USE_ENV_PROXY=1`.
2. Read the output. Each candidate is `rights_status: unknown`, `review_status: pending_review`, `publication_status: not_ready`. A run finds about 55: 35 photos, 7 About pages, 13 news items (2026-11-21).
3. Importing the run needs a `sources` row for `lougehrig.com` (the search-run record points at it). That row is a migration, so it is a Production D1 write with its own Issue, pull request and Product Authority's Go. Until then, keep the output as a file.

## What the tags mean

| Tag | Meaning |
| --- | --- |
| `third-party-credit`, `ap`, `getty`, `hold-do-not-host` | The photo's own caption credits AP or Getty Images. Product Authority decided on 2026-11-19: held, not hosted, until written consent covers it. The caption's `id` ties each credit to its own photo; most gallery photos have no caption and so no stated credit. |
| `news-current`, `news-older-than-12-months` | Whether a news item is within 12 months of the run. Older items are still recorded; only current ones can go in a fan club news section. Most items are articles republished from other outlets, so each needs rights review. |
| `als-subject`, `als-mentioned` | The page slug or title is about ALS, or the body mentions it. The content rule of 2026-11-01 keeps ALS as a disease out of scope; the content quality gate makes the call, the tag only routes it. |

## Rules

- Collection never decides rights. The site's footer says "© Lou Gehrig" and its licensing page names CMG Worldwide as exclusive agent without stating terms; Product Authority's read of CMG's reply is not legally binding and written consent is still needed.
- The AP and Getty hold does not depend on the tag alone: a person records the rights conclusion in the admin rights flow.
- The site is small, so the `--limit` option does not cap this source; it fetches all pages, posts and media once per run.
