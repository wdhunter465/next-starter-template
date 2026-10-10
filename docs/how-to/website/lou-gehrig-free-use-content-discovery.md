---
Doc Type: How-To
Audience: LGFC content operators, collection run owners, and AI implementation agents
Authority Level: Operational Procedure
Owns: Search strategy for finding Lou Gehrig content (stories and images) that is free to use with source credit
Does Not Own: Rights conclusions, the source allowlist, collector code, or publication approval
Canonical Reference: /docs/reference/content-pipeline-rights-data-dictionary.md
Related issues: #4521, #3551, #4405
Last Reviewed: 2026-10-10
---

# Lou Gehrig Free-Use Content Discovery

## Purpose

The LGFC content library needs text-based stories to pair with pictures. This page sets out where to search for content that is free to use as long as LGFC cites the source, so the library grows faster than permission requests alone allow.

"Free to use" here means the source states the license itself. Collection records what the source asserts. A human still sets the rights conclusion (#3551).

## Hosted content only (no link-only content)

LGFC collects only content it can host and display on its own site: full text, an image, an excerpt with credit. A lead whose value is "go read this on another site" is not collected.

- Members stay on the LGFC website. Content must not send them away to read it.
- Content must not open new tabs or switch the site the member is viewing, because that degrades the experience.
- The credit line names the source, author and license in text on the page. A plain citation URL may sit in the credit line, but it is never the content itself.
- If a source's terms do not allow hosting (no license, rights retained, no permission), the item is not link-only content. It goes to the permission form letter, and stays on hold until LGFC may host it.

## What counts as free to use with credit

| Signal | Use | Credit needed |
| --- | --- | --- |
| CC0, Public Domain Mark | Yes | Courtesy credit |
| US government work (NPS, NARA, NIH, Library of Congress staff work) | Yes | Courtesy credit |
| Published in the US before 1931 (public domain as of 2026) | Yes, after the date is checked | Courtesy credit |
| CC BY | Yes | Required: author, title, license, link |
| CC BY-SA (for example Wikipedia text) | Yes, if LGFC can share the adapted text under the same license | Required, plus same license on adaptations |
| CC BY-NC, CC BY-ND | Not by default | Treat as permission-needed (see the permission form letter) |
| "Rights retained", "all rights reserved", no statement | No | Use the permission form letter |

Publication year alone is not enough for later works. A 1939 text may still be under copyright, so check renewal and the source's own statement.

## Where to search, by what each is good for

### Text stories

| Source | What to look for | Reuse terms | Status |
| --- | --- | --- | --- |
| Wikipedia and Wikisource (API) | Gehrig, 1927 Yankees, "Luckiest Man" speech, Gehrig's Appreciation Day | CC BY-SA text | Not yet collected |
| Library of Congress, Chronicling America | Newspaper stories on Gehrig, 1920–1930 | Public domain before 1931 | Not yet collected; `loc.gov` is blocked from the cloud sandbox |
| Internet Archive | Books, magazines, newsreels before 1931; 1927 column series "Following the Babe" (Oakland Tribune, Pittsburgh Press, Ottawa Daily Citizen) | Per item; check each license field | Not yet collected |
| National Archives (NARA) | "An Awful Lot to Live For: Lou Gehrig's Final Season in the News" text and the Universal News newsreel | Government-held; host a copy only after rights are verified | Lead found, rights to verify |
| NPS, NIH, and other US agencies | ALS history and Gehrig stories | US government work | Not yet collected |
| Open-access library repositories (university digital collections) | Columbia-era stories and photos | Per item | Not yet collected |

### Images

| Source | Reuse terms | Status |
| --- | --- | --- |
| Wikimedia Commons | Per file, license field is machine-readable | Collected (20 new candidates in the 2026-10-10 run) |
| Library of Congress 1930 Keystone stereograph | "No known restrictions on publication" | Lead found |
| The Met Open Access | Per object | Lead found, check flag |
| Openverse | Per item | Needs API credentials |

### Checked and not free to use

These came up in searches and are not free-use by default. Use the permission form letter if the content is wanted.

- SABR articles, the Columbia research guide and similar pages that are only worth a link: excluded as link-only content.
- SABR BioProject biographies and SABR Rucker Archive images: jointly owned by SABR and the authors; no open license found.
- Detroit Public Library Ernie Harwell collection: rights retained by the library.
- Densho Nippu Jiji archive: copyright restricted, non-commercial educational use allowed by the holder.
- Baseball Hall of Fame photographs and papers: access and permission through the Giamatti Research Center.
- *Lou Gehrig: The Lost Memoir* (Simon & Schuster, 2020): modern copyrighted edition. The 1927 newspaper columns it draws on may be public domain, but the book is not.
- Fordham Internet Modern History Sourcebook transcript of the 1939 speech: copyright status not established.

## Procedure: search recipes

For each source, run a query set rather than one query:

1. **Person:** "Lou Gehrig", "Henry Louis Gehrig", "Iron Horse", "Larrupin' Lou".
2. **Events:** "Gehrig Appreciation Day", "Luckiest Man", "consecutive games", "1927 Yankees", "Murderers' Row", "Columbia University baseball".
3. **People around him:** Eleanor Gehrig, Babe Ruth, Wally Pipp, Miller Huggins, Joe McCarthy.
4. **Stories, not just pictures:** add words such as "story", "column", "recollection", "profile", "obituary", "tribute".
5. **ALS:** "Lou Gehrig disease history", "Mayo Clinic 1939".

For free-use searching, also filter by license where the source allows it: Openverse and Commons license filters, Internet Archive `licenseurl`, Chronicling America date range 1920–1930.

## Recording

Every candidate found must record, at collection time:

- `source_url`, `source_name`, `source_owner`, and `date_accessed`;
- `credit_line` exactly as the source states it;
- the source's own license or rights text in `rights_evidence`;
- `review_status = pending_review` and `publication_status = not_ready`.

Pair text with images: when a story candidate and an image candidate share a person, event, or year, record the link in `admin_notes` so editors can publish them together.

## Out of scope

This page does not add sources to the #3551 allowlist. Any domain outside the allowlist needs a governance decision before an automated collector may use it.
