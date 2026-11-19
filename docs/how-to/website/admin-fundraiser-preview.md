---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: Fundraiser preview, 2027 sample leaderboard dry-run checks, and campaign spotlight alignment checks
Does Not Own: Payment processing, donation flows, or product fundraising strategy
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1125, #4432
Last Reviewed: 2026-11-18
---

# Admin Fundraiser Preview

## Purpose

Preview fundraiser/campaign spotlight data and the 2027 leaderboard dry run before public exposure (`#1125` / T47, #4432).

## Scope

Route: `/admin/fundraiser-preview`

Related public components: `CampaignSpotlightSlot`, `CampaignSpotlightCard`,
`src/lib/campaignSpotlight.ts`.

The 2027 leaderboard preview is sample-only until the LiveLikeLou/Givebutter access hold is released. It uses
aggregate participant fields from `src/lib/fundraiser-leaderboard.ts`; it does not call Givebutter, read an API key,
write D1, or display donor personal information.

## Steps

1. Sign in as an admin member.
2. Open **Fundraiser Preview**.
3. Confirm the **2027 Leaderboard Dry Run** shows sample data only.
4. Validate the three boards:
   - **Funding the Fight**: most funds raised.
   - **Raising Awareness**: most donors.
   - **Champion**: dollars raised plus donors.
5. Validate campaign fields (title, link, dates, spotlight eligibility).
6. Confirm homepage spotlight alignment if campaign is active.

## Procedure

### Load preview

1. Open **Fundraiser Preview**; preview data loads automatically for a signed-in admin member.
2. Refresh preview data.
3. Review rendered preview panel and raw fields shown in the UI.

### Leaderboard dry run

1. Confirm the dry run is labeled **Sample data only**.
2. Confirm the overall progress uses the 2027 window: 2027-03-25 through 2027-06-07 in `America/New_York`.
3. Confirm only aggregate participant fields are present: public display name, dollars raised, donor count, and
   Champion points. Do not add donor names, emails, phones, addresses, messages, or per-donor amounts.
4. Confirm the preview does not show MLB-team placeholder rows or the retired `amount × donors` points formula.
5. Treat tied entries as deterministic sample ordering by participant name until Product Authority records the final
   tie-break rules on #4415.

### Fail-closed behavior

- Without an authenticated admin session, preview must not load privileged campaign configuration.
- On validation or API errors, status uses `Error:` prefix.
- Do not expose draft campaign data on public routes until publish rules are met.
- Givebutter live reads, API keys, Cloudflare variables, D1 writes, and Production writes remain out of scope for the
  sample-only preview.

### Public alignment check

When activating a campaign, verify the homepage spotlight slot shows expected copy
and link targets on the deployed site.

## Verification

- `tests/admin-fundraiser-preview.test.tsx`
- `tests/fundraiser-leaderboard-4432.test.ts`
- Manual: preview blocked until signed in as an admin member.

## Closeout Criteria

Fundraiser preview is complete when operators confirm campaign data is accurate, the sample leaderboard dry run is
privacy-safe, and public spotlight behavior matches intent.
