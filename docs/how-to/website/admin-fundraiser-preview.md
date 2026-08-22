---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Fundraiser preview and campaign spotlight alignment checks
Does Not Own: Payment processing, donation flows, or product fundraising strategy
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1125
Last Reviewed: 2026-06-14
---

# Admin Fundraiser Preview

## Purpose

Preview fundraiser/campaign spotlight data before public exposure (`#1125` / T47).

## Scope

Route: `/admin/fundraiser-preview`

Related public components: `CampaignSpotlightSlot`, `CampaignSpotlightCard`,
`src/lib/campaignSpotlight.ts`.

## Steps

1. Sign in as an admin member.
2. Open **Fundraiser Preview**.
3. Load preview payload.
4. Validate campaign fields (title, link, dates, spotlight eligibility).
5. Confirm homepage spotlight alignment if campaign is active.

## Procedure

### Load preview

1. Open **Fundraiser Preview**; preview data loads automatically for a signed-in admin member.
2. Refresh preview data.
3. Review rendered preview panel and raw fields shown in the UI.

### Fail-closed behavior

- Without an authenticated admin session, preview must not load privileged campaign configuration.
- On validation or API errors, status uses `Error:` prefix.
- Do not expose draft campaign data on public routes until publish rules are met.

### Public alignment check

When activating a campaign, verify the homepage spotlight slot shows expected copy
and link targets on the deployed site.

## Verification

- `tests/admin-fundraiser-preview.test.tsx`
- Manual: preview blocked until signed in as an admin member.

## Closeout Criteria

Fundraiser preview is complete when operators confirm campaign data is accurate and
public spotlight behavior matches intent.
