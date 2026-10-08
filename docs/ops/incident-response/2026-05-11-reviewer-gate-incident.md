---
Doc Type: Postmortem
Audience: Maintainers and AI agents
Authority Level: Operational Authority
Owns: Operational incident summary for reviewer gate troubleshooting
Does Not Own: Repository workflow implementation
Canonical Reference: .github/workflows/reviewer-response-completion.yml
Last Reviewed: 2026-05-11
---

# Reviewer Gate Incident Postmortem - 2026-05-11

This postmortem covers PRs #1003, #1006, #1007, and #1010.

## Findings

- The blocking workflow was GATE - Reviewer Response Completion, not GATE - Reviewer Response.
- Actionable inline review comments must be accounted for in the PR body.
- Top-level reviewer issue comments can satisfy reviewer-presence checks when they have no commit ID.
- Top-level maintainer comments do not replace inline review-comment accounting.
- New commits can stale commit-bound reviewer artifacts.
- PR-body edits do not change the PR head SHA.
- The workflow quiet period can temporarily fail otherwise-correct PRs.

## Correct Debugging Sequence

1. Inspect the full PR checks panel.
2. Identify the exact failing workflow.
3. Identify the exact failing job.
4. Inspect the exact job log or gate comment output.
5. Patch only the exact failed assertion.

## Follow-up

Issue #1009 tracks parser fixture verification coverage.
