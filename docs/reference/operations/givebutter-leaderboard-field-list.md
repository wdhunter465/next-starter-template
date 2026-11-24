---
Doc Type: Reference
Audience: Product Authority, Engineering, and implementation agents
Authority Level: Controlled
Owns: The list of Givebutter fields the 2027 website leaderboard needs, what each is used for, what is dropped, what was and was not confirmed through the read-only Claude connector on 2026-11-24, and the verification checklist to run once the API key exists
Does Not Own: Fundraiser dates (calendar of record, #2093); leaderboard rules and decisions (#4415, #4432); the API key or any credential; Givebutter account, campaign or auction configuration; the build design (`docs/reference/operations/2027-fundraiser-dashboard-and-checkpoint-prizes-design.md`); any code
Canonical Reference: /docs/reference/operations/2027-fundraiser-dashboard-and-checkpoint-prizes-design.md
Related Issues: #5501, #4432, #4430, #4415, #4139, #5209, #2093
Last Reviewed: 2026-11-24
---

# Givebutter field list for the 2027 website leaderboard

## Purpose

Product Authority asked (2026-11-24) for the list of Givebutter fields needed to build the website leaderboard. Once the API key is in place, the list is checked against the real API. A field that is missing or empty is called out to the Live Like Lou (LLL) account administrator for help.

This document is a list and a checklist. It changes no code, no Givebutter setting and nothing in Cloudflare. The API key is a credential and is never recorded here.

## Decisions this list assumes

- The leaderboard shows the participant's **Givebutter display name** (Product Authority, 2026-11-24), or a team name where teams are used. It never shows a real name, email address or phone number (#4139).
- Three boards: Funding the Fight (most dollars), Raising Awareness (most donors), Champion (dollars plus donors). Only donations dated **2027-03-25 12:00 AM through 2027-06-07 11:59 PM America/New_York** count (#4432, 2026-11-12 and 2026-11-22). In UTC that is 2027-03-25T04:00:00Z through 2027-06-08T03:59:59Z (daylight time).
- The API is the source for the live leaderboard. The Claude connector is for checking and design work only: it runs inside a Claude session under one login, so no scheduled job can call it.
- The website shows no auction content beyond one link to the auction. The auction is promoted in the daily social posts (Product Authority, 2026-11-24).
- The headline total is the **grand total**: donations plus auction proceeds, shown against the $10,000 goal. Product Authority expects Givebutter to report it as one figure. After the fundraiser the website shows the final grand total with a thank-you message to all participants and donors.
- Aggregate numbers only are stored. Donor details are read in memory if needed and dropped.

## Source 1: the campaign

API: `GET /v1/campaigns/{id}`. Campaign ID **594479** (public code `VLY2WN`, slug `LouGehrigFanClub2027`) on the Live Like Lou Foundation account (ID 75034).

| Field | Use on the website | Seen through the connector, 2026-11-24 |
| --- | --- | --- |
| `id` | Config value `GIVEBUTTER_CAMPAIGN_ID` (numeric only) | Yes: 594479 |
| `title` | Page heading | Yes: "Lou Gehrig Fan Club ALS Fundraiser" |
| `status` | Hide the leaderboard unless the campaign is live | Yes: `unpublished` (values: unpublished, inactive, active, completed) |
| `goal` | Progress toward the goal | Yes: 10000 |
| `raised` | Overall total (all dates; see Source 4 for the windowed total) | Yes: 0 |
| `donors` | Supporter count | Yes: 0 |
| `end_at` | Time-remaining display | Yes: 2027-06-08T03:45:00Z (see Differences) |
| `published_at` | Show "coming soon" before publish | Yes: empty |
| `currency` | Formatting | Yes: USD |
| `url`, `slug` | Donate and join links | Yes |

## Source 2: participants

API: `GET /v1/campaigns/{id}/members`. One row per registered fundraiser (an LGFC member who registered on Givebutter).

| Field | Use | Keep? | Seen through the connector |
| --- | --- | --- | --- |
| `id` | Stable key for a participant | Keep | Yes |
| `display_name` | The only name shown | Keep | Yes (no rows yet, so contents unverified) |
| `raised`, `donors` | Totals for ranking | Keep, but see Source 4 | Yes |
| `goal` | Per-participant progress, if shown | Keep | Yes |
| `url` | Link to the participant's Givebutter page | Keep | **Not exposed by the connector.** Must be checked in the API. |
| `team_id`, `team_name` | Team grouping, if teams are used | Keep | Yes |
| `public` | Do not list a participant who is not public | Keep | Yes |
| first and last name, `contact_name` | None | **Drop** | Visible to the connector; never read |
| email, phone, address, picture | None | **Drop** | Returned by the API; never leave the client |

## Source 3: teams (only if Product adopts teams, Decision D4)

API: `GET /v1/campaigns/{id}/teams`.

| Field | Use | Seen through the connector |
| --- | --- | --- |
| `id`, `name` | Team name shown on the board | Yes |
| `raised`, `donors` | Team totals | Yes |
| `member_count` | Members on the team | Yes |
| `goal` | Team progress, if shown | Yes |

## Source 4: transactions (needed for the date window)

The `raised` and `donors` figures on members and teams are totals for the whole campaign. They include any donation made before 2027-03-25, which the rules exclude. A windowed board therefore needs the donations themselves.

API: `GET /v1/transactions`, limited to the campaign. This endpoint carries donor personal data, so the client reads only the fields below, adds them up in memory, and stores and logs only the totals.

| Field | Use | Keep? | Seen through the connector |
| --- | --- | --- | --- |
| `amount` | Dollars raised | Keep (summed only) | Yes |
| `transacted_at` | Is the donation inside the window, and which day | Keep | Yes |
| `status` | Count only completed, non-refunded donations | Keep | Yes |
| `campaign_member_id` | Which participant gets the credit | Keep | Yes |
| `team_id` | Which team gets the credit | Keep | Yes |
| `contact_id` | Count distinct donors per participant, in memory only, never stored | Keep, memory only | Yes |
| name, email, phone, address, company, dedication, public message, internal note, check number | None | **Drop** | Not read |

Open questions the transaction data must answer (see checklist): offline gifts (cash or check) and which date applies (`transacted_at`, `captured_at` or `offline_payment_received_at`); pledges; refunds; soft credits; anonymous donors; and whether auction and ticket sales count toward the participant's total. Transactions split into `donation_total`, `auction_total`, `ticket_total` and `product_total`, so the rule can be applied once Product states it.

If donations were held closed until 2027-03-25, the member and team totals would already be correct and the transactions would only be needed for the daily history and the April 30 and May 31 checkpoints. Product Authority is asking Givebutter Help whether that can be done cleanly. Counting only the window makes the hold unnecessary for the leaderboard.

## Source 5: auction (optional, later)

| Field | Use | Seen through the connector |
| --- | --- | --- |
| Auction `start_at`, `end_at`, `is_started` | Countdown and gating | Yes |
| Auction items (`campaign_items`) | Item preview on the website, if Product wants it | None imported yet |

The auction items are not a leaderboard input and are not shown on the website; the website links to the auction only. What does matter is the grand total: check that the campaign `raised` figure includes auction proceeds (checklist step 2), because the headline total and the progress bar depend on it. Whether auction proceeds also count toward a participant's own total is a separate Product decision.

## What the connector confirmed on 2026-11-24

- The connector, authorized on the Live Like Lou account, sees campaign 594479: unpublished, USD, goal $10,000, no participants, no teams, no transactions, no items.
- It exposes `display_name`, `raised`, `donors`, `team_name` and `public` for participants, and `name`, `raised`, `donors` and `member_count` for teams.
- It does not expose the participant page URL.
- With no participants or donations, no real values could be checked. Everything marked "Yes" means the field exists, not that it holds good data.

## Differences found in the draft campaign (for Product Authority)

| Item | Recorded in the repo | In Givebutter now |
| --- | --- | --- |
| Fundraiser end | 2027-06-07, 11:59 PM Eastern (#4432, 2026-11-22) | `end_at` 2027-06-07, **11:45 PM** Eastern (2027-06-08T03:45:00Z) |
| Auction end | 2027-06-07, 11:59 PM Eastern (#5209 note, 2026-11-18) | 2027-06-07, **11:45 PM** Eastern |
| Auction start | Production launch 2027-05-01 (#5209 note) | Auction starts 2027-05-28, 12:00 AM Eastern. Product Authority gave 5/28 on 2026-11-24. |
| Campaign type | Peer-to-peer (#4430) | Type is `event`. Confirm participant (peer-to-peer) fundraising is turned on. |
| Publish date | 2027-02-01 | Not published |

## Verification checklist (run once the API key exists)

1. Confirm the key is read-only and as narrow as Givebutter allows. Record only that fact, never the value.
2. `GET /v1/campaigns/594479` returns the Source 1 fields. Check `status`, `goal` and `end_at`. After the auction has bids, check that `raised` equals donations plus auction proceeds (the grand total Product expects) and compare it with the transaction totals by type (`donation_total`, `auction_total`).
3. `GET /v1/campaigns/594479/members` returns an empty list now, and after 2027-02-01 rows with `display_name`, `raised`, `donors`, `url`, team fields and `public`. Check that `url` is present and points to givebutter.com.
4. Register one test participant (ask Givebutter Help whether this is possible while unpublished). Check what `display_name` holds when the person sets no alias. If it defaults to the real name, say so to Product Authority before the board is public.
5. `GET /v1/campaigns/594479/teams` returns the Source 3 fields, if teams are used.
6. Make one test donation (or a pledge or offline gift if the platform allows). Check `amount`, `transacted_at`, `status`, `campaign_member_id` and `team_id` on the transaction, and which date applies to an offline gift.
7. Confirm a refunded donation changes `status` and is excluded.
8. Confirm the daily total computed from transactions equals the participant `raised` for a day inside the window, and differs by exactly the earlier donations for one made before 2027-03-25.
9. Confirm the client output holds no email, phone, address, real name or donor name (`tests/givebutter-client.test.ts` pattern).
10. Record the result on #4432, and each missing or empty field on #5501 for the LLL administrator.

## Questions for Givebutter Help and the LLL administrator

- Can donations be held closed until 2027-03-25 while the page is live for registration? (Product Authority is asking.)
- Is peer-to-peer fundraising turned on for this `event` campaign, and can a test participant and a test donation be created before publishing?
- What does `display_name` hold when a participant sets no alias?
- Does the API key scope allow reading only this campaign? What is the narrowest key?
- Which fund do these donations go to? The account has four funds, and the campaign shows none assigned in the connector.

## Related

- Design and build plan: `docs/reference/operations/2027-fundraiser-dashboard-and-checkpoint-prizes-design.md`
- API connection how-to: `docs/how-to/ops/givebutter-api-connection.md`
- Hold: #5209 (no Givebutter key, configuration or Production call until released)
