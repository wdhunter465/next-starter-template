---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Authentication and redirect behavior definitions as a supporting specification
Does Not Own: Product and Design Domain Policy; Join/Login UI composition; FanClub content layout; admin feature requirements
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #2687, #5112, #5120
Last Reviewed: 2026-11-06
---

# Authentication Model (Canonical Auth Source)

This file is the **canonical supporting specification** for authentication/session behavior and auth-related redirects under the Product and Design Domain Policy.

It is not a Domain Policy co-owner. Domain-policy conflicts resolve through `docs/governance/PRODUCT-AND-DESIGN.md`.

Canonical auth reference: /docs/reference/design/auth-model.md

## Day 1 Canonical Model (LOCKED)

LGFC Day 1 member access uses a **cookie-backed server session model** with **Cloudflare D1 as the only database**.

### Session
- Cookie name: `lgfc_session`
- Session store: D1 table `member_sessions`
- Session lookup endpoint: `/api/session/me`
- Member identity and role source: D1 table `members`

### Behavior
- Join/Login canonical page: `/join`
- Login tab entry point: `/join?mode=login`
- Login creates session + cookie, then redirects to `/fanclub`
- Login refuses a member whose email address is not verified (see Email verification)
- Logout clears the cookie and invalidates the session, then redirects to `/`
- Closing the browser does not immediately log the member out
- Online status is approximate and based on session records + `last_seen_at`

### Protected Routes
- `/fanclub`
- `/fanclub/**`

## Email verification (Product Authority decision, 2026-11-06, #5112)

A new member must prove they own the email address before they can enter the member area. This uses a single-use emailed link for verification only; it is not a general sign-in method.

1. Join creates the member with `members.email_verified_at` empty and sends **one** email: the welcome text, with the verification link as its only link (#5120). Members who did not opt in to updates get the plain transactional wording, never the promotional intro. Join does **not** create a session.
2. The browser goes to `/join/check-email/`, which tells the member to open the email and offers to send a new link (`POST /api/verify-email-resend`, one new link per address per minute, the same answer for every address).
3. The link opens `/join/verified/?token=...`. That page sends the token to `POST /api/verify-email`, which marks the address verified, creates the session cookie, and answers. The page then shows "Email address verification completed. Thank you and welcome to the Lou Gehrig Fan Club.", waits 3 seconds, and goes to `/fanclub`.
   A link that is expired, already used or incomplete has no failure page: the member goes to `/join/check-email/?link=used`, which says in one line that the link has expired or was already used and offers a new link (#5120).
4. `/api/login` answers 403 `email_not_verified` for a member whose address is not verified. The login tab sends that member to `/join/check-email/`.
5. Tokens are 32 random bytes. Only the SHA-256 is stored (`email_verification_tokens`). A token works once and expires 24 hours after it is issued.
6. Members who existed before this change were marked verified by migration 0096.

Because `/join/verified/` has the token in the address, the page removes it from the address bar after a successful check. The token is sent by the page, not by the link, so a mail scanner that only fetches the address cannot use it up.

## Redirect Policy (LOCKED)

1. `/fanclub` or `/fanclub/**` when unauthenticated → `/`
2. Failed login/session validation → `/`
3. `/logout` completion (or already logged out) → `/`
4. `/login` legacy compatibility route → `/`
5. `/auth` legacy compatibility route → `/join`

## Prohibited in Active Docs

- localStorage as the auth source of truth
- external auth providers
- magic-link auth as a sign-in method (a single-use link is allowed only for email verification at join; see Email verification)
- ADMIN_EMAILS as the primary auth gate
- hybrid cookie + localStorage auth narratives

## Governance / Enforcement

Subordinate docs must reference this file for auth behavior and must not redefine or conflict with it within the auth topic.

If subordinate design docs conflict on auth behavior, prefer this file, then resolve any remaining conflict through `docs/governance/PRODUCT-AND-DESIGN.md`.

Any file that mentions authentication/session/redirect behavior must include:

Canonical auth reference: /docs/reference/design/auth-model.md
