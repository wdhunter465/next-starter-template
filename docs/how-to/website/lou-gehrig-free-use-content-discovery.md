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

## Collection versus admission

Two separate stages:

1. **Search collects.** Every search records the URL and provenance for everything it finds, whatever its rights or format, including fee-required items and items that cannot be hosted. Search does not judge relevance or decide use.
2. **Evaluation admits.** The content evaluation process in the repository decides what is relevant and what is admitted into the B2 and D1 libraries.

Admission and website display are hosted-only:

- LGFC admits only content it can host and display on its own site, so members stay on the LGFC website.
- Content must not open new tabs or switch the site the member is viewing, because that degrades the experience.
- The credit line names the source, author and license in text on the page. A plain citation URL may sit in the credit line, but it is never the content itself.
- A found item that cannot be hosted (no license, rights retained, no permission) keeps its collection record. It goes to the permission form letter and stays on hold until LGFC may host it, or it is rejected. It is never turned into a link on the site.

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

These came up in searches and are not free-use by default. Search still records them. Use the permission form letter if the content is wanted.

- SABR articles, the Columbia research guide and similar pages that are only worth a link: recorded at collection, but evaluation will not admit them to the libraries.
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

## Recording: one record shape for every search

Every search, from every source, records the same fields, so LGFC can always account for where an item came from. The fields below already exist on the candidate and its `rights_evidence` row (see the rights data dictionary).

| Field | What it holds |
| --- | --- |
| `source_name`, `source_domain`, `source_url` | Where the item was found |
| `source_owner` | The actual creator or rights holder, not just the host site |
| `date_accessed` and the search run (`run_uid`, query, source) | When and how it was found |
| `credit_line` | The credit exactly as the source states it |
| `evidence_text` | The source's own license or rights text, unedited |
| `evidence_type`, `evidence_url` | Kind of evidence and the page it came from |
| `contact_info` | How to reach the owner, when offered |
| `usage_decision`, `conclusion`, `reviewer` | LGFC's decision and who made it |

New candidates start at `review_status = pending_review`, `publication_status = not_ready` and `usage_decision = hold`.

### Usage categories

Every collected item falls into exactly one of these.

| Category | When it applies | `usage_decision` | `conclusion` | Credit on the page |
| --- | --- | --- | --- | --- |
| Free use | Public domain, CC0, US government work | `permit` | `public_domain_confirmed` | Courtesy credit |
| Free use with credit cited | The source's license allows use if credited (CC BY, CC BY-SA, stated "use with credit") | `permit` | `permission_granted`, `evidence_type` names the license | Required: `credit_line` plus license |
| Free use with permission given | The owner granted permission in writing after our request | `permit` | `permission_granted`, evidence is the stored reply | Exactly as the owner specified |
| Fee required | The source or owner wants payment or a license fee | `deny` | none | None: never published |
| Unknown or unclear | No usable statement | `hold` | none | None until resolved |

### Content that costs money: record it, flag it, never use it

LGFC does not pay for content. If a source says a fee, license charge or payment is required:

1. Still record the item with the full set of fields above, with the fee wording in `evidence_text`, so the same item is not re-researched.
2. Set `usage_decision = deny` and add `FEE REQUIRED: DO NOT USE ON LGFC WEBSITE` to `admin_notes`.
3. Never publish it, never send a permission letter for it unless the owner offers a free grant, and exclude it from publication prep.

Content that needs a written permission but no fee goes to the permission form letter and stays on `hold` until a grant arrives.

### Gaps to close in code

Today a fee-required item and a permission-needed item both land on `deny` or `hold`, and CC license use and a written grant both use `permission_granted`. The distinction is only in free text. A follow-up Issue adds explicit structured fields (`usage_basis` and a fee flag) and applies them in the collector so every search records them the same way.

Pair text with images: when a story candidate and an image candidate share a person, event, or year, record the link in `admin_notes` so editors can publish them together.

## Out of scope

This page does not add sources to the #3551 allowlist. Any domain outside the allowlist needs a governance decision before an automated collector may use it.
