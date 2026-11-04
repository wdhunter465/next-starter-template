---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Procedure for registering the free API keys that unlock more archive search sources
Does Not Own: Source selection policy; rights decisions; collector implementation
Canonical Reference: /docs/how-to/content-ingestion-workflows.md
Last Reviewed: 2026-11-04
---

# How-To: Register API Keys For More Archive Search Sources

Four archive sources need a free API key before the discovery collector will search them. Each sends no request until its key exists, so adding a key is safe: nothing changes until the source is named in a discovery run (`--sources`).

Product Authority registers the keys (2026-11-04, #5074). Claude Code does not create accounts and never sees a key's value.

## Steps

1. Register for a key on the provider's own page. The pages change, so follow the provider's current instructions.

   | Source | Where to register | GitHub secret name |
   | --- | --- | --- |
   | National Archives Catalog | https://www.archives.gov/research/catalog/help/api | `NARA_CATALOG_API_KEY` |
   | Europeana | https://pro.europeana.eu/page/get-api | `EUROPEANA_PROJECT_API_KEY` |
   | Smithsonian Open Access | https://api.data.gov/signup/ | `SMITHSONIAN_API_KEY` |
   | Digital Public Library of America | https://pro.dp.la/developers/api-codex | `DPLA_API_KEY` |

2. In the repository, open Settings, then Secrets and variables, then Actions, and choose New repository secret.
3. Use the exact secret name from the table, paste the key as the value, and save. Do not paste a key into an Issue, a pull request or a chat.
4. Tell Claude Code which key was added. Claude Code runs one trial discovery with `--sources` naming that source and reports the candidates it found, without importing them.

## Rules that apply to every source

- Every candidate comes in as metadata only, unreviewed. The quality gate (#5038) decides what is kept: it must name Gehrig, it must not be about the disease, and a picture under 1,080 px on its long side is not kept.
- No watermarks or agency copies. The watermark and agency list in `data/research/gehrig-watermark-source-lists.json` applies to every source. Add a new host to it when a new source brings stock-photo or agency hosts.
- Searches use the curated list in `data/research/gehrig-discovery-queries.json`. Every query names Gehrig, and none is about the disease, patients or awareness.

## Verify

A key works when the trial discovery reports candidates for that source. A source that returns HTTP 401 or 403 needs its key checked; a source that returns HTTP 429 is rate limiting and needs longer gaps between requests.
