---
Doc Type: How-To
Audience: AI
Authority Level: Procedure
Owns: Cursor review-packet format for ChatGPT review
Does Not Own: PR review decisions, merge decisions, or issue closeout
Canonical Reference: /docs/reference/pmo/lgfc-cursor-execution-contract.md
Related Issues: #1351
Last Reviewed: 2026-06-05
---

# Prepare a Cursor Review Packet

## Purpose

Provide ChatGPT with enough information to review scope before a PR is opened.

## Procedure

1. Confirm the active source issue and task allowlist.
2. Produce the required packet fields listed below.
3. Include scope confirmation from `git diff --name-only`.
4. Separate pre-merge vs post-merge issue actions in the timing table.
5. Stop before opening a PR unless Bill/ChatGPT authorizes direct PR creation.

## Required Packet

```text
Task:
Source issue:
Mode: Review packet only — no PR, no push, no merge
Command used for diff:
Changed-file list:
Scope confirmation:
Validation results:
Issue state timing:
Recommended closeout comments:
Full local diff:
```

## Scope Confirmation

Always include:

```text
Only these paths changed:
<git status / git diff --name-only output>
```

## Issue Timing Table

Separate actions into:

| Action | Before PR merge | After PR merge |
|---|---|---|
| Open PR | allowed after approval | n/a |
| Close source issue | no | yes, after verification |
| Close superseded issues | no | yes, after ChatGPT approval |
| Comment-only handoff | no | yes, after merge |

## PR Creation Sequencing

Cursor must prepare a review packet before opening a PR unless Bill or ChatGPT
explicitly authorizes direct PR creation.

This packet-before-PR rule is an **orchestration safeguard**. It does not
contradict repo governance that allows an agent to open an unassigned PR after
receiving an approved PR template or explicit PR-opening instruction from
Bill/ChatGPT.

When Bill/ChatGPT provides an explicit PR-opening instruction or approved PR
template, Cursor may open the PR unassigned using
`/.github/pull_request_template.md` and the mandatory governance fields in
`/docs/how-to/cursor/open-task-pr.md`.

Cursor must not merge, close issues, or mutate issue state when opening a PR.

## Rule

Do not open the PR until ChatGPT has reviewed the packet unless Bill explicitly
authorizes direct PR creation.
