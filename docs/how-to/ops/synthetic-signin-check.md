---
Doc Type: How-to
Audience: Human + AI
Authority Level: Supporting
Owns: How to run the synthetic sign-in check against a site, what it checks, what each result means, and what it will not do
Does Not Own: Where the test account credentials are stored, creating the Production test accounts, or the scheduled workflow (those wait for Product Authority)
Canonical Reference: /docs/reference/design/auth-model.md
Related Issues: #4682, #4657, #4443, #4414
Last Reviewed: 2026-11-15
---

# Synthetic sign-in check

## Purpose

A broken sign-in would go unnoticed until a member reported it. `scripts/ops/synthetic-signin-check.mjs` signs in as a test member and a test admin on a site and confirms the pages and endpoints that depend on a session. This page covers running it by hand against the Development site. A scheduled run on Production is a later step: it needs Production test accounts, and those wait for Product Authority to say where the credentials are stored.

## What it checks

In order, stopping nothing early except what depends on a failed sign-in:

1. `join_page`: `/join/` loads as a page.
2. `member_sign_in`: the test member signs in and a session cookie is set.
3. `member_session`: the session is the test member's, with the member role.
4. `fanclub_data`: the member-only Club Home data loads.
5. `fanclub_page`: `/fanclub/` loads.
6. `member_refused_by_admin`: an admin endpoint **refuses** the plain member. A pass means the admin gate still holds.
7. `admin_sign_in`: the test admin signs in.
8. `admin_endpoint`: the admin endpoint loads for the admin.
9. `admin_page`: `/admin/cms/` loads.
10. `sign_out`: both sessions are signed out, whatever happened.

If a sign-in fails, the checks that need it are `skipped` and the run fails.

## Procedure

Use a Development or preview site. You need two test accounts that already exist on that site, a member and an admin, with different addresses.

```text
SYNTHETIC_BASE_URL=https://<development site> \
SYNTHETIC_MEMBER_EMAIL=<test member address> \
SYNTHETIC_ADMIN_EMAIL=<test admin address> \
node scripts/ops/synthetic-signin-check.mjs
```

It prints a table and writes it to `synthetic-signin-report.md` (change with `--out`).

| Exit code | Meaning |
| --- | --- |
| 0 | Every check passed. A failed sign-out is a warning and does not fail the run |
| 1 | A check failed: read the table for which and why |
| 2 | Not configured or refused: nothing was checked. This is never a pass |

## What it will not do

- It creates no account and writes nothing except the two sessions it signs out.
- It signs in once per account and never retries. The login endpoint locks an address out after 3 failed attempts per hour, so a failed sign-in is reported, not repeated.
- It never prints the account addresses. **Sign-in is by email alone** (`auth-model.md`), so the admin test address is as sensitive as a password: keep it in a repository secret, never in a comment, an Issue or a log.
- It refuses to run against Production (`lougehrigfanclub.com`) unless you pass `--allow-production` and set `SYNTHETIC_PRODUCTION_ACK=yes`. Do not do that until the Production test accounts exist and Product Authority has approved it.

## Not covered here

The scheduled workflow, the Operations Issue it opens on failure, the Production accounts and where their credentials live are the remaining parts of #4682. They need Product Authority's decision on credential storage first.
