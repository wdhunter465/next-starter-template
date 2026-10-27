---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Controlled AI execution bridge for approved repository maintenance tasks
Does Not Own: OpenAI API execution, autonomous code generation, or merge approval
Canonical Reference: /docs/governance/PR_GOVERNANCE.md
Last Reviewed: 2026-06-04
---

# Controlled AI Execution Bridge

Last Updated: 2026-06-04

## Purpose

The controlled AI execution bridge lets ChatGPT-approved program or project management issues hand off repetitive documentation and repository-maintenance work without manual issue, branch, PR, body, and comment churn.

Phase 1 is deterministic and gated: it validates an approved issue, prepares a branch/PR plan, and comments on the issue. It does not call OpenAI or generate code autonomously.

## When to Use It

Use the bridge when all of the following are true:

- The task is documentation-only or governance-only and already approved by a human or ChatGPT workflow.
- The exact files to touch are known in advance.
- The work can be expressed with the required issue sections and a narrow allowed-files list.
- A maintainer will still review design alignment and approve merge.

## When Not to Use It

Do not use the bridge when:

- The task needs broad repository access or workflow edits.
- Allowed files would include `.github/workflows/*`, `**/*`, `.env`, `.env.*`, or paths that may contain secrets.
- Runtime behavior, secrets, or production configuration must change.
- Design approval has not happened.
- The issue is a pull request masquerading as an issue.

## Required Issue Template Block

Every `ai-build` issue must include these sections with substantive content:

- `## Approved Task`
- `## Scope`
- `## Allowed Files`
- `## Acceptance Criteria`
- `## Validation`

Copy-ready starter text lives in `docs/templates/ai-build-issue-template.md`.

## Allowed Files Rules

- List one exact repository path per bullet under `## Allowed Files`.
- Do not use recursive wildcards such as `**/*`.
- Do not include workflow paths under `.github/workflows/`.
- Do not include environment files such as `.env` or `.env.local`.
- Do not include paths that imply secrets, credentials, or private keys.

The validator fails closed when the list is missing, empty, or unsafe.

## Safety Model

The bridge enforces least privilege in GitHub Actions:

- `contents: write`
- `issues: write`
- `pull-requests: write`

Before any write, the workflow validates the issue body. Failed validation produces an issue comment and stops. Passed validation produces a deterministic branch/PR plan comment only in phase 1.

No secrets, API keys, or OpenAI calls are part of this foundation.

## Future Phase for OpenAI API Execution

A later approved phase may connect validated issues to bounded agent execution. That phase must remain behind the same issue template, allowed-files enforcement, and human merge gate. Phase 1 intentionally documents the future hook without enabling it.

## Workflow Overhead Reduction

This bridge reduces repetitive ChatGPT, Cursor, and GitHub overhead by:

- Replacing manual re-entry of scope, allowlist, and validation commands in PR bodies.
- Standardizing the `ai-build` label as the single automation trigger.
- Commenting validation results or the prepared branch/PR plan directly on the source issue.

## Human and ChatGPT Control

Design approval and merge approval remain human- or ChatGPT-controlled. The bridge prepares work; it does not bypass reviewer gates, intent labels, drift checks, or maintainer merge decisions.

## Procedure

0. Confirm the `ai-build` label exists (Settings → Labels, or run the **Ensure AI Build Label** workflow on `main`).
   - Automated smoke: **AI Execution Bridge Smoke Test** runs on bridge-related `main` changes and weekly (Monday 09:00 UTC).
1. Create or update a source issue using `docs/templates/ai-build-issue-template.md`.
2. Fill every required section with exact paths and verification commands.
3. Confirm the allowed-files list is narrow and safe.
4. Apply the `ai-build` label to the issue.
5. Read the workflow comment on the issue:
   - validation failure: fix the issue body and re-apply the label after corrections
   - plan ready: use the planned branch name and PR body as the implementation handoff
6. Implement changes locally or in Cursor within the allowed-files list only.
7. Open one PR against `main` using the planned PR governance body and exactly one source issue line: `- **Issue:** #<issue-number>`.
8. Run the validation commands from the issue and record results in the PR body.
9. Request human/ChatGPT review; do not merge until approval.
## Automation note

GitHub does not emit `issues:labeled` when the `ai-build` label is applied by `GITHUB_TOKEN` in Actions. In that case use **AI Execution Bridge** `workflow_dispatch` with the issue number, or apply the label manually in the GitHub UI.
