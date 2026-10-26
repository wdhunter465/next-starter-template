---
Doc Type: Archive
Audience: Human + AI
Authority Level: Historical Record
Owns: Historical notes on Phase 6 email and admin operations for LGFC-Lite
Does Not Own: Active operational authority, design, or implementation instructions
Canonical Reference: /docs/ops/pmo/diataxis-legacy-retirement-policy.md
Last Reviewed: 2026-08-06
---

# Phase 6 — Email & Admin Ops (LGFC-Lite)

> ARCHIVED 2026-10-26. Historical and non-authoritative. Replacement: none. Source: #4896.

## What Phase 6 Does
When a visitor submits the Join form (`POST /api/join`):

1) The join request is inserted into D1 table `join_requests`.
2) If `MAILCHANNELS_ENABLED=1`:
   - A **welcome email** is sent to the user.
   - An **admin notification** is sent to `MAIL_ADMIN_TO`.
3) One audit row is written per attempted email into D1 table `join_email_log`.

## Required environment variables (Cloudflare Pages)
These must be set in Cloudflare Pages **Project Settings → Environment Variables**.

- `MAILCHANNELS_ENABLED=1`
- `MAILCHANNELS_API_KEY` (MailChannels HTTP API key)
- `MAIL_FROM` (example: `Lou Gehrig Fan Club <noreply@lougehrigfanclub.com>`)
- `MAIL_REPLY_TO` (optional)
- `MAIL_ADMIN_TO` (optional; one or more emails, comma-separated)

**Note:** `MAIL_ADMIN_TO` is optional. If not configured, admin notifications are skipped but join requests still succeed and welcome emails are sent.

If `MAILCHANNELS_ENABLED=1` and required vars (MAIL_FROM, MAILCHANNELS_API_KEY) are missing, `/api/join` **fails fast** with HTTP 500.

## Audit log
Table: `join_email_log`

- `request_id` ties the join request + email attempts together
- `message_type`: `welcome` or `admin`
- `result`: `sent | failed | skipped`
- `status_code`: MailChannels HTTP status (202 = accepted)
- `error`: truncated provider error (if any)

## Canonical smoke test (production)
Replace the URL if your Pages URL changes.

```bash
curl -i -X POST "https://next-starter-template-6yr.pages.dev/api/join" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test","email":"smoke-test@example.com"}'
```

Expected:
- HTTP 200
- JSON contains `"ok": true`
- Admin inbox receives: `LGFC Lite – New Join Request`
- User inbox receives: `Welcome to the Lou Gehrig Fan Club`
