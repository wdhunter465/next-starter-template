---
Doc Type: Report
Audience: Human + AI
Authority Level: Operational Evidence
Owns: The ranked source assessment for #4790, including which new adapters to build and which sources to leave alone
Does Not Own: Credentials, terms acceptance, a rights conclusion, collection from any source, or the adapters themselves
Canonical Reference: /docs/how-to/website/lou-gehrig-free-use-content-discovery.md
Related Issues: #4790, #4161, #4263, #4788, #4789, #4846, #4847, #4848, #4849
Last Reviewed: 2026-10-23
---

# Source assessment for a well-rounded Gehrig archive (#4790)

## Status

Documentation only. No live query was run, and no credential was requested in this pull request. Expected pre-1931 volume is therefore **not counted**. A row that says "low" means the source's own scope makes a large Gehrig set unlikely. It is not a hit count.

Already assigned, and not reopened here: Chronicling America (#4788) and the Internet Archive (#4789). The DPLA adapter already exists and is a verify step, not a new adapter (#4161). Retrosheet box scores are already ingested (#4263).

Build order for the new adapters, after #4788 and #4789:

1. NARA Catalog (#4846), after a key.
2. Europeana, 1931 and 1934 tours only (#4847), after a project key and terms acceptance.
3. Smithsonian Open Access, CC0 media only (#4848), after an api.data.gov key.
4. The Met, a probe before any adapter (#4849). No key.

## How a row was judged

Each row uses the source's own documentation, cited inline. "First-publication date" means a field the source itself calls a publication or creation date. A display date, a digitization date, or an aggregated date is a lead, not a first-publication date, and follows the rule in the canonical discovery how-to.

## Sources

### DPLA — verify the existing adapter, do not build another

| | |
| --- | --- |
| Access | REST API at `https://api.dp.la/v2`. An API key is required on every request. Request one with `POST https://api.dp.la/v2/api_key/YOUR_EMAIL`. ([Policies](https://pro.dp.la/developers/policies), [API Codex](https://pro.dp.la/developers/api-codex)) |
| Rate | DPLA does not ordinarily rate-limit. It may limit or revoke access for abuse that degrades the API for others. ([Policies](https://pro.dp.la/developers/policies)) |
| Terms | Use is under those policies. The key is tied to an email address. |
| Rights | The repository mapper already stores `sourceResource.rights` and `rightsCategory` as `dpla_rights_statement` evidence and states that DPLA is an aggregator: rights and media must be verified at the contributing institution. It does not set a rights conclusion. |
| Date | `sourceResource.date` (`displayDate` or `begin`) is captured as `dateOrPeriod`. That is the source's date, not an automatic first-publication date. |
| Volume | Not counted. DPLA aggregates many US libraries, so this is the highest-value existing adapter to verify once a key exists. |
| Credential | `DPLA_API_KEY`. Product Authority. |
| Recommendation | **Verify**, not build. #4161 remains the verification issue. |

### New York Public Library digital collections — do not build

| | |
| --- | --- |
| Access | Repository API v2, token or browser login. ([API home](https://api.repo.nypl.org/)) |
| Rate | 10,000 requests per day per token. ([API home](https://api.repo.nypl.org/)) |
| Terms | Metadata records are CC0. The content they describe is not. API use is non-commercial unless NYPL agrees at `repoapi@nypl.org`. ([Terms](https://api.repo.nypl.org/terms_conditions)) |
| Rights | `publicDomainOnly=true` returns items NYPL believes have no known US copyright restriction. Privacy and publicity rights can still apply. Four rights statements exist at capture level, including "No Known U.S. Copyright" and a CC0 dedication where NYPL holds a copyright. ([API home](https://api.repo.nypl.org/)) |
| Date | Capture-level metadata. Not treated here as a guaranteed first-publication date. |
| Volume | Not counted. The library reports 310,121 public-domain digital-collection items overall, not a Gehrig count. ([Digital Collections](https://www.nypl.org/digital-research/projects/nypl-digital-collections)) |
| Credential | A token, plus written agreement if use is commercial. |
| Recommendation | **Skip.** The API page says the Repo API is deprecated and will be unavailable starting 2026-08-01, with no public replacement planned. |

### HathiTrust and Google Books full view — manual only

| | |
| --- | --- |
| Access | HathiTrust Data API is a per-volume API (metadata, structure, page images, OCR), not a discovery search. Metadata access does not require authentication; page images and OCR depend on rights and, for some classes, location. ([Data API](https://www.hathitrust.org/sites/www.hathitrust.org/documents/hathitrust-data-api.pdf)) Google Books is a separate API with its own key and terms. ([Books API Terms](https://developers.google.com/books/terms)) |
| Rate | Not restated here. HathiTrust's acceptable-use policy governs use of the collection. ([Acceptable Use](https://www.hathitrust.org/the-collection/terms-conditions/acceptable-use-policy/)) |
| Terms | HathiTrust access depends on geography, bibliographic data, and rightsholder permission. Google Books API terms (last modified 2012-04-25) forbid charging users for the application without Google's permission, and require removal of allegedly infringing content. |
| Rights | HathiTrust `htd:access_use` values include `pd`, `pd-us`, `pd-google`, `cc-zero`, `restricted`, and others. A volume's own statement is the evidence. Google full view is not itself a public-domain conclusion. |
| Date | Bibliographic dates on the volume. A reprint date is not a first-publication date. |
| Volume | Not counted. Pre-1931 books and baseball annuals are the reason this row exists. The Internet Archive adapter (#4789) is the discovery path for that class of text. |
| Credential | HathiTrust member or dataset agreements for bulk research data. A Google API key for Books. |
| Recommendation | **Manual only.** Do not add a discovery adapter. Use #4789 for books, magazines, and newsreels. |

### Smithsonian Open Access — build, CC0 media only (#4848)

| | |
| --- | --- |
| Access | Public API on api.data.gov. An API key is required. ([Developer tools](https://www.si.edu/openaccess/devtools)) |
| Rate | The Smithsonian pages cited here do not publish a separate numeric cap. Honor the platform rate-limit headers on the key Product Authority obtains. |
| Terms | CC0 assets may be used commercially without Smithsonian permission, attribution, or fee. The user remains responsible for third-party trademark, privacy, and publicity rights. Non-CC0 items need written permission for commercial use. ([FAQ](https://www.si.edu/openaccess/faq)) |
| Rights | Machine-readable in the sense that the Open Access program marks CC0 assets, and the API withholds media when copyright or other limits apply while still releasing some metadata as CC0. ([Developer tools](https://www.si.edu/openaccess/devtools)) Keep a candidate only when the media itself is CC0. |
| Date | Object metadata. A museum date is a lead unless the record identifies it as publication. |
| Volume | Low for Gehrig specifically. The collection is museums and research centers, not a baseball archive. Worth building because the rights mark is clean, not because of volume. |
| Credential | api.data.gov key. Product Authority. |
| Recommendation | **Build** after the key. #4848. |

### The Met Open Access — probe, then decide (#4849)

| | |
| --- | --- |
| Access | Collection API. No registration and no API key. Base `https://collectionapi.metmuseum.org/public/collection/v1/`. ([Collection API](https://metmuseum.github.io/)) |
| Rate | 80 requests per second. The Museum says it does not require a key "at this time." |
| Terms | Materials marked Open Access are CC0 and may be used for any purpose without Museum permission. Other materials are limited to noncommercial, educational, personal, or fair use. The Museum does not warrant that use will not infringe third-party rights. ([Terms](https://www.metmuseum.org/en/policies/terms-and-conditions)) |
| Rights | `isPublicDomain` is a boolean on the **object** record, not a search parameter. Search with `q`, then read each object. |
| Date | `dateBegin` and `dateEnd` are search parameters and must be sent together. They are collection dates, not a first-publication field. |
| Volume | Low. This is an art museum. The probe exists so a zero result closes the idea instead of leaving an adapter in the queue. |
| Credential | None. |
| Recommendation | **Probe.** #4849. Use `/public/collection/v1.1/search` with a small page. The v1 search endpoint returns the entire result set and keeps that behavior only until 2026-10-01. Build an adapter only if the probe returns public-domain objects. |

### Flickr Commons — skip until a paid key and the NKCR statement are accepted

| | |
| --- | --- |
| Access | Flickr API. As of the help article updated 2025-08-06, requesting an API key is available only to Flickr Pro subscribers. ([Flickr API](https://www.flickrhelp.com/hc/en-us/articles/4404070036884-Flickr-API)) |
| Rate | Not restated here. Original and large downloads from Free accounts are restricted through the API. |
| Terms | Commons members use one statement: "no known copyright restrictions." That is not a Creative Commons license. The Flickr Foundation says CC0 or public-domain mark may be added later. ([How it works](https://www.flickr.org/programs/flickr-commons/flickr-commons-how-it-works/)) |
| Rights | NKCR means the member asserts no known copyright restriction. It is not a machine-readable CC license. |
| Date | Photo dates vary by member. Not a guaranteed first-publication date. |
| Volume | Not counted. Commons is described as about 2 million images across member institutions, not a Gehrig count. |
| Credential | Flickr Pro, plus an API key. Cost. |
| Recommendation | **Skip** until Product Authority accepts the Pro cost and the NKCR statement. |

### Europeana — build for the tours, project key only (#4847)

| | |
| --- | --- |
| Access | Search API. Send the key in the `X-Api-Key` header. Personal keys and project keys are different products. ([Accessing the APIs](https://europeana.atlassian.net/wiki/spaces/EF/pages/2462351393/Accessing+the+APIs)) |
| Rate | Personal-key limits were reduced through April 2026 so that service users would move to project keys. Be courteous between calls. ([API FAQ](https://europeana.atlassian.net/wiki/spaces/EF/pages/2360508417/API+FAQ)) |
| Terms | A key is confidential. Personal keys are individual non-production use, one per account. Project keys are for a production-scale service. Using the API accepts the terms. ([Terms of use](https://www.europeana.eu/en/rights/terms-of-use)) |
| Rights | `edm:rights` is the rights statement for the digital object. Keep only a public-domain or CC0 statement. Missing rights means applicable copyright law applies, so those records stay out. |
| Date | Provider metadata. Use it as a first-publication date only when the record says the date is publication. |
| Volume | Not counted. This row is for foreign coverage of the 1931 and 1934 tours, not a general Gehrig harvest. |
| Credential | Project API key, and terms acceptance. Product Authority. |
| Recommendation | **Build** after the project key. #4847. Do not run it on a personal key. |

### Columbia University libraries and the Spectator archive — manual only

| | |
| --- | --- |
| Access | The Spectator archive (1877–2015) is a searchable website. The archive page documents browse and search. It does not document a public API. ([Spectator archive](https://spectatorarchive.library.columbia.edu/cgi-bin/columbia)) |
| Rate | Not applicable. |
| Terms | Republication of Spectator content goes to `usagerights@specpublishing.com`. Archive questions go to `info@columbiaspectator.com`. |
| Rights | No machine-readable license field was found on the archive page. Pre-1931 issues are a lead only. |
| Date | Issue dates are browsable. An issue date can support a first-publication date when the item is the newspaper issue itself. |
| Volume | Not counted. Gehrig's Columbia years are 1921–1923, so the relevant slice is small and high value if rights are cleared. |
| Credential | None for reading. A rights answer is required before republication. |
| Recommendation | **Manual only.** No adapter. Product Authority decides any republication request. |

### NARA — build after a key (#4846)

| | |
| --- | --- |
| Access | National Archives Catalog API. Anyone may request a key. The default key is read-only. Each request sends the key. ([Catalog API](https://www.archives.gov/research/catalog/help/api)) |
| Rate | The API page tells users not to publish a key and says unused keys are deactivated after 12 months. A numeric default quota was not copied into this report; use the quota on the key Product Authority receives. |
| Terms | Misuse, or publishing the key, deactivates it. Do not commit the key. |
| Rights | The API returns archival descriptions, digital-object metadata, and OCR text. A catalog record is not a public-domain conclusion. The adapter must keep the record's own rights metadata as evidence. |
| Date | Description dates. Treat as first publication only when the record identifies publication. |
| Volume | Not counted. Newsreel and textual leads are the reason to build. This is the first new adapter. |
| Credential | Catalog API key. Product Authority. Email `Catalog_API@nara.gov`. |
| Recommendation | **Build** after the key. #4846. |

### Wikisource and Wikipedia text — do not build until share-alike is accepted

| | |
| --- | --- |
| Access | MediaWiki Action API and REST API on the Wikimedia projects. No key is required for ordinary reads. A User-Agent is required. High-volume commercial reuse is the Wikimedia Enterprise API, which has a free tier and paid tiers. ([Wikimedia APIs](https://www.mediawiki.org/wiki/Wikimedia_APIs), [Wikisource via Enterprise](https://enterprise.wikimedia.com/project-data/wikisource-api/)) |
| Rate | Follow Wikimedia's User-Agent policy and `maxlag`. No numeric cap is restated here. |
| Terms | Wikisource's own policy is that source texts are in the public domain. Transcriptions and contributor edits are dual-licensed CC BY-SA and GFDL. Share-alike applies to the transcription layer. ([Enterprise Wikisource page](https://enterprise.wikimedia.com/project-data/wikisource-api/)) |
| Rights | Machine-readable license data is available from the Wikimedia APIs. CC BY-SA is not the public-domain path this archive is using for the first ten items. |
| Date | Page and edition metadata. A Wikipedia article date is not a first-publication date of the underlying work. |
| Volume | Not counted. |
| Credential | None for Action API reads. |
| Recommendation | **Skip** until Product Authority accepts CC BY-SA (and GFDL) share-alike for stored transcriptions. Do not treat a Wikipedia article as public-domain text. |

### Baseball sources

| Source | Recommendation |
| --- | --- |
| SABR | **Skip.** Site content is licensed for personal, noncommercial use. The terms prohibit scraping, storing a significant portion, and commercial exploitation without written permission. ([Terms of use](https://sabr.org/terms-of-use/)) |
| Retrosheet | **No new adapter.** Box scores are already ingested (#4263). Any display of Retrosheet data must carry Retrosheet's notice: the information was obtained free of charge from and is copyrighted by Retrosheet. ([notice.txt](https://www.retrosheet.org/notice.txt)) |
| Baseball Almanac | **Skip.** The dictionary page reviewed says definitions from the Dickson Baseball Dictionary may not be reproduced without express written consent. No public API was identified. ([Dictionary term](https://www.baseball-almanac.com/dictionary-term.php?term=Retrosheet)) |

### Newspaper archives beyond Chronicling America

| Source | Recommendation |
| --- | --- |
| Chronicling America | Already #4788. Do not open a second issue. |
| Fultonhistory | **Skip** for an adapter. No public API was identified in this pass. A bulk download would be a terms-of-use question for Product Authority. |
| Trove (National Library of Australia) | **Build only after a key**, and only for 1931 and 1934 tour coverage. Not opened as an issue yet. API v3 requires an approved key. The applicant states the call rate and the use, and commercial use is a higher review level. ([Using the API](https://trove.nla.gov.au/about/create-something/using-api), [v3 technical guide](https://trove.nla.gov.au/about/create-something/using-api/v3/api-technical-guide)) Rights and date fields must be read from the record. Volume was not counted. |

## Ranked build list

| Order | Source | Rights position | Issue |
| --- | --- | --- | --- |
| — | DPLA | Aggregator evidence only; verify at the contributing institution | #4161, existing |
| — | Chronicling America | Already tasked | #4788 |
| — | Internet Archive | Already tasked; item license must be stored, not assumed | #4789 |
| 1 | NARA Catalog | Record's own rights metadata; catalog presence is not public domain | #4846 |
| 2 | Europeana | Keep `edm:rights` public-domain or CC0 only; project key | #4847 |
| 3 | Smithsonian | CC0 media only; third-party publicity and trademark remain | #4848 |
| 4 | The Met | Probe; keep objects with `isPublicDomain` true; CC0 when the Museum marks Open Access | #4849 |

Do not build: NYPL (API sunset 2026-08-01), HathiTrust, Google Books, Flickr Commons, Columbia Spectator, Wikisource/Wikipedia, SABR, Baseball Almanac, Fultonhistory. Retrosheet stays on #4263. Trove waits on a key and is behind Europeana for the same tours.

## For Product Authority

These need a decision or a secret before any adapter runs. None of them is requested by this pull request.

| Need | Source | What to decide |
| --- | --- | --- |
| Secret `DPLA_API_KEY` | DPLA | So #4161 can verify the existing adapter against the live API |
| Secret, Catalog API key | NARA | Before #4846 sends a request. Write `Catalog_API@nara.gov` |
| Project API key and terms acceptance | Europeana | Personal keys are non-production. Before #4847 |
| Secret, api.data.gov key | Smithsonian | Before #4848 |
| Approved API key and the intended-use review | Trove | Only if tour coverage beyond Europeana is wanted. Commercial review is a higher level |
| Paid Flickr Pro key, and whether "no known copyright restrictions" is acceptable | Flickr Commons | Default here is skip |
| Share-alike | Wikisource and Wikipedia | CC BY-SA and GFDL on transcriptions. Default here is skip |
| Written permission | SABR, Baseball Almanac, Spectator republication | Default here is skip or manual |
| Commercial-use contact | NYPL | Moot if the adapter is not built. API ends 2026-08-01 |
| HathiTrust dataset agreement, Google Books terms | Books full view | Default here is manual; use #4789 instead |

## What this assessment did not do

No candidate was collected. No key was created. No workflow was enabled. The Gehrig discovery workflow stays halted under #4843. Volume numbers above that come from a source's own pages are collection-wide, not Gehrig counts.
