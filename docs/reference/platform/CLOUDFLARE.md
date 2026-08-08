---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Cloudflare Pages and D1 resource inventory facts as a supporting specification
Does Not Own: Platform and Environment Domain Policy; delivery approval; incident response playbooks
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #2688
Last Reviewed: 2026-07-21
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

---

## Cloudflare D1 (SQLite)

**Database name:** `lgfc_lite`  
**Database UUID:** `22d0dc3e-ad34-43af-8e6a-2063df1a1e04`  

**Database inventory (as shown in D1 Studio sidebar):**
- 
admin_team_worklist- content_blocks- content_revisions- d1_migrations- discussions- events- faq_entries- footer_quotes- friends- join_email_log- join_requests- join_verifications- library_entries- login_attempts- media_assets- member_sessions- members- membership_card_content- milestones- page_content- page_content_history- photos- reports- sqlite_sequence- v_page_content_live- weekly_matchups- weekly_votes- welcome_email_content

**Notes about the inventory list**
- The UI also shows internal SQLite objects (example: `sqlite_sequence`) and at least one view (`v_page_content_live`), in addition to normal tables.

---

## Cloudflare platform areas visible in the account UI (not enumerated here)

- Workers & Pages  
- D1 SQL database  
