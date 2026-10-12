---
Doc Type: Operations
Audience: LGFC maintainers, Product Authority, and implementation agents
Authority Level: Controlled
Owns: The dated record of what the first image and story collector runs found on 2026-10-10
Does Not Own: Rights conclusions, admission to the B2 and D1 libraries, publication, or the collector or policy definitions
Canonical Reference: /docs/reference/website/lou-gehrig-rights-privacy-publication-review.md
Related issues: #4563, #4527, #4368, #4532
Last Reviewed: 2026-10-12
---

# Content Collection Outputs, 2026-10-10

## Purpose

This folder preserves, unchanged, what the first runs of the image and story collectors produced on 2026-10-10. Before this, the files existed only in a session folder. Collection records the origin URL and the origin's own license statement for everything found; it decides nothing.

## Status of everything in this folder

**Collected. Not evaluated. Not imported to D1. Not permitted.** Nothing here may be used on the LGFC website. Default is not permitted; each item needs the evaluation process and, where required, permission, before it can be admitted.

These files are deliberately not in `data/research/`. The collectors skip any URL found in a top-level `data/research/*.json` registry, and the weekly discovery workflow imports its own run output, so registering these there would make a later run skip URLs that were never imported.

## Contents

| File | What it is |
| --- | --- |
| `commons-images-run-2026-10-10.json` | 40 Wikimedia Commons image candidates (33 `public_domain_candidate`, 7 `unknown`) in the `CandidateRegistry` format |
| `commons-images-run-2026-10-10.search-runs.json` | The three search-run records for that run |
| `commons-images-run-2026-10-10.license-notes.json` | The license notes captured for each of the 40 |
| `commons-images-new-candidates-2026-10-10.json` | The 20 of those 40 that were not already in an existing registry |
| `stories-run-2026-10-10.json` | 30 story candidates, 10 each from `en.wikipedia.org`, `en.wikisource.org` and `archive.org` (10 `permission_granted` on the source's own structured license, 20 `unknown`) |
| `stories-run-2026-10-10.search-runs.json` | The three search-run records for that run |

## How they were produced

```text
node scripts/content-pipeline/collect-gehrig-external-sources.mjs --limit 40
node --experimental-strip-types scripts/content-pipeline/collect-gehrig-story-sources.mjs
```

Output went to a scratch folder, not `data/research/`. No D1 or B2 write was made. Wikisource candidates are forced to ambiguous (not permitted) by the story adapter.

## Open-web leads

Eleven leads found by web search on the same day. Metadata only, nothing downloaded, not reviewed. The "rights signal" column is the source's own wording, not a decision.

| Lead | Credit / source | URL | Rights signal (from source, not a decision) |
|---|---|---|---|
| Stereograph "Lou Gehrig, famous Yankee first baseman", 1930 | Library of Congress, Keystone View Co. | https://www.loc.gov/resource/cph.3b44569 | "No known restrictions on publication" |
| DeLong Gum lithograph, 1933 | The Met, Burdick Collection | https://www.metmuseum.org/art/collection/search/412852 | Check Open Access flag |
| Ernie Harwell Sports Collection, 20+ Gehrig photos (Columbia c.1923, Yankees, 1932 WS with Ruth) | Detroit Public Library | https://digitalcollections.detroitpubliclibrary.org/taxonomy/term/2540 | Rights retained by DPL; permission needed |
| Gehrig photos 1933/1936 | Walter P. Reuther Library via Michigan Memories | https://michmemories.org/ | Contact Reuther AV dept |
| 1930s Gehrig photo | Densho Nippu Jiji archive | https://ddr.densho.org/ddr-njpa-1-503/ | Copyright restricted; non-commercial educational use allowed by holder |
| Rucker Archive slides (1926, 1934) | SABR | https://sabr.org/sabr-rucker-archive/gehrilo01_75/ | All Rights Reserved; permission needed |
| "An Awful Lot to Live For: Final Season in the News", Universal News UN-11-786 | National Archives Unwritten Record blog | https://unwritten-record.blogs.archives.gov/?p=3486 | Likely US-government-held newsreel; verify |
| Farewell Speech article | SABR Journal | https://sabr.org/journal/article/lou-gehrigs-farewell-speech-july-4-1939/ | Text; link/cite only |
| Columbia Gehrig research guide | Columbia RBML | https://blogs.library.columbia.edu/rbml/2021/06/02/lou-gehrig-day/ | Guide to yearbooks, photos, articles; verify per item |
| Gehrig papers 1920-1995 | Baseball Hall of Fame archives | https://archives.baseballhall.org/repositories/2/resources/395 | Finding aid; permission via Giamatti Center |
| Columbia uniform photo c.1922 | Baseball Hall of Fame | https://collection.baseballhall.org/objects/18517/lou-gehrig-in-columbia-university-uniform-photograph | Permission via Giamatti Center |

## What happens next

The evaluation process decides relevance and admission. Items that need permission go into the one-letter-per-source request process (`docs/how-to/website/lou-gehrig-permission-request-form-letter.md`). The three new source domains were approved on 2026-10-11 and are added to `sources` by the #4523 slices before any story import.
