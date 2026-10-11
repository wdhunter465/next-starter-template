---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Cloudflare Pages and D1 resource inventory facts as a supporting specification
Does Not Own: Platform and Environment Domain Policy; delivery approval; incident response playbooks
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #2688, #3355, #3357, #3268, #4534, #4537, #4542
Last Reviewed: 2026-10-10
---

# CLOUDFLARE — Resource Inventory (LGFC)

This document is the **supporting Cloudflare resource inventory** under the Platform and Environment Domain Policy (`docs/governance/PLATFORM-AND-ENVIRONMENT.md`).

It captures what currently exists in Cloudflare for the LGFC deployment (design + resource inventory only).

This file is **not** a Domain Policy co-owner. Conflicts with domain policy, Product Authority decisions, or other supporting specs resolve through `docs/governance/PLATFORM-AND-ENVIRONMENT.md`.

---

## Cloudflare Pages

**Project:** `next-starter-template`  
**Connected repo:** `wdhunter465/next-starter-template`  
**Production branch:** `main`  
**Automatic deployments:** enabled  
**Domains:**  
- `next-starter-template-6yr.pages.dev`  
- `www.lougehrigfanclub.com`

**Domain health (HTTP check, 2026-10-10 ~18:31 UTC, `curl -s -o /dev/null -w '%{http_code}'`):**

| Host | Result |
| --- | --- |
| `https://www.lougehrigfanclub.com/` | 200, served by Cloudflare |
| `https://next-starter-template-6yr.pages.dev/` | 200, served by Cloudflare |
| `http://lougehrigfanclub.com/` | 301 to `https://lougehrigfanclub.com/` |
| `https://lougehrigfanclub.com/` | **522** (Cloudflare cannot reach an origin) — the apex is proxied but not attached to the Pages project and has no working redirect (#4542) |

---

## Cloudflare D1 (SQLite)

**Production database name:** `lgfc_lite`  
**Production database UUID:** `22d0dc3e-ad34-43af-8e6a-2063df1a1e04`  

**Development/Preview database name:** `lgfc-litedev`  
**Development/Preview database UUID:** `35232809-b4c1-4df9-9f39-2f178b13c378`  

Binding name remains `DB` in both environments; physical database is selected by Pages environment / `wrangler.toml` (`docs/how-to/operations/bind-pages-preview-d1-dev.md`, #3357).

**Production database inventory (as shown in D1 Studio sidebar, 2026-08-11; not re-enumerated 2026-10-10):**

This list is incomplete. Later migrations add tables not shown here (for example `content_items`, `rights_evidence`, `sources`, `content_inventory`). Until the next live listing (#4537), `migrations/` is authoritative for the table set.

- `admin_team_worklist`
- `content_blocks`
- `content_revisions`
- `d1_migrations`
- `discussions`
- `events`
- `faq_entries`
- `footer_quotes`
- `friends`
- `join_email_log`
- `join_requests`
- `join_verifications`
- `library_entries`
- `login_attempts`
- `media_assets`
- `member_sessions`
- `members`
- `membership_card_content`
- `milestones`
- `page_content`
- `page_content_history`
- `photos`
- `reports`
- `sqlite_sequence`
- `v_page_content_live`
- `weekly_matchups`
- `weekly_votes`
- `welcome_email_content`

**Notes about the inventory list**
- The UI also shows internal SQLite objects (example: `sqlite_sequence`) and at least one view (`v_page_content_live`), in addition to normal tables.

---

**Production database health (2026-10-10):** the scheduled read-only export in `ops-d1-backup-scheduled-daily-3268.yml` succeeded at 09:07 UTC (45,027,457 bytes; report on #3268), which proves `lgfc_lite` exists and is readable with the repository credentials.

---

## Cloudflare R2

**Bucket:** `lgfc-d1-backups`  
**Purpose:** daily `lgfc_lite` exports with a SHA-256 checksum sidecar (#3268)  
**Object key pattern:** `d1-backups/lgfc_lite/<timestamp>/backup.sql`  
**Evidence:** the 2026-10-10 09:07 UTC run uploaded, re-downloaded, and re-hashed the backup with an exact checksum match. The quarterly restore drill (`ops-d1-backup-scheduled-quarterly-drill-3268.yml`) last succeeded 2026-10-01.  
**Credentials (names only):** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

---

## Rate limiting / WAF

Dashboard-owned; not declared in `wrangler.toml`. `functions/api/_middleware.ts` uses `env.API_RATE_LIMITER` when present (`docs/how-to/website/api-rate-limiting.md`). Not verified live on 2026-10-10.

---

## Reconciliation status (2026-10-10)

Cursor Local's wrangler login had expired, so a full read-only account listing (`wrangler pages project list`, `wrangler d1 list`, `wrangler r2 bucket list`) was not run. The facts above are verified only from HTTP checks and workflow evidence. A full listing needs an interactive `wrangler login` by Product Authority (HOLD on #4537). The asset register is `docs/reference/platform/lgfc-asset-register.md`.

---

## Cloudflare platform areas visible in the account UI (not enumerated here)

- Workers & Pages  
- D1 SQL database  
