---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: D1 schema, migration, and operations facts as a supporting specification
Does Not Own: Platform and Environment Domain Policy; UI design specifics; PR process; incident response playbooks
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #2688, #4826
Last Reviewed: 2026-10-23
---

# LGFC — D1 DATABASE DESIGN + OPERATIONS GUIDE

This document is the **supporting D1 design and operations specification** under the Platform and Environment Domain Policy (`docs/governance/PLATFORM-AND-ENVIRONMENT.md`).

Authoritative supporting reference for schema control, migrations, and deployment workflow facts. It is **not** a Domain Policy co-owner.

---

# PURPOSE

This document defines:

- How the LGFC D1 database is structured
- How schema changes are deployed
- How migrations are executed
- Where authentication happens
- How to avoid local token/OAuth failures

This is the permanent supporting design record for D1 operations. Domain-policy conflicts resolve through `docs/governance/PLATFORM-AND-ENVIRONMENT.md`.

️

---

# DATABASE NAME

lgfc_lite

Platform:
Cloudflare D1 (SQLite)

Environment model:
- Local D1 → dev testing
- Remote D1 → production (source of truth)

---

# CURRENT CORE TABLES

### Identity + Access
- members
- member_sessions
- login_attempts
- join_requests
- join_verifications

### Content
- library_entries
- page_content
- page_content_history
- membership_card_content

### Media
- media_assets
- photos

### Engagement
- weekly_matchups
- weekly_votes
- milestones
- events (via page_content/milestones structures)

### Moderation / Safety
- reports  ← NEW

### System
- sqlite_sequence
- v_page_content_live (view)

---

# NEW TABLES ADDED (PHASE 2 AUTH FOUNDATION)

## member_sessions
Server-side auth replacement for localStorage gate.

Fields:
- id (TEXT PK)
- email
- created_at
- expires_at
- last_seen_at
- ip
- ua

Purpose:
- Cookie-based auth session store
- Enables secure FanClub access control

---

## reports
Moderation intake pipeline.

Fields:
- id
- kind
- target_id
- reporter_email
- reason
- status
- admin_note
- created_at
- resolved_at

Purpose:
- Chat reporting
- Photo reporting
- Content reporting

---

# MIGRATION STRATEGY (LOCKED)

ALL schema changes are applied using:

GitHub Actions → Wrangler → D1 Remote

NOT:
- Local CLI
- Codespaces OAuth
- Manual SQL entry

---

# MIGRATION FILE LOCATION

/migrations/

Example:

- 0029_member_sessions.sql
- 0030_reports.sql

Rules:
- Never edit past migrations
- Only add new numbered files
- Always use CREATE TABLE IF NOT EXISTS

---

# DEPLOYMENT WORKFLOW (OFFICIAL METHOD)

Workflow file:

.github/workflows/lgfc-d1-migrate.yml

Trigger:
Manual

Process:
1) GitHub Action runs
2) Uses repo secrets
3) Authenticates to Cloudflare
4) Applies SQL files to REMOTE D1
5) Logs result

---

# REQUIRED REPO SECRETS

Stored in:

GitHub → Settings → Secrets → Actions

Required:

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

Token permissions:

Account:
- D1: Edit
- Cloudflare Pages: Edit
- Workers Scripts: Edit
- Workers KV: Edit

Scope:
- Include account
- No IP restriction

---

# WHY THIS METHOD IS LOCKED IN

Codespaces Wrangler login causes:

- OAuth failures
- localhost callback errors
- terminal crashes
- Chromebook incompatibility

GitHub Actions solves this by:

- Running server-side
- Using stored secrets
- Eliminating local auth entirely

This is now the permanent migration method.

---

# HOW TO APPLY FUTURE SCHEMA CHANGES

Step 1:
Create new SQL file in:

/migrations/0031_*.sql

Step 2:
Upload to repo

Step 3:
Open:

GitHub → Actions → LGFC D1 Migrate (remote)

Step 4:
Click:
Run workflow

Step 5:
Verify in:
Cloudflare → D1 → Studio

---

# HOW TO VERIFY TABLE CREATION

Cloudflare Dashboard:

Workers & Pages → D1 → lgfc_lite → Studio

Confirm tables appear in left panel.

---

# AUTH DESIGN DECISION (CRITICAL)

Day-1 member auth is locked in `docs/reference/design/auth-model.md`.

localStorage-only login is not the auth model. `member_sessions` is the server-side store for the `lgfc_session` cookie.

This enables:

- Secure FanClub gating
- Role validation
- Admin protection
- Persistent login cookies

---

# ROLE SYSTEM DESIGN

members.role:

- member
- admin

Admin pages will:

- Query DB for role
- NOT rely on token claims

---

# REPORTING PIPELINE DESIGN

Reports table supports:

- Chat message reporting
- Photo reporting
- Article reporting
- Memorabilia reporting

Status flow:

open → reviewed → closed

---

# DATA SAFETY RULES

NEVER:

- Delete tables manually
- Modify schema from Studio
- Run production SQL from local terminal

ALWAYS:

- Use migration files
- Use Actions workflow

---

# RECOVERY MODEL

If schema corruption occurs:

- Re-run migrations
- Tables are IF NOT EXISTS safe
- No destructive changes

---

# CURRENT STATUS (AS OF TODAY)

Confirmed present in production:

✔ member_sessions  
✔ reports  

Auth infrastructure base layer is now installed.

---

# NEXT SYSTEMS DEPENDING ON THIS

Phase 2:
- Secure login
- Session validation
- Role enforcement

Phase 3:
- Chat reporting
- Moderation tools

Phase 4:
- Admin content control

---

# OPERATIONAL DATA AUTHORITY (supporting fact)

Production D1 database is the authoritative **data** store for runtime records.

Repo migrations define structure.
Actions workflow enforces deployment.

This section records operational data authority only. It does not make this file a Platform and Environment Domain Policy co-owner.
