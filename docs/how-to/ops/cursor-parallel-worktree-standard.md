---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Git worktree setup, branch isolation, and session rules for multiple Cursor Local implementation sessions
Does Not Own: Merge authorization, GitHub issue creation, CI workflow changes, or program queue dispatch
Canonical Reference: /docs/ops/pmo/content-collection-parallel-execution-matrix.md
Related Issues: #2363, #2359, #2360, #4776
Last Reviewed: 2026-10-26
---

# Cursor Parallel Worktree Operating Standard

## Purpose

Define how multiple Cursor Local sessions may operate without conflicting file changes, branch confusion, or PR queue overload during Content Collection parallel lanes.

## Scope

Owns worktree setup, session start checklist, allowlist execution, collision halt, and review throttle for parallel Cursor Local sessions.

Does not own merge authorization, GitHub issue creation, CI workflow changes, or program queue dispatch.

## Current known truth

- One task → one branch → one worktree → one PR unless Product Authority authorizes bundling.
- Docs-only child issues use `cursor/<issue>-<task>-2e48` branch names (for example `cursor/2363-control-ops-docs-2e48`).
- Implementation lanes may use descriptive lane branches only when the source issue explicitly assigns them.
- Hot zones and allowlists are defined in `docs/ops/pmo/content-collection-parallel-execution-matrix.md`.

## Intended final state

Every parallel session can identify its issue, branch, worktree, allowlist, halt rules, and validation plan before editing files.

## Procedure

### Step 1 — Confirm task authorization

Before creating a worktree, verify on the source GitHub issue:

| Field | Required |
| --- | --- |
| Source issue number | Yes |
| Package path | Yes |
| File allowlist | Yes |
| Hot-zone review | Yes — see parallel execution matrix |
| Freeze marker | When lane depends on CC-001/CC-002 |
| Validation plan | Yes |
| Product Authority execution authorization | Yes |

Stop if any field is missing. Post `CHATGPT HANDOFF` on the issue.

### Step 2 — Create an isolated worktree

```bash
git fetch origin main
git worktree add ../lgfc-2363-control-ops -b cursor/2363-control-ops-docs-2e48 origin/main
cd ../lgfc-2363-control-ops
```

One git worktree per Cursor Local session. Do not run multiple Cursor sessions in one shared working tree.

Branch naming:

| Task type | Pattern | Example |
| --- | --- | --- |
| Docs-only child issue | `cursor/<issue>-<task>-2e48` | `cursor/2363-control-ops-docs-2e48` |
| Implementation lane (issue-assigned) | `cursor/<lane>-<surface>` | Only when source issue assigns the lane branch |

Do not use lane-style branch names for docs-only issues.

### Step 3 — Session start checklist

- [ ] Task issue exists
- [ ] Package doc path exists on `main`
- [ ] File allowlist copied into issue
- [ ] Hot zones reviewed against open PRs
- [ ] Freeze marker satisfied (if applicable)
- [ ] Branch/worktree isolated
- [ ] No open PR touches `halt_if_open_pr_touches` paths

### Step 4 — Execute within allowlist

1. Edit only allowlisted paths.
2. One task → one PR unless Product Authority authorizes bundling.
3. Keep PR draft until local validation passes.

### Step 5 — Collision halt

Pause when an open PR touches halt-listed or hot-zone paths, shared contracts change after dependents start, or a lane exceeds its allowlist.

### Step 6 — Review throttle

Maximum **READY FOR REVIEW** PRs: **2–3**. Additional work stays draft until review capacity exists.

## Parallel authorization summary

| Ceiling | Value |
| --- | --- |
| Default | 3 Cursor Local sessions |
| Exceptional | 4 with disjoint allowlists |
| Not authorized | 6 full implementation sessions at launch |

After `CONTRACT-FROZEN: content-asset-model v1`: Gallery, Library, and Memorabilia may run in parallel with isolated scopes.

## Prohibited behavior

- Two sessions editing the same files in one worktree
- One branch for multiple unrelated tasks
- Mixed-intent PRs across lanes
- Feature code before CC-001/CC-002 freeze
- Unauthorized CI workflow edits during feature lanes

## Stop rule

Stop and post `CHATGPT HANDOFF` when allowlists overlap, hot-zone collisions are unresolved, or steps conflict with `Agent.md` and PR lifecycle gates.

## Related documents

- `docs/ops/pmo/content-collection-parallel-execution-matrix.md`
- `docs/ops/pmo/parallel-agent-rules.md`
- `docs/ops/pmo/content-collection-launch-readiness-checklist.md`
