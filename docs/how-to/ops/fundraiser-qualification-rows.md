---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Which #4470 fundraiser qualification rows can run without a live campaign, and how to re-run them
Does Not Own: The Givebutter widget, a live campaign, donor data, or Production writes
Canonical Reference: /docs/ops/implementation-plans/issue-3633-001-design-reconciliation.md
Related Issues: #4470, #4139, #4430
Last Reviewed: 2026-10-27
---

# Fundraiser qualification rows without a live campaign

## Rows in this check

These rows do not need a Givebutter campaign:

- The home fundraiser teaser stays hidden when no update is published.
- The teaser stays hidden when the list request fails or throws.
- The details feed shows an error and no items when the list request fails or throws.
- The details feed shows its empty message when the list succeeds with no items.

The body text in the passing example does not include donor data.

## Row that waits

The embedded Givebutter widget row waits for #4139 and #4430. Do not add widget tests on #4470.

## Steps

1. From the repository root, run the qualification check:

```bash
./node_modules/.bin/vitest run tests/fundraiser-inactive-degraded.test.tsx --exclude '**/lgfc-*/**'
```

2. Pass means all seven cases pass.
3. A failure is a qualification failure for that row, not a Production change.
