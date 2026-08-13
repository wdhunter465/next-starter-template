---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts for public FAQ browse and Ask submission
Does Not Own: How-to procedures; operational runbooks; governance policies; admin FAQ/Ask queues
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #3074, #3148
Last Reviewed: 2026-08-08
---

# FAQ & Ask — Consolidated Public Workflow — LGFC

**Canonical route:** `/ask`
**Legacy compatibility route:** `/faq` → redirects to `/ask/` (query string preserved)
**Access:** Public
**Header state:** Visitor header (public)

-----

## Purpose

Product Authority consolidated Ask and FAQ under `/ask` (#3074). The canonical page provides:

1. Full approved FAQ listing (search, expand/collapse, pin ordering, view-count tracking)
2. Ask a Question submission (identity fields + question intake)

Homepage FAQ teaser (`FAQSection`) remains a browse teaser and links into `/ask`, not a competing canonical FAQ route.

-----

## Canonical Page Layout (`/ask`)

```
[Global Header]
[Page Container — max-width ~900px]
  [Page Title — H1: "FAQ & Ask a Question"]
  [Intro]
  [FAQ browse — H2]
    [Search Bar]
    [FAQ List — expandable]
  [Ask form — H2 / #ask-form]
    [Form fields]
    [Submit]
    [Contact mailto]
[Global Footer]
```

-----

## FAQ Browse (on `/ask`)

Loads up to 50 approved, answered FAQ entries on mount via `GET /api/faq/list`.

### Ordering

1. Pinned entries first (`pinned = 1`)
2. Then by most recently updated (`updated_at DESC`)

### Search

- Client-side filtering of the loaded set (question + answer text)
- Initial query may come from `?q=` (including `/faq?q=` compatibility redirects)

### View Count

Expanding an FAQ item fires `POST /api/faq/view` (fire-and-forget). Multiple items may stay expanded.

-----

## Ask Form (on `/ask` `#ask-form`)

| Field       | Type     | Required | Notes                                           |
|-------------|----------|----------|-------------------------------------------------|
| First name  | text     | Yes      | Non-empty after trim                            |
| Last name   | text     | Yes      | Non-empty after trim                            |
| Screen name | text     | No       | Optional; empty stored as null                  |
| Email       | email    | Yes      | Valid email; max 254 chars                      |
| Question    | textarea | Yes      | Min 10 characters after trim                    |

### Submission

`POST /api/ask`

- Success: “Your question has been submitted. We’ll reply by email.”
- Error: “Submission failed. Please try again.”
- Contact mailto: `mailto:Contact@LouGehrigFanClub.com?subject=Contact%20Needed%20ASK`

`/ask` does **not** write directly to `faq_entries`.

-----

## Legacy `/faq` Compatibility

- `/faq` and `/faq?q=…` are not a competing canonical workflow.
- Behavior: client redirect to `/ask/` with the same query string (same pattern as `/login` and `/auth` legacy routes).
- Active navigation and homepage CTAs must target `/ask`, not `/faq`.

-----

## Related

- Homepage FAQ section — teaser; CTAs to `/ask`
- `/join` — identity field behavior for Ask
- Admin FAQ/Ask queues — separate moderation surfaces
- `docs/reference/website/lgfc-website-as-built-current.md` — current disposition
