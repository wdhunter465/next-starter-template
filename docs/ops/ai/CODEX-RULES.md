---
Doc Type: Operational Rules
Audience: AI (Codex)
Authority Level: Agent-Specific
Owns: Codex selective-use status, Codex startup contract, and bounded source-Issue authorization rules
Does Not Own: Shared agent law, design authority, standing team roster policy, or merge approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3052, #3058, #3063, #3142
Last Reviewed: 2026-08-08
---

# CODEX-RULES.md

## Purpose

This document defines **Codex status** for LGFC repository work under the Product Authority selective-use model (#3142).

**Codex is not a standing LGFC implementation executor** and receives no implementation work by default.

**Codex is not denied repository access by governance.** Product Authority may selectively authorize Codex for a bounded source Issue. That source-Issue authorization is sufficient; no repository-wide or global Codex reactivation is required.

Canonical team roles and inventory: [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md).

Shared agent law: [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md).  
Detailed shared execution: [`CORE-RULES.md`](./CORE-RULES.md).  
Standing executors: [`CURSOR-RULES.md`](./CURSOR-RULES.md), [`CLAUDE-CODE-RULES.md`](./CLAUDE-CODE-RULES.md).

Historical prompt summary: [`PROMPTS/Codex-Rules.md`](../../../PROMPTS/Codex-Rules.md) (supporting reference only; this file and `AGENT-TEAM.md` win on conflict).

---

## Mandatory documentation chain

Before any repo work, follow the chain in [`Agent.md`](../../../Agent.md): `Agent.md` → [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) → [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md) → [`CORE-RULES.md`](./CORE-RULES.md) → this file → applicable repo governance/procedure docs → applicable `.agents/skills/*/SKILL.md` files → the explicitly supplied source Issue.

This file is additive. It does not replace shared/core rules or repo governance.

---

## Standing roster state

- Codex has **no standing implementation queue assignment**.
- Codex must **not** self-select LGFC work.
- Normal standing implementation routing remains Cursor Local and Claude Code per `AGENT-TEAM.md` and Team ownership (`team:operations`, `team:governance`, `team:pmo`, `team:engineering`).
- Automatic Codex PR review remains separately controlled by [`docs/reference/ci/codex-pr-review-disablement.md`](../../reference/ci/codex-pr-review-disablement.md) and is not a standing implementation assignment.

---

## Selective-use authority

Codex may perform a bounded task when Product Authority explicitly authorizes Codex in the source Issue (or in an authority record that the source Issue incorporates).

The bounded authorization must identify, as applicable:

- source Issue;
- assigned role/mode for that task;
- authorized repository actions;
- branch / target branch;
- exact file/action allowlist;
- promotion profile;
- acceptance criteria;
- required review / separation of duty;
- stop conditions.

That explicit bounded authorization is **sufficient**. It does **not** require:

- a repository-wide “Codex reactivation” event;
- restoring Codex to the standing team roster;
- a separate governance PR before the authorized task may proceed.

Selective Codex use does not change normal Team queues, standing Cursor/Claude routing, merge authority, builder/reviewer separation, Product/Production protections, or zero-incremental-cost constraints.

### Acceptance example

Issue `#3124` explicitly authorizes Codex for one Sandbox project, branch, allowlist, and stop-controlled workflow. Under this model, Codex must recognize that bounded authorization as valid without demanding global reactivation. The same authorization does not permit Codex to take unrelated LGFC implementation work.

---

## Default behavior without bounded authorization

If Codex receives ordinary LGFC implementation work **without** explicit Product Authority authorization in the source Issue, Codex must **stop before implementation** and report that **task-specific authorization is missing**.

The stop reason must be **missing task-specific authorization**, not a claim that Codex is categorically prohibited from LGFC repository use.

Report template when unauthorized:

```text
Codex is not a standing LGFC implementation executor (docs/governance/AGENT-TEAM.md, docs/ops/ai/CODEX-RULES.md, #3142).
This assignment lacks explicit Product Authority source-Issue authorization for Codex.
Stop reason: missing task-specific authorization.
Route ordinary unassigned LGFC implementation to Cursor Local or Claude Code per Team eligibility, or obtain a bounded Product Authority source-Issue authorization for Codex.
```

Do not edit files. Do not open PRs. Do not commit.

---

## Role boundaries (when authorized)

When authorized, Codex operates only as Implementation / Operations (or another role explicitly named in the source Issue) under ChatGPT/Work coordination and Bill approval boundaries.

Codex does not:

- define scope or acceptance criteria unless the source Issue assigns that role;
- author program or child issues unless explicitly authorized;
- replace Work design/launch-control authority;
- merge Pull Requests;
- override Bill gate authorization;
- self-approve protected work it implemented.

---

## Codex startup contract

Codex has a mandatory product-specific `run startup` procedure (#3052). **Startup is orientation only and grants no implementation authority.** Startup does not create, expand, or imply task authorization.

When Product Authority says `run startup` in Codex, Codex performs the shared skeleton in `docs/ops/ai/CORE-RULES.md`'s "PRODUCT STARTUP FRAMEWORK" section and reports at minimum:

1. Product: Codex.
2. Standing roster state: **not a standing executor** (no default queue assignment).
3. Runtime and environment identification.
4. Mode: engineering orientation only.
5. Repository and checkout identification.
6. Current branch and working-tree state.
7. GitHub access status.
8. Mandatory authority files read: `Agent.md`, `docs/governance/REPOSITORY-AUTHORITY.md`, `docs/governance/AGENT-TEAM.md`, `docs/ops/ai/CORE-RULES.md`.
9. Codex-specific rules loaded: this file.
10. Explicitly provided source Issue, if any.
11. Task-specific authorization state: **authorized** / **not authorized** according to whether the supplied source Issue explicitly authorizes Codex for a bounded assignment.
12. If authorized: exact bounded authority loaded (role, allowlist, branch/profile, acceptance, review, stop conditions).
13. If not authorized: file-touch allowlist state is not applicable — no implementation authority exists.
14. Operational-hold state limited to explicitly supplied work.
15. Safe operating decision: stop before any implementation step unless a separately loaded source Issue already provides bounded Codex authorization (startup still does not itself begin implementation).
16. Stop point.

Codex startup must not explore unrelated work, edit files, create branches, commit, push, open or modify a PR, mutate an Issue, or begin implementation. Startup and assignment loading remain separate phases.

After startup, when Product Authority (or an authorized handoff) supplies a source Issue that explicitly authorizes Codex, Codex must load that Issue and operate only within the granted role, scope, allowlist, profile, acceptance criteria, review requirements, and stop conditions.

---

## Stop conditions (Codex-specific)

Stop if:

- ordinary LGFC implementation work is directed to Codex without explicit Product Authority source-Issue authorization (missing task-specific authority);
- instructions ask Codex to self-select LGFC work or act as a standing queue executor;
- the source Issue’s allowlist, profile, or stop conditions are incomplete for the requested action;
- instructions conflict with shared law, `AGENT-TEAM.md`, or this selective-use model;
- required independent review / separation-of-duty would be violated by continuing.

Authorization ends with the bounded assignment. Completing or closing that assignment does not leave Codex as a standing executor.

---

## Final

Codex remains available for **selective, Product Authority–authorized, source-Issue-bounded** LGFC work. Without that authorization, Codex stops for **missing task-specific authority**. Shared law and human merge authority always apply when Codex is authorized.
