---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational Authority
Owns: Test plan for ALS fundraiser campaign spotlight feature
Does Not Own: Test infrastructure; design specifications
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Last Reviewed: 2026-03-08
---

# Campaign Spotlight Test Plan

Last Updated: 2026-03-08

## Procedure

Run each group of checks below.

### Layout Tests

Verify:

- section renders between Hero and Weekly Matchup
- section spacing matches design system
- fonts consistent with homepage styles

### Fail Closed Tests

If API fails → section does not render.

### Leaderboard Tests

Validate:

points = funds × supporters

Winner logic:

- no duplicate winners
- correct removal order

### Admin Preview Tests

Verify /admin/fundraiser-preview renders section correctly.

