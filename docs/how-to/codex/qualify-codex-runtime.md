---
Doc Type: How-To
Audience: Codex, Bill
Authority Level: Operational Authority
Owns: Codex runtime/bootstrap qualification procedure and evidence format for #3758
Does Not Own: Codex standing role or authority (`docs/ops/ai/CODEX-RULES.md`, `docs/governance/AGENT-TEAM.md`), CI/automation integration (#3757), end-to-end lifecycle qualification (#3759)
Canonical Reference: /docs/ops/ai/CODEX-RULES.md
Related Issues: #3755, #3758, #3795
Last Reviewed: 2026-08-27
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
LIVE_MAIN_SHA=$(gh api repos/wdhunter465/next-starter-template/commits/main --jq .sha)
LOCAL_MAIN_SHA=$(git rev-parse origin/main)
test "$LOCAL_MAIN_SHA" = "$LIVE_MAIN_SHA"
```

Expect: working tree resolves to a clone of `wdhunter465/next-starter-template`; `git status -sb` shows a clean tree (or explicitly note what's dirty and why); `fetch` succeeds; `origin/main` HEAD is readable.

The authority identity is the live GitHub `main` commit SHA and the commit SHA or
explicitly named live source from which startup reads the authority files. If the
local fetch or ref update fails, do not infer freshness from the cached ref or
checked-out files. Record the failed command and both available SHA identities.

When GitHub is readable but the local ref cannot be refreshed, load the required
authority files directly from live `main` with the read-only Contents API,
repeating the command for each required path:

```bash
authority_path=Agent.md
gh api "repos/wdhunter465/next-starter-template/contents/${authority_path}?ref=main" \
  --jq .content | base64 --decode
```

Record `LIVE_MAIN_SHA`, each live authority path read, and that the Contents API
was the fallback source. If the live commit identity or required live authority
content cannot be read, record FAIL because the authority stack is stale or
unverifiable.

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
BRANCH="codex/3758-runtime-qualification-$(date +%Y%m%d%H%M%S)"
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
npm_config_cache="${TMPDIR:-/tmp}/lgfc-npm-cache" npm ci
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

The fresh-session test must also exercise authority freshness:

1. Verify the normal case where the refreshed local `origin/main` SHA matches the
   live GitHub `main` SHA and startup reads authority from that identity.
2. Exercise or reproduce a stale/unrefreshable-local-checkout case without
   mutating the repository under test.
3. Confirm startup does not report current-authority PASS from stale checked-out
   files or an unrefreshed cached ref.
4. Confirm an available read-only live GitHub authority source may establish
   current authority when local refresh is unavailable, with the fallback and
   compared identities disclosed.
5. Confirm startup fails closed as stale or unverifiable when neither refreshed
   local authority nor a readable live authority source is available.

All freshness outcomes remain orientation-only. Record freshness and fallback
evidence inside the applicable existing report items; do not add, remove, or
renumber any of the 16 startup points, and preserve the stop boundary.

## If something fails

- If the failure is a genuine repository bootstrap/runtime defect (for example, a missing script, a broken path reference, an incorrect permission requirement), open a small bounded fix PR under Issue #3758 (or a bounded child Issue if the fix is large enough to need its own scope) rather than working around it silently.
- If the failure is environmental (Codex's own runtime/sandbox configuration, not a repository defect), record it as-is — do not attempt to fix Codex's own runtime from inside this procedure.
- Either way, the qualification evidence you post to #3758 must show the failure and what was done about it, not just a final PASS with no record of the attempt.

## Completion

#3758 passes when every capability above is recorded PASS (or FAIL with a linked, merged remediation and a re-run PASS). Post the full evidence set on Issue #3758 and update its acceptance-criteria checklist. This evidence is a prerequisite for #3759 — do not begin #3759 until #3758 is closed.

## Recorded qualification evidence (#3758)

Qualification run date: 2026-08-26
Qualification runtime: Codex in the repository workspace sandbox
Qualification branch: `codex/3758-runtime-qualification-20260826t1748`

Evidence records:

### Repository identity and synchronization

- Capability: Repository identity and synchronization
- Command(s) run: `pwd`; `git rev-parse --show-toplevel`; `git remote get-url origin`; `git status -sb`; `git fetch origin main:refs/remotes/origin/main`; `git log -1 --format='%H %s' origin/main`
- Result: PASS
- Evidence: Repository resolved to `wdhunter465/next-starter-template`; isolated checkout was `/tmp/lgfc-3758`; the branch started from current `origin/main` and was clean before evidence changes; fetch succeeded.
- Remediation (if FAIL): not applicable

### GitHub authentication and repository permissions

- Capability: GitHub authentication and repository permissions
- Command(s) run: `gh auth status`; `gh api repos/wdhunter465/next-starter-template --jq '{full_name,permissions,default_branch}'`
- Result: PASS with degraded GraphQL probe
- Evidence: REST reported `admin`, `maintain`, `push`, `pull`, and `triage` permissions; HTTPS branch push succeeded. `gh auth status` identified the configured token and scopes, but its GraphQL probe reported the exhausted account rate limit.
- Remediation (if FAIL): use REST while the GraphQL quota is exhausted; rerun the GraphQL probe after quota recovery.

### Issue, PR, CI, and review-state visibility

- Capability: Issue, PR, CI, and review-state visibility
- Command(s) run: REST queries for Issue #3758, PR #3770, PR comments/reviews, branch state, and commit check runs.
- Result: PASS with degraded GraphQL surface
- Evidence: All required REST reads succeeded. GraphQL-backed `gh issue view`, `gh pr view`, and `gh pr checks` were unavailable while the account GraphQL quota was exhausted.
- Remediation (if FAIL): use the equivalent REST endpoints during GraphQL degradation and rerun the native commands after quota recovery.

### Branch creation and push

- Capability: Branch creation and push
- Command(s) run: `git checkout -b codex/3758-runtime-qualification-20260826t1748 origin/main`; `git push -u origin codex/3758-runtime-qualification-20260826t1748`
- Result: PASS
- Evidence: The unique branch was created from current `origin/main`, pushed, and configured with upstream tracking. Git emitted a sandbox credential-store lock warning, but the authenticated remote push completed.
- Remediation (if FAIL): not applicable

### PR creation and update

- Capability: PR creation and update
- Command(s) run: GitHub REST PR creation for branch `codex/3758-runtime-qualification-20260826t1748`; second evidence commit and `git push`; REST read of PR #3783.
- Result: PASS
- Evidence: PR #3783 was created against `main`; first evidence head was `95991d2f408fd81bc83607b776846bff15f91ed5`; the second commit updated the same PR; creation state was open and ready for review, not Draft.
- Remediation (if FAIL): not applicable

### Local validation

- Capability: Repository-required local validation
- Command(s) run: initial `npm ci`; remediated `npm ci --cache /tmp/lgfc-3758-npm-cache`; `npm run typecheck`; `npm run lint`; `npm test`
- Result: PASS after environmental cache remediation
- Evidence: The initial install failed because the home npm cache was read-only. The writable-cache rerun installed 777 packages; typecheck passed; lint passed with existing advisory warnings; 157 test files and 1,760 tests passed. The dependency audit reported 29 existing vulnerabilities.
- Remediation (if FAIL): the runbook now supplies a writable cache through `npm_config_cache="${TMPDIR:-/tmp}/lgfc-npm-cache"`.

### Repository skill loading

- Capability: `.agents/skills/*` guidance loading
- Command(s) run: `ls .agents/skills/`; `sed -n '1,20p' .agents/skills/lgfc-pr-governance/SKILL.md`
- Result: PASS
- Evidence: Enumerated `lgfc-cloudflare-static-export`, `lgfc-design-compliance`, `lgfc-docs-authority`, `lgfc-pr-governance`, and `lgfc-verification-closeout`; read the PR-governance skill successfully.
- Remediation (if FAIL): not applicable

### `run startup` behavior

- Capability: Local Codex startup orientation
- Command(s) run: A secondary diagnostic invoked `codex exec --ephemeral --sandbox read-only -C /tmp/lgfc-3758 'run startup'` from inside the already-managed session. The required acceptance test remains a genuinely fresh Codex terminal/session on the local Linux VM, with literal `run startup` as its first instruction and the complete response captured.
- Result: PENDING / FAIL-CLOSED
- Evidence: The nested diagnostic could not initialize its in-process app-server because the parent managed sandbox denied writes to the Codex product-state directory. The retrospective 16-point reconstruction below describes this session but is not accepted as the required fresh-session transcript.
- Remediation (if FAIL): Open a genuinely new Codex terminal/session on the same Linux VM, issue literal `run startup` as the first instruction, and append the complete response here. Do not use a nested Codex process inside an already-managed read-only product sandbox as the host-runtime acceptance test.

Retrospective startup reconstruction (context only; not acceptance evidence):

1. Product: Codex.
2. Standing roster state: Operations / Implementation first responder; assignable for other work under normal queue rules.
3. Runtime and environment: local Codex installation in a Linux VM hosted on a Chromebook.
4. Mode at startup: engineering orientation only.
5. Repository and checkout: `wdhunter465/next-starter-template`; qualification work isolated in `/tmp/lgfc-3758`.
6. Branch and working tree: assignment branch `codex/3758-runtime-qualification-20260826t1748`; clean before qualification evidence edits; branch repeatedly synchronized with `main` through the PR update-branch workflow.
7. GitHub access: authenticated HTTPS Git plus REST Issue, PR, review, check, branch, label, and workflow access; administrative/push/pull permissions verified. GraphQL was temporarily rate-limited, with equivalent REST evidence used where available.
8. Mandatory authority files read: `Agent.md`, `docs/governance/REPOSITORY-AUTHORITY.md`, `docs/governance/AGENT-TEAM.md`, `docs/ops/ai/SHARED-AGENT-RULES.md`, and `docs/ops/ai/CORE-RULES.md`.
9. Codex-specific rules loaded: `docs/ops/ai/CODEX-RULES.md`, including the corrected standing-executor contract from #3756/#3774.
10. Explicit source Issue: #3758.
11. Assignment/claim state: separately assigned by Product Authority and labeled `agent:codex`.
12. Bounded scope: Implementation / Operations qualification; allowed repository path `docs/how-to/codex/qualify-codex-runtime.md`; Model A / Promotion Candidate PR to `main`; acceptance criteria are the ten #3758 capability checks; independent approval and merge remain outside Codex authority; stop on missing authority, scope drift, protected-boundary conflict, or failed evidence.
13. No-source-Issue state: not applicable because #3758 was separately loaded before implementation.
14. Operational hold: no Production or repository-wide operational hold was supplied; GitHub platform degradation was recorded as evidence and handled through available REST surfaces.
15. Safe operating decision: orientation alone granted no implementation authority; work began only after #3758 and its one-file scope were loaded.
16. Stop point: startup orientation stopped before implementation; assignment execution followed as a separate phase.

### Overall result — PENDING ONE REQUIRED RERUN

Repository authentication, synchronization, Issue/PR/check/review visibility, branch creation and push, PR create/update, local validation, and repository skill loading are qualified. Startup behavior remains fail-closed until the literal fresh-session transcript is appended. No credential, review, merge, Production Go, or broader repository authority was expanded.
