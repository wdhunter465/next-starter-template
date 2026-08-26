---
Doc Type: How-To
Audience: Codex, Bill
Authority Level: Operational Authority
Owns: Codex runtime/bootstrap qualification procedure and evidence format for #3758
Does Not Own: Codex standing role or authority (`docs/ops/ai/CODEX-RULES.md`, `docs/governance/AGENT-TEAM.md`), CI/automation integration (#3757), end-to-end lifecycle qualification (#3759)
Canonical Reference: /docs/ops/ai/CODEX-RULES.md
Related Issues: #3755, #3758
Last Reviewed: 2026-08-26
---

# Qualify Codex runtime, startup, and GitHub repository access

## Purpose

This is the executable procedure for #3758. It exists because #3758's qualification must be run **from the Codex environment itself** — no other agent can produce this evidence. Work through every capability below in order, record the exact evidence format specified, and report pass/fail per capability plus an overall result on Issue #3758.

Do not begin unrelated implementation while running this qualification. This procedure is itself the bounded scope of #3758.

## Before you start

Read, in order (per `docs/ops/ai/CODEX-RULES.md`'s mandatory documentation chain):

1. `Agent.md`
2. `docs/governance/REPOSITORY-AUTHORITY.md`
3. `docs/governance/AGENT-TEAM.md`
4. `docs/ops/ai/SHARED-AGENT-RULES.md`
5. `docs/ops/ai/CORE-RULES.md`
6. `docs/ops/ai/CODEX-RULES.md`
7. This file
8. Issue #3758 itself

## Evidence format

For each capability below, record:

```text
Capability: <name>
Command(s) run: <exact command(s)>
Result: PASS | FAIL
Evidence: <relevant output, truncated if long>
Remediation (if FAIL): <what was tried, what's still broken>
```

Post the complete set as a comment on Issue #3758 (or a linked PR if a repository change is needed to fix a bootstrap/runtime gap — see "If something fails" below).

## Procedure

### 1. Repository identity and synchronization

```bash
pwd
git rev-parse --show-toplevel
git remote get-url origin
git status -sb
git fetch origin main --quiet
git log -1 --format='%H %s' origin/main
```

Expect: working tree resolves to a clone of `wdhunter465/next-starter-template`; `git status -sb` shows a clean tree (or explicitly note what's dirty and why); `fetch` succeeds; `origin/main` HEAD is readable.

### 2. GitHub authentication and repository permissions

```bash
gh auth status
gh repo view wdhunter465/next-starter-template --json viewerPermission
```

Expect: authenticated user/app identity shown; `viewerPermission` at least `WRITE` (branch push + PR create/update require this).

### 3. Issue and PR read access

```bash
gh issue view 3758 --repo wdhunter465/next-starter-template
gh pr list --repo wdhunter465/next-starter-template --limit 5
```

Expect: Issue #3758's body and comments render; PR list returns without an authorization error.

### 4. CI/check/review-state visibility

```bash
gh pr checks <any-recent-PR-number> --repo wdhunter465/next-starter-template
```

Expect: check names and states (success/failure/pending) are visible. If no PR is available yet, defer this step until step 6 produces one, then run it against that PR.

### 5. Branch creation and push

Pick a branch name unique to this run (append the date or a short run ID) so a rerun or a second qualification pass never collides with a leftover branch:

```bash
BRANCH="codex/3758-runtime-qualification-$(date +%Y%m%d%H%M)"
git checkout -b "$BRANCH" origin/main
git push -u origin "$BRANCH"
```

Expect: branch created from current `main`; push succeeds without requiring elevated permissions beyond what step 2 already confirmed. Record the actual branch name you used — later commands in this procedure assume `$BRANCH` is still set in your shell.

### 6. PR creation and update capability

Issue #3758 requires demonstrating both create *and* update. Make a trivial, reversible change inside this qualification's own scope (for example, appending your evidence block to this file under a `## Qualification evidence (#3758)` heading you add), then:

```bash
git add docs/how-to/codex/qualify-codex-runtime.md
git commit -m "docs(#3758): record runtime qualification evidence"
git push
gh pr create --repo wdhunter465/next-starter-template --base main --head "$BRANCH" --title "docs(#3758): Codex runtime qualification evidence" --body "See Issue #3758."
```

Then demonstrate update — push a second commit (for example, filling in a result you couldn't record until the PR existed) and confirm it appears on the same PR:

```bash
git add docs/how-to/codex/qualify-codex-runtime.md
git commit -m "docs(#3758): update runtime qualification evidence"
git push
gh pr view --repo wdhunter465/next-starter-template "$BRANCH" --json commits
```

Expect: PR opens successfully in the create step, and the second push updates the same PR (visible as an additional commit, not a new PR). This also produces a live PR for steps 4 (retroactively) and 7.

Before reporting this PR as ready for review, confirm its actual GitHub state per `docs/governance/PR_READY_FOR_REVIEW_HANDOFF.md`: move it out of Draft using **Ready for review**, or record the explicit blocker if it must stay Draft. Report the literal state: `GitHub PR state: draft / ready for review / merged / blocked with documented reason`.

### 7. Local validation commands

`docs/ops/ai/CORE-RULES.md` requires running task-relevant local checks before marking a PR ready — it does not mandate one fixed command set. For this qualification, use the repository's own `package.json` scripts as the baseline:

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

Expect: all four complete (PASS or a clearly attributable pre-existing failure unrelated to this qualification — do not fix unrelated failures here, just note them).

### 8. `.agents/skills/*` guidance loading

```bash
ls .agents/skills/
cat .agents/skills/lgfc-pr-governance/SKILL.md | head -20
```

Confirm you can read at least the `lgfc-pr-governance` skill (the one every PR-opening agent needs) and report which other skills you can enumerate.

### 9. `run startup` behavior

In a **fresh** Codex session (new context, no prior chat memory of this qualification), issue the literal command `run startup` and record the complete response. It must:

- follow the exact, current startup report defined in `docs/ops/ai/CODEX-RULES.md`'s "Codex startup contract" section — read that section directly rather than relying on any paraphrase, including this one, which can drift out of sync as `CODEX-RULES.md` evolves;
- **stop** without beginning implementation, self-selecting work, editing files, or mutating any Issue/PR, unless a source Issue was separately supplied and grants that scope.

This is a pass/fail gate on its own: if startup does anything beyond orientation, or omits required report elements, mark this capability FAIL and describe exactly what happened.

## If something fails

- If the failure is a genuine repository bootstrap/runtime defect (for example, a missing script, a broken path reference, an incorrect permission requirement), open a small bounded fix PR under Issue #3758 (or a bounded child Issue if the fix is large enough to need its own scope) rather than working around it silently.
- If the failure is environmental (Codex's own runtime/sandbox configuration, not a repository defect), record it as-is — do not attempt to fix Codex's own runtime from inside this procedure.
- Either way, the qualification evidence you post to #3758 must show the failure and what was done about it, not just a final PASS with no record of the attempt.

## Completion

#3758 passes when every capability above is recorded PASS (or FAIL with a linked, merged remediation and a re-run PASS). Post the full evidence set on Issue #3758 and update its acceptance-criteria checklist. This evidence is a prerequisite for #3759 — do not begin #3759 until #3758 is closed.

## Qualification evidence (#3758)

Run date: 2026-08-26
Runtime: Codex in the repository workspace sandbox
Branch: `codex/3758-runtime-qualification-20260826t1748`

### Repository identity and synchronization — PASS

- Repository: `wdhunter465/next-starter-template`
- Checkout: isolated clone at `/tmp/lgfc-3758`
- Branch started from current `origin/main` and was clean before evidence changes.
- `git fetch origin main:refs/remotes/origin/main` succeeded.

### GitHub authentication and repository permissions — PARTIAL PASS

- REST repository query succeeded and reported `admin`, `maintain`, `push`, `pull`, and `triage` permissions.
- HTTPS Git operations are authenticated and branch push succeeded.
- `gh auth status` reported the configured token and scopes, but its GraphQL probe failed because the account GraphQL rate limit was exhausted. REST access remained operational.

### Issue, PR, CI, and review-state visibility — PASS WITH DEGRADED SURFACE

- REST reads of Issue #3758, PR #3770, PR comments/reviews, branch state, and check runs succeeded.
- GraphQL-backed `gh issue view`, `gh pr view`, and `gh pr checks` were unavailable while the account GraphQL quota was exhausted; equivalent REST endpoints supplied the required evidence.

### Branch creation and push — PASS

- Created `codex/3758-runtime-qualification-20260826t1748` from current `origin/main`.
- Pushed the branch and established upstream tracking.
- Git emitted a sandbox credential-store lock warning, but the authenticated remote push completed successfully.

### PR creation and update — PENDING AT FIRST EVIDENCE COMMIT

- This evidence commit is intentionally recorded before PR creation.
- The PR number and same-PR update proof are added in the required second evidence commit after the PR exists.

### Local validation — PASS AFTER ENVIRONMENTAL CACHE REMEDIATION

- Initial `npm ci` failed because the default npm cache under the home directory is read-only; dependent commands then could not find `tsc`, `next`, or `vitest`.
- Re-run: `npm ci --cache /tmp/lgfc-3758-npm-cache` — PASS (777 packages installed; existing dependency audit reported 29 vulnerabilities).
- `npm run typecheck` — PASS.
- `npm run lint` — PASS with existing advisory warnings.
- `npm test` — PASS: 157 files, 1,760 tests.

### Repository skill loading — PASS

- Enumerated `lgfc-cloudflare-static-export`, `lgfc-design-compliance`, `lgfc-docs-authority`, `lgfc-pr-governance`, and `lgfc-verification-closeout`.
- Read `.agents/skills/lgfc-pr-governance/SKILL.md` successfully.

### Fresh `run startup` behavior — FAIL (ENVIRONMENTAL)

- Command: `codex exec --ephemeral --sandbox read-only -C /tmp/lgfc-3758 'run startup'`.
- Result: the fresh Codex process stopped before orientation with `failed to initialize in-process app-server client: Read-only file system`.
- Safety result: PASS — no repository or GitHub mutation occurred.
- Qualification result: FAIL — no 16-point startup report was produced.
- Required remediation: provide the fresh Codex process a writable product-local session/cache location, then rerun the literal startup command and append the complete response. This is a Codex runtime/sandbox limitation, not a repository-content defect.

### Overall result — FAIL PENDING RERUN

Repository access, permissions, branch push, REST evidence visibility, local validation, and repository skill loading are operational. The qualification remains fail-closed until fresh-session startup succeeds and the PR create/update evidence below is completed.
