---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: Setting up and checking the read-only Givebutter API connection used by the admin fundraiser leaderboard preview
Does Not Own: The fundraiser model, the leaderboard ranking decision, Givebutter account or campaign configuration, credentials, or the public leaderboard page
Canonical Reference: /docs/reference/operations/2027-fundraiser-dashboard-and-checkpoint-prizes-design.md
Related issues: #4993, #4432, #4139, #4415, #4430
Last Reviewed: 2026-10-28
---

# Givebutter API Connection

## Purpose

Connect the website to the Givebutter API, read-only, so the admin fundraiser preview can show the leaderboard and progress views before anything is published.

## Prerequisites

- An admin member session.
- A Givebutter API key (Givebutter Dashboard, Settings, API Keys). The key is a credential: Product Authority provides it. Never put it in an Issue, a pull request, a comment, a log or the repository.
- The numeric ID of the 2027 Givebutter campaign (recorded on #4430).

## Steps

1. Product Authority sets `GIVEBUTTER_API_KEY` and `GIVEBUTTER_CAMPAIGN_ID` as Pages Functions variables for the target environment (the key as a secret).
2. Sign in as an admin member and open **Fundraiser Preview** (`/admin/fundraiser-preview`).
3. In **Leaderboard Preview**, select **Check Givebutter connection**.
4. Confirm the panel says **Live data** and shows the campaign total, goal, top 10 participants and teams.

## Procedure

### What is read

| Givebutter endpoint | Fields kept |
| --- | --- |
| `GET /v1/campaigns/{id}` | title, status, raised, goal, donors (as supporters) |
| `GET /v1/campaigns/{id}/members` | id, display name, raised, goal, donors (as supporters), participant page link on givebutter.com |
| `GET /v1/campaigns/{id}/teams` | id, name, raised, goal, supporters, members |

Everything else is dropped before the snapshot is returned. The members endpoint also returns first and last name, email, phone and picture; those never leave the client (#4139). Nothing is written to D1 in this slice.

### Fail-closed behavior

- Without an admin session the endpoint answers 401 or 403.
- Without the key or campaign ID the panel says **Not configured** and shows labeled sample data. No value is returned.
- On any Givebutter error, an invalid number, a pagination link on another host, or a timeout (10 seconds), the endpoint answers 502 with a short code and the panel keeps the last good data and shows the error.
- Rate limit: Givebutter allows 500 requests per minute; one check makes a few requests per page of results.

## Verification

- `tests/givebutter-client.test.ts`, `tests/admin-givebutter-snapshot.test.ts`, `tests/leaderboard-preview.test.tsx`
- Manual: the panel stays on sample data until the variables are set.

## Closeout Criteria

Complete when an admin sees live totals in the preview with the Production variables set, and the public pages still show nothing from this feature.
