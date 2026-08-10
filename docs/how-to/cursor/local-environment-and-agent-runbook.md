---
Doc Type: How-To
Audience: Bill, Day-2 Operations, Cursor Local
Authority Level: Operational Authority
Owns: Repeatable Chromebook/Linux Cursor Local environment startup, agent operating boundaries, and restart-without-chat-memory checklist
Does Not Own: PMO governance contracts (#1719), rule-load simplification (#2088), merge authority, secrets storage, or CI behavior changes
Canonical Reference: /docs/how-to/cursor/local-environment-and-agent-runbook.md
Related Issues: #2092, #1613, #1719, #2088, #3212
Last Reviewed: 2026-08-10
---

# Cursor Local environment and agent runbook

## Purpose

Give an operator a single restartable procedure for Cursor Local on the Chromebook Linux VM so work can resume from repository + GitHub state without depending on chat memory.

## Startup assumptions

| Assumption | Expected truth |
| --- | --- |
| Host | Chromebook Linux container (`penguin`) with outbound HTTPS to GitHub |
| Repo path | `~/next-starter-template/next-starter-template` (clone of `wdhunter465/next-starter-template`) |
| Runtime | Cursor Local Agent/Composer (not `@cursor` Cloud unless Issue says `Runtime: cloud`) |
| Auth | `gh auth status` shows an authenticated user with repo issue/PR access |
| Wake transport | Primary: `lgfc-cursor` dispatch (`docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`). Bridge/poll-wake are retired (#3212 Phase 4) |
| Authority | GitHub Issues/PRs + repo docs — never chat-only instructions |

If any assumption fails, stop and fix the host/auth/clone before claiming an Issue.

## Preflight (every session)

Run from the repo root:

```bash
pwd
git rev-parse --show-toplevel
git status -sb
git fetch origin main --quiet
gh auth status
node .agents/checks/agent-governance-check.mjs .
```

Expect:

- working tree under the expected clone path;
- `gh` authenticated;
- governance check **PASS**.

Also confirm Cursor project rules **Always Apply**:

- `00-mandatory-doc-chain`
- `10-pr-governance-preflight`
- `20-stop-conditions`

Verification procedure: `docs/how-to/cursor/agent-session-bootstrap.md`.

## One-agent / one-issue / one-PR rule

1. Claim exactly one open source Issue (`agent:cursor` + team label as required).
2. Work only that Issue until PR open (or documented HOLD / PACKAGE-INCOMPLETE).
3. One governing Issue → one implementation PR.
4. Do not mix Issues in one PR.
5. Do not start the next queue Issue until the current Issue’s deliverable is packaged (PR opened or explicit stop recorded on the Issue). Continuous queue work is serial packaging, not parallel mixed PRs.

## Safe branch and working-directory handling

1. Start from a clean `origin/main` (or the Issue-authorized base).
2. Create `cursor/<issue>-<short-name>-2e48` only after the governing Issue exists and the pre-implementation checkpoint is posted.
3. Keep the working directory at the repository root unless the Issue allowlist explicitly names another path.
4. Do not edit outside the Issue file-touch allowlist.
5. For parallel Claude/Cursor worktrees, follow `docs/how-to/ops/cursor-parallel-worktree-standard.md` — never share one dirty worktree across agents.
6. Do not `git push --force` to `main`, amend others’ commits, or skip hooks unless the Issue explicitly authorizes it.

Git/PR authority fields (section 2A) live in `docs/templates/agent-assignment-template.md`.

## Mandatory documentation chain (before edits)

Read in order (do not skip):

1. `Agent.md`
2. `docs/ops/ai/SHARED-AGENT-RULES.md`
3. `docs/ops/ai/CORE-RULES.md`
4. `docs/ops/ai/CURSOR-RULES.md`
5. Applicable `.agents/skills/*/SKILL.md`
6. Source GitHub Issue + task-linked authority files

For PR work also read:

- `.agents/skills/lgfc-pr-governance/SKILL.md`
- `.github/pull_request_template.md`
- `docs/how-to/cursor/open-task-pr.md`

## Local agent stop conditions

Stop and report on the source Issue instead of improvising when:

- no primary source Issue;
- no exact file-touch allowlist;
- unclear scope or authority conflict;
- mixed intent in one PR;
- edits would leave the allowlist;
- GitHub primary/secondary rate limit or unauthenticated API access;
- required verification cannot be run and no valid disclosure path exists;
- merge/self-approval would be required of the implementing agent.

Canonical detail: `docs/ops/ai/CORE-RULES.md` and `.cursor/rules/20-stop-conditions.mdc`.

## Restart without chat memory

When starting a fresh Cursor chat:

1. Open the repo in Cursor Local.
2. Run Preflight above.
3. Read the open Operations/queue Issue (labels + latest checkpoint comments), not prior chat.
4. Confirm branch / PR state with `git status` and `gh pr/issue view`.
5. Re-read the mandatory documentation chain and the Issue allowlist.
6. Continue from GitHub evidence only (Issue comments, PR body, checks).

Do not reconstruct task intent from remembered chat.

## Standard execution loop

1. Post pre-implementation checkpoint on the Issue (SHA, branch, allowlist, non-goals).
2. Implement inside the allowlist.
3. Verify with Issue-named commands; disclose known out-of-scope failures.
4. Open PR with template fields filled (`docs/how-to/cursor/open-task-pr.md`).
5. Comment handoff on the Issue with PR URL, SHA, and remaining risks.
6. Do not self-merge.

Program-task pattern: `docs/how-to/cursor/run-program-task.md`.

## Validation commands (baseline)

```bash
node .agents/checks/agent-governance-check.mjs .
# Plus any Issue-specific checks named in the source Issue
```

Record exact commands and pass/fail in the PR body.

## READY FOR REVIEW handoff

A local agent assignment is ready for review when:

- allowlist-only diff is pushed;
- PR body has Issue, allowlist, verification, acceptance criteria, and post-merge disposition;
- Issue comment links the PR;
- no unresolved stop condition remains undisclosed.

## Related authority (link, do not duplicate)

| Topic | Canonical doc |
| --- | --- |
| Session bootstrap verification | `docs/how-to/cursor/agent-session-bootstrap.md` |
| Runtime local vs cloud | `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` |
| Dispatch runner (primary wake) | `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md` |
| Roles / no self-merge | `docs/governance/AGENT-TEAM.md` |
| Execution contract | `docs/reference/pmo/lgfc-cursor-execution-contract.md` |
| Handoff workflow | `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` |
| Parallel worktrees | `docs/how-to/ops/cursor-parallel-worktree-standard.md` |
