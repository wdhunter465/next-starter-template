---
Doc Type: How-To
Audience: Codex, Bill
Authority Level: Operational Authority
Owns: Codex end-to-end lifecycle qualification procedure and evidence format for #3759
Does Not Own: Codex standing role or authority (`docs/ops/ai/CODEX-RULES.md`, `docs/governance/AGENT-TEAM.md`), governance/CI integration defect repair (#3756/#3757), runtime/bootstrap qualification (#3758)
Canonical Reference: /docs/ops/ai/CODEX-RULES.md
Related Issues: #3755, #3756, #3757, #3758, #3759
Last Reviewed: 2026-08-26
---

# Run Codex end-to-end LGFC implementation qualification

## Purpose

This is the executable procedure for #3759, the final qualification gate before parent #3755 can close. It exists because #3759's qualification must be run **from the Codex environment itself**, on one real assignment, without Product Authority manually overriding any obsolete Codex-specific restriction. No other agent can produce this evidence.

## Prerequisites — do not start until all of these are true

- #3756 (governance alignment) is merged.
- #3757 (CI/automation integration) is merged.
- #3758 (runtime/bootstrap qualification) is closed with a full PASS evidence set.

If any integration defect surfaces *during* this qualification that traces back to #3756/#3757/#3758, stop, repair it under the relevant issue (or a bounded successor), and only resume #3759 once the repair is merged. Do not work around a real integration defect just to get #3759 to a green checkmark — that defeats the point of the qualification.

## Selecting the scenario

Pick **one** low-risk, representative, currently-open `team:operations` Issue that:

- is not already claimed by another agent;
- has a clear, bounded scope (small file-touch allowlist, no ambiguous acceptance criteria);
- does not require Production write access or an irreversible action;
- is otherwise ordinary Operations work — not itself part of the Codex onboarding project (#3755–#3759).

Record which Issue was selected and why it qualifies as low-risk/representative before claiming it.

## Evidence format

Record each of the eleven lifecycle steps below as it happens — do not reconstruct evidence retroactively from memory after the fact. For each step:

```text
Step: <n. name>
Result: PASS | FAIL | MANUAL-INTERVENTION-REQUIRED
Evidence: <command output, links, timestamps>
```

If `MANUAL-INTERVENTION-REQUIRED` occurs anywhere in the sequence, record exactly what Product Authority had to do and why — that is itself a qualification-relevant finding, not something to omit because it made the run succeed.

## Procedure — required lifecycle

### 1. Startup/orientation

Fresh Codex session, literal `run startup`. Record the complete 16-point report per `docs/ops/ai/CODEX-RULES.md`. Confirm it stops before loading the scenario Issue.

### 2. Load source Issue and claim/assignment state

Load the scenario Issue selected above. Follow current queue/claim rules (`docs/governance/WORK-QUEUES-AND-COLLABORATION.md`, `docs/governance/AGENT-TEAM.md`) — record the exact claim mechanism used (label added, comment posted, etc.) and confirm no collision with another agent's claim.

### 3. Create/use the authorized branch

```bash
git checkout -b codex/<issue-number>-<short-name> origin/main
git push -u origin codex/<issue-number>-<short-name>
```

Record branch name, base, and head SHA.

### 4. Implement only the bounded scope

Record the exact file-touch allowlist from the Issue and confirm the final diff stays inside it.

### 5. Run required local validation

Run whatever the Issue and `docs/ops/ai/CORE-RULES.md` require (typecheck/lint/tests at minimum; framework-specific build/bundle checks if the diff touches `functions/` or other build-relevant paths). Record exact commands and pass/fail.

### 6. Push branch and create/update PR

```bash
gh pr create --repo wdhunter465/next-starter-template --base main --head codex/<issue-number>-<short-name> --title "<title>" --body-file <path-to-filled-template>
```

Use `.github/pull_request_template.md` — fill every required field. Record the PR number and URL.

Before reporting this PR as ready for review, confirm its actual GitHub state per `docs/governance/PR_READY_FOR_REVIEW_HANDOFF.md`: move it out of Draft using **Ready for review**, or record the explicit blocker if it must stay Draft. Report the literal state: `GitHub PR state: draft / ready for review / merged / blocked with documented reason`.

### 7. Satisfy deterministic CI and repository gates

Record which checks ran, their names, and their conclusions. If GitHub Actions is degraded (check `githubstatus.com` first), note that explicitly rather than treating a stuck check as a Codex-integration defect: a check stuck or failing identically on an unrelated, unmodified path, or a check red on the base branch too, is an external platform issue, not a Codex-integration defect — do not conclude Codex integration is broken from that alone.

### 8. Repair own PR when CI/reviewer findings require changes

If any check fails or a reviewer requests changes, push a fix commit to the same branch/PR — do not abandon the PR and open a new one. Record what failed, what was changed, and the re-run result.

### 9. Hand off for independent review/approval

Confirm the PR is NOT self-approved or self-merged by Codex, and confirm it is not left in Draft state per the check in step 6. Record who/what performed the independent review and its disposition.

### 10. Remain separated from self-approval/self-merge

This is a hard stop condition, not a step to "pass through": Codex must not approve or merge this PR. If at any point Codex is asked to do either, stop and report — do not comply, per `docs/ops/ai/CODEX-RULES.md`'s "Role boundaries."

### 11. Verify post-merge closeout and source-Issue disposition

After an authorized human merges the PR:

```bash
gh pr view <pr-number> --repo wdhunter465/next-starter-template --json state,mergedAt,mergeCommit
gh issue view <issue-number> --repo wdhunter465/next-starter-template
```

Confirm the source Issue reflects correct closeout (closed, or left open with an explicit correct reason) and that post-merge automation recorded the PR against it.

## Evidence required (full set, per #3759)

Compile and post to Issue #3759:

- startup result;
- claim/assignment behavior;
- branch/base/head;
- files changed;
- local test evidence;
- PR number;
- CI/review findings and repairs;
- independent review evidence;
- merge handoff;
- post-merge verification/closeout;
- any manual intervention required because Codex was not correctly integrated (explicitly state "none" if true — do not omit the field).

## Completion

#3759 passes only when every acceptance-criterion checkbox on the Issue is genuinely true from the evidence above — not inferred. Parent #3755 may be closed only after #3759 passes and any integration defects discovered along the way are repaired and merged.
