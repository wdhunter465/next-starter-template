# Claude Code session preferences (this repo)

## Pull requests: create ready for review, not draft

When opening a pull request in this repo, create it ready for review
(`draft: false`), not as a draft, so it's immediately visible to
reviewers instead of sitting in draft state.

This changes only the draft/ready flag at creation time. It does not
grant merge-readiness, skip required checks, or override any other PR
governance in this repo (protected-path review requirements, self-merge
prohibition, reviewer-lifecycle gate, issue-first requirements, etc.) —
a PR opened this way still must satisfy every canonical PR requirement
before it is actually mergeable.
