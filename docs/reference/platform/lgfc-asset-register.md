---
Doc Type: Reference
Audience: Human + AI
Authority Level: Supporting
Owns: LGFC asset register schema, asset rows, and secret-name catalog as a supporting specification
Does Not Own: Platform and Environment Domain Policy; vendor contracts; credential values; delivery approval; incident response
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #4534, #4535, #4539, #4540, #4541, #4542
Last Reviewed: 2026-10-10
---

# LGFC Asset Register

## Purpose

This register is the single list of LGFC assets: what exists, who owns it, what depends on it, how its health is observed, and when it was last checked against live evidence.

It does not replace the detailed inventories. It links to them:

- Vendors: `docs/reference/architecture/vendor-inventory.md`
- Cloudflare Pages and D1: `docs/reference/platform/CLOUDFLARE.md`
- Backblaze B2: `docs/reference/platform/Backblaze_B2.md`
- Preview and production isolation: `docs/reference/platform/component-environment-isolation.md`
- GitHub Actions: `docs/ops/workflows-inventory.md`, `docs/reference/ci/workflow-inventory.md`
- Documentation as monitored assets: `docs/explanation/operations/documentation-monitored-assets.md`

When this register and a detailed inventory disagree, the detailed inventory's cited live evidence wins and this register is corrected.

## Rules

- A row with no `business_owner`, no `technical_owner`, or no `last_reconciled` date is **provisional**, not authoritative.
- `credential_refs` lists secret or variable **names only**. No secret value is ever recorded here.
- `last_reconciled` is the date a row was checked against live evidence (a workflow run, an HTTP response, a dashboard export), not the date the text was edited.
- Adding a paid vendor, a new credential, or a new production binding is a Product Authority decision. This register records the decision; it does not make it.
- The reconciliation job (#4539) parses the asset table and the secret-name catalog below. Keep one row per line and keep the column order.

## Schema

| Field | Meaning |
| --- | --- |
| `asset_id` | Stable ID, `<provider>:<kind>:<name>` |
| `class` | `repo`, `build`, `platform`, `storage`, `email`, `saas`, `agent`, `governance` |
| `name` | Human name |
| `provider` | Vendor |
| `environment` | `production`, `preview`, `shared`, `n/a` |
| `business_owner` | Role accountable for keeping or retiring it |
| `technical_owner` | Team that operates it |
| `source_of_truth` | Path, workflow, or system that proves it exists |
| `depends_on` | Other `asset_id`s it needs |
| `data_class` | `public`, `member`, `admin`, `secrets`, `none` |
| `credential_refs` | Secret/variable names used to reach it |
| `monitor` | How health is observed; `none` is a gap |
| `status` | `active`, `degraded`, `future`, `retired` |
| `last_reconciled` | `YYYY-MM-DD`, or `—` when provisional |

## Asset table

<!-- asset-register:table:start -->
| asset_id | class | name | provider | environment | business_owner | technical_owner | source_of_truth | depends_on | data_class | credential_refs | monitor | status | last_reconciled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gh:repo:next-starter-template | repo | Source repository | GitHub | n/a | Product Authority | team:operations | `wdhunter465/next-starter-template` | — | public | GITHUB_TOKEN | GitHub status | active | 2026-10-10 |
| gh:ruleset:main | repo | `Main` ruleset (id 15885337) | GitHub | n/a | Product Authority | team:governance | GitHub rulesets API | gh:repo:next-starter-template | none | — | none | active | 2026-10-10 |
| gh:actions:workflows | build | GitHub Actions workflows | GitHub | shared | Product Authority | team:operations | `.github/workflows/**`, `docs/ops/workflows-inventory.md` | gh:repo:next-starter-template | secrets | see catalog | required checks `quality`, `gitleaks`, `reviewer-response-completion` | active | 2026-10-10 |
| gh:runner:lgfc-chromebook-linux | build | Repository runner `lgfc-chromebook-linux` | GitHub (self-hosted) | n/a | Product Authority | team:operations | GitHub runners API | gh:repo:next-starter-template | none | — | `repository-runner-health.yml` | active | 2026-10-10 |
| gh:runner:lgfc-cursor-chromebook | build | Cursor dispatch runner `lgfc-cursor-chromebook` | GitHub (self-hosted) | n/a | Product Authority | team:operations | GitHub runners API | gh:repo:next-starter-template | none | CURSOR_RUNNER_HEALTH_TOKEN | `lgfc-cursor-runner-health.yml` | active | 2026-10-10 |
| app:build:nextjs | build | Next.js static export (`out/`) and Pages Functions (`functions/**`) | LGFC | shared | Product Authority | team:operations | `package.json`, `wrangler.toml` | gh:repo:next-starter-template | public | — | `quality` check | active | 2026-10-10 |
| cf:pages:next-starter-template | platform | Pages project `next-starter-template` | Cloudflare | shared | Product Authority | team:operations | `docs/reference/platform/CLOUDFLARE.md` | app:build:nextjs; cf:d1:lgfc_lite; cf:d1:lgfc-litedev | member | CLOUDFLARE_API_TOKEN; CLOUDFLARE_ACCOUNT_ID | Cloudflare Pages PR check; `ops-cf-pages-retry.yml`; uptime probe (#4540) | active | 2026-10-10 |
| cf:domain:www.lougehrigfanclub.com | platform | `www.lougehrigfanclub.com` | Cloudflare | production | Product Authority | team:operations | HTTP 200 on 2026-10-10 | cf:pages:next-starter-template | public | — | uptime probe (#4540) | active | 2026-10-10 |
| cf:domain:lougehrigfanclub.com | platform | Apex `lougehrigfanclub.com` | Cloudflare | production | Product Authority | team:operations | HTTPS 522 on 2026-10-10 (#4542) | cf:pages:next-starter-template | public | — | uptime probe (#4540) | degraded | 2026-10-10 |
| cf:domain:next-starter-template-6yr.pages.dev | platform | `next-starter-template-6yr.pages.dev` | Cloudflare | production | Product Authority | team:operations | HTTP 200 on 2026-10-10 | cf:pages:next-starter-template | public | — | uptime probe (#4540) | active | 2026-10-10 |
| cf:d1:lgfc_lite | platform | Production D1 `lgfc_lite` (`22d0dc3e-ad34-43af-8e6a-2063df1a1e04`) | Cloudflare | production | Product Authority | team:operations | `wrangler.toml`; backup run 2026-10-10 | — | member | D1_DATABASE_NAME; D1_DATABASE_ID; CLOUDFLARE_API_TOKEN | `ops-d1-backup-scheduled-daily-3268.yml`; `d1-migrations.yml` identity check | active | 2026-10-10 |
| cf:d1:lgfc-litedev | platform | Preview D1 `lgfc-litedev` (`35232809-b4c1-4df9-9f39-2f178b13c378`) | Cloudflare | preview | Product Authority | team:operations | `wrangler.toml` `[env.preview]` | — | member | D1_DEV_DATABASE_NAME; D1_DEV_DATABASE_ID | `ops-d1-prod-dev-refresh.yml` identity check | active | — |
| cf:r2:lgfc-d1-backups | storage | R2 bucket `lgfc-d1-backups` | Cloudflare | production | Product Authority | team:operations | #3268 backup report 2026-10-10 | cf:d1:lgfc_lite | member | R2_ACCESS_KEY_ID; R2_SECRET_ACCESS_KEY; R2_BUCKET_NAME | daily backup re-verify; `ops-d1-backup-scheduled-quarterly-drill-3268.yml` | active | 2026-10-10 |
| cf:waf:rate-limiting | platform | Rate limiting / WAF (dashboard-owned, `API_RATE_LIMITER`) | Cloudflare | production | Product Authority | team:operations | `docs/how-to/website/api-rate-limiting.md` | cf:pages:next-starter-template | none | — | none | active | — |
| b2:bucket:LouGehrigFanClub | storage | B2 bucket `LouGehrigFanClub` | Backblaze | shared | Product Authority | team:operations | `docs/reference/platform/Backblaze_B2.md`; `b2-s3-smoke-test.yml` | — | public | B2_KEY_ID; B2_APP_KEY; B2_BUCKET; B2_ENDPOINT; PUBLIC_B2_BASE_URL | `b2-s3-smoke-test.yml` (daily); `b2-d1-daily-sync.yml` | active | 2026-10-10 |
| email:icloud:domain-mailbox | email | Domain mailbox | Apple iCloud Mail | production | Product Authority | team:operations | `vendor-inventory.md` | — | member | — | none | active | — |
| email:mailchannels:transactional | email | Transactional email (off unless `MAILCHANNELS_ENABLED=1`) | MailChannels | production | Product Authority | team:operations | `component-environment-isolation.md` | cf:pages:next-starter-template | member | MAILCHANNELS_API_KEY | none | active | — |
| saas:ga4:G-BRV48J1VEJ | saas | Google Analytics 4 property | Google | production | Product Authority | team:operations | `component-environment-isolation.md` (#4350) | app:build:nextjs | public | NEXT_PUBLIC_GA_ID | none | active | — |
| saas:givebutter:fundraising | saas | Fundraising | Givebutter | production | Product Authority | team:operations | `vendor-inventory.md` (#4139, #4430) | — | none | — | none | active | — |
| saas:bonfire:store | saas | Merchandise store | Bonfire | production | Product Authority | team:operations | `vendor-inventory.md` | — | none | — | none | active | — |
| saas:elfsight:widgets | saas | Site widgets | Elfsight | production | Product Authority | team:operations | `vendor-inventory.md` | app:build:nextjs | public | — | none | active | — |
| saas:social:accounts | saas | Facebook, Instagram, Pinterest, X accounts | Meta; Pinterest; X | production | Product Authority | team:operations | `vendor-inventory.md` | — | public | — | none | active | — |
| saas:zapier:automation | saas | Social announcement automation | Zapier | n/a | Product Authority | team:operations | `vendor-inventory.md` (P-02, #4416) | — | none | — | none | future | — |
| saas:dpla:api | saas | Digital Public Library of America API | DPLA | n/a | Product Authority | team:operations | `secrets.DPLA_API_KEY` in workflows | — | none | DPLA_API_KEY | none | active | — |
| saas:huggingface:api | saas | Hugging Face API | Hugging Face | n/a | Product Authority | team:operations | `secrets.HF_TOKEN` in workflows | — | none | HF_TOKEN | none | active | — |
| saas:gitleaks:license | build | Gitleaks secret scan | Gitleaks | n/a | Product Authority | team:operations | `secrets.GITLEAKS_LICENSE` in workflows | gh:actions:workflows | none | GITLEAKS_LICENSE | `gitleaks` required check | active | 2026-10-10 |
| agent:vendors | agent | Agent, reviewer, and analysis vendors | various | n/a | Product Authority | team:governance | `vendor-inventory.md`; `docs/governance/AGENT-TEAM.md` | gh:repo:next-starter-template | none | GH_AW_TOKEN | none | active | 2026-10-09 |
| gov:entry:agent-chain | governance | Agent entry chain (`Agent.md`, `AGENTS.md`, `.cursor/rules/**`, `.agents/**`) | LGFC | n/a | Product Authority | team:governance | `Agent.md` | gh:repo:next-starter-template | none | — | `agent-governance.yml` | active | 2026-10-10 |
| gov:policy:domain-docs | governance | Domain policy documents (`docs/governance/**`) | LGFC | n/a | Product Authority | team:governance | `docs/governance/REPOSITORY-AUTHORITY.md` | gh:repo:next-starter-template | none | — | `Last Reviewed` headers; `docs/explanation/operations/documentation-monitored-assets.md` | active | 2026-10-10 |
<!-- asset-register:table:end -->

## Secret and variable name catalog

Names referenced by `.github/workflows/**` or `.env.example` on 2026-10-10. Values are never recorded. A name used in a workflow but missing here is drift (#4539).

<!-- asset-register:secrets:start -->
| name | used_by | asset_id |
| --- | --- | --- |
| CLOUDFLARE_API_TOKEN | workflows; `.env.example` | cf:pages:next-starter-template |
| CLOUDFLARE_ACCOUNT_ID | workflows; `.env.example` | cf:pages:next-starter-template |
| CF_ACCOUNT_ID | workflows | cf:pages:next-starter-template |
| CLOUDFLARE_PROJECT_NAME | workflows | cf:pages:next-starter-template |
| CLOUDFLARE_PAGES_PROJECT | workflows | cf:pages:next-starter-template |
| CF_PAGES_PROJECT | workflows | cf:pages:next-starter-template |
| D1_DATABASE_NAME | workflows | cf:d1:lgfc_lite |
| D1_DATABASE_ID | workflows | cf:d1:lgfc_lite |
| D1_DB_NAME | `.env.example` | cf:d1:lgfc_lite |
| D1_DEV_DATABASE_NAME | workflows | cf:d1:lgfc-litedev |
| D1_DEV_DATABASE_ID | workflows | cf:d1:lgfc-litedev |
| R2_ACCESS_KEY_ID | workflows | cf:r2:lgfc-d1-backups |
| R2_SECRET_ACCESS_KEY | workflows | cf:r2:lgfc-d1-backups |
| R2_BUCKET_NAME | workflows | cf:r2:lgfc-d1-backups |
| B2_KEY_ID | workflows; `.env.example` | b2:bucket:LouGehrigFanClub |
| B2_APP_KEY | workflows; `.env.example` | b2:bucket:LouGehrigFanClub |
| B2_ENDPOINT | workflows; `.env.example` | b2:bucket:LouGehrigFanClub |
| B2_BUCKET | workflows; `.env.example` | b2:bucket:LouGehrigFanClub |
| PUBLIC_B2_BASE_URL | workflows; `.env.example` | b2:bucket:LouGehrigFanClub |
| MAILCHANNELS_ENABLED | `.env.example` | email:mailchannels:transactional |
| MAILCHANNELS_API_KEY | `.env.example` | email:mailchannels:transactional |
| MAIL_FROM | `.env.example` | email:mailchannels:transactional |
| MAIL_REPLY_TO | `.env.example` | email:mailchannels:transactional |
| MAIL_ADMIN_TO | `.env.example` | email:mailchannels:transactional |
| ADMIN_EMAILS | `.env.example` | cf:pages:next-starter-template |
| NEXT_PUBLIC_SITE_URL | `.env.example` | app:build:nextjs |
| NEXT_PUBLIC_GA_ID | `.env.example` | saas:ga4:G-BRV48J1VEJ |
| PAGES_SITE_URL | `.env.example` | cf:pages:next-starter-template |
| CHATTERBOX_BRIDGE_PROD_TOKEN | workflows | cf:pages:next-starter-template |
| CHATTERBOX_PREVIEW_ADMIN_TOKEN | workflows | cf:pages:next-starter-template |
| SCHEDULED_CONTENT_BRIDGE_TOKEN | workflows | cf:pages:next-starter-template |
| CURSOR_RUNNER_HEALTH_TOKEN | workflows | gh:runner:lgfc-cursor-chromebook |
| HISTORY_PURGE_PAT | workflows | gh:repo:next-starter-template |
| GH_AW_TOKEN | workflows | agent:vendors |
| GITHUB_TOKEN | workflows | gh:repo:next-starter-template |
| GITLEAKS_LICENSE | workflows | saas:gitleaks:license |
| DPLA_API_KEY | workflows | saas:dpla:api |
| HF_TOKEN | workflows | saas:huggingface:api |
<!-- asset-register:secrets:end -->

## Known gaps on 2026-10-10

- The apex domain returns Cloudflare 522 (#4542).
- No uptime probe for the production site (#4540).
- No scheduled reconciliation of this register (#4539).
- Google Analytics, DPLA, Hugging Face, and Gitleaks are used but are not listed in `vendor-inventory.md`.
- `@pinecone-database/pinecone` is declared in `package.json` with no source import (#4536).
- Vendor plan tiers, renewal dates, and cost owners are not recorded (#4541).
- `CLOUDFLARE.md` (2026-08-11) and `Backblaze_B2.md` (2026-07-21) predate this register (#4537, #4538).
