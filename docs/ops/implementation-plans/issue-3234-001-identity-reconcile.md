---
Doc Type: Implementation Plan
Audience: Human + AI
Authority Level: Operational Plan
Owns: Task #3234-001 reconciliation of identity requirements, live accounts, and provenance gaps
Does Not Own: Account creation, token issuance, ruleset edits, branch protection, review or merge grants, or Product approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3234, #3888, #3889, #3890
Last Reviewed: 2026-10-07
---

# Issue #3234-001 identity reconcile

## Status

`_DRAFT` — first preparation task of Active project #3234. This file records the gap between the parent identity model and the live repository. It creates no GitHub user, token, ruleset actor, or permission.

## Requirement from #3234

The parent requires distinct GitHub-native actors so authorship, review, approval, and merge stay separable:

- Product Authority is a human identity. The parent names `wdhunter645` for that role and says it is not the repository owner slug.
- The repository owner slug is `wdhunter465/next-starter-template`.
- Implementation agents that push branches or open pull requests need their own identities. The parent names conceptual candidates `lgfc-cursor`, `lgfc-claude`, and `lgfc-grok`.
- Builders must not approve their own work.
- Agents must not self-provision identities, widen their own permissions, change branch protection, or grant themselves review or merge authority.

## Live evidence (2026-10-07)

Queried with `gh api repos/wdhunter465/next-starter-template/collaborators` and `gh api user` from the operator environment that opens Cursor pull requests.

| Actor | Live result |
| --- | --- |
| Collaborators | `wdhunter465` only, role `admin` |
| Authenticated API user for this operator | `wdhunter465` |
| `lgfc-cursor`, `lgfc-claude`, `lgfc-grok` | not collaborators |
| `wdhunter645` | not a collaborator |

Cursor and Claude Code pull requests and issue comments in the current book are authored as `wdhunter465`. GitHub therefore cannot tell those agents apart from each other or from the repository admin. That is the provenance gap the parent describes.

## Gaps

1. No dedicated implementation-agent identity is on the repository.
2. The Product Authority user named in the parent is not a collaborator, so a human approval from that account cannot be recorded on this repository today.
3. One admin account currently performs implementation commits, issue comments, and any approval that uses the same login. GitHub will treat author and approver as the same person.
4. Ruleset `Main` is present. This reconcile does not change who can bypass it.

## Protected stop

Account creation, personal access tokens, GitHub App installation, collaborator invites, and ruleset actor changes stay with Product Authority. #3889 must not start those steps from an agent session.

## Next action

Product Authority provisions the distinct identities, or records a different approved identity model on #3234. After that, #3889 can implement only the controls Product has approved. #3890 verifies the audit trail after those identities exist.

## Rollback

Delete this file. No account, secret, workflow, or Production change is attached to it.
