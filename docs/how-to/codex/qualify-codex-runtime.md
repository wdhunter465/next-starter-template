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
2. `docs/governance/AGENT-TEAM.md`
3. `docs/ops/ai/SHARED-AGENT-RULES.md`
4. `docs/ops/ai/CORE-RULES.md`
5. `docs/ops/ai/CODEX-RULES.md`
6. This file
7. Issue #3758 itself

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

```bash
git checkout -b codex/3758-runtime-qualification origin/main
git push -u origin codex/3758-runtime-qualification
```

Expect: branch created from current `main`; push succeeds without requiring elevated permissions beyond what step 2 already confirmed.

### 6. PR creation/update capability

Make a trivial, reversible change inside this qualification's own scope (for example, appending your evidence block to this file under a `## Qualification evidence (#3758)` heading you add), then:

```bash
git add docs/how-to/codex/qualify-codex-runtime.md
git commit -m "docs(#3758): record runtime qualification evidence"
git push
gh pr create --repo wdhunter465/next-starter-template --base main --head codex/3758-runtime-qualification --title "docs(#3758): Codex runtime qualification evidence" --body "See Issue #3758."
```

Expect: PR opens successfully. This also produces a live PR for steps 4 (retroactively) and 7.

### 7. Local validation commands

Run the repository's standard local checks (same ones every implementer runs before marking a PR ready — see `docs/ops/ai/CORE-RULES.md`):

```bash
npm ci
npx tsc --noEmit
npm run lint
npx vitest run
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

- follow `docs/ops/ai/CODEX-RULES.md`'s 16-point startup report exactly (Product, standing roster state, runtime/environment, orientation-only mode, repo identity, branch/working-tree state, GitHub access, authority files read, Codex-specific rules loaded, supplied source Issue if any, assignment/claim state, bounded scope if loaded, no-source-Issue statement if not loaded, operational-hold state, safe operating decision, stop point);
- **stop** without beginning implementation, self-selecting work, editing files, or mutating any Issue/PR, unless a source Issue was separately supplied and grants that scope.

This is a pass/fail gate on its own: if startup does anything beyond orientation, or omits required report elements, mark this capability FAIL and describe exactly what happened.

## If something fails

- If the failure is a genuine repository bootstrap/runtime defect (for example, a missing script, a broken path reference, an incorrect permission requirement), open a small bounded fix PR under Issue #3758 (or a bounded child Issue if the fix is large enough to need its own scope) rather than working around it silently.
- If the failure is environmental (Codex's own runtime/sandbox configuration, not a repository defect), record it as-is — do not attempt to fix Codex's own runtime from inside this procedure.
- Either way, the qualification evidence you post to #3758 must show the failure and what was done about it, not just a final PASS with no record of the attempt.

## Completion

#3758 passes when every capability above is recorded PASS (or FAIL with a linked, merged remediation and a re-run PASS). Post the full evidence set on Issue #3758 and update its acceptance-criteria checklist. This evidence is a prerequisite for #3759 — do not begin #3759 until #3758 is closed.
