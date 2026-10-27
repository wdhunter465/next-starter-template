---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How to build and read the advisory notification page
Does Not Own: The advisory gate rules, GitHub Pages settings, or Production website deploys
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Related Issues: #4486
Last Reviewed: 2026-10-27
---

# Advisory notification page

## Steps

1. From the repository root, run the row tests:

```bash
./node_modules/.bin/vitest run tests/advisory-dashboard.test.mjs
```

2. Build a page from a fixture when you are not calling GitHub:

```bash
ADVISORY_DASHBOARD_FIXTURE=/path/to/fixture.json node scripts/ops/advisory-dashboard/build.mjs
```

3. The scheduled workflow `Advisory dashboard` builds the live page every 30 minutes. It uses the workflow token with read permission only. Download the `advisory-dashboard` artifact from that run. The file is `index.html`.

4. Read the table newest first. The Response Issue # cell is filled only when an Issue body or comment contains `Responds to advisory: ` followed by that row's comment URL, or when it names both the pull request number and the advisory type. Any other reply stays blank.

5. A failed check appears only when it is outside the required set `quality`, `gitleaks`, and `reviewer-response-completion`. The lookback is 30 days.

The page is not published onto the existing GitHub Pages site. That site is the PMO dashboard publish, and a second Pages deploy would replace it. Putting this page beside `/pmo-dashboard/` is a separate change to that deploy workflow.
