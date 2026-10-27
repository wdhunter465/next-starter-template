---
Doc Type: Operations Report
Audience: Bill, Atlas, Cursor, LGFC maintainers, and reviewers
Authority Level: Evidence
Owns: Task #2563 reconciliation evidence for the PR-governance skill documentation chain
Does Not Own: Canonical agent-team policy, PR policy, approval authority, or future workflow changes
Canonical Reference: /Agent.md
Related Issues: #1719, #2528, #2563
Last Reviewed: 2026-07-17
---

# PR governance skill chain reconciliation — Program #1719

## Purpose

Record the authority-chain correction completed by Task #2563 so `.agents/skills/lgfc-pr-governance/SKILL.md` follows the current routing in `Agent.md` without becoming an independent or conflicting authority source.

## Scope

This report covers reconciliation among:

- `Agent.md`;
- `docs/governance/AGENT-TEAM.md`;
- `docs/ops/ai/SHARED-AGENT-RULES.md`;
- `docs/ops/ai/CORE-RULES.md`;
- `docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md` as superseded historical context;
- `.agents/skills/lgfc-pr-governance/SKILL.md`;
- the Task #2563 acceptance criteria.

No workflow, runtime, PR-template, lifecycle-policy, branch-protection, or production behavior was changed.

## Current known truth

`Agent.md` is the mandatory entry point and currently routes agents through canonical `docs/governance/AGENT-TEAM.md` before the retained shared-rules pointer, detailed `CORE-RULES.md`, additive agent-specific pointers, applicable governance/procedure documents, and task-triggered skills.

`docs/governance/AGENT-TEAM.md` and the historical operating-model file both state that `docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md` is superseded for current team policy, approval routing, and protected stops. The prior PR-governance skill chain omitted `AGENT-TEAM.md` and did not explicitly prevent the superseded operating model from being treated as active authority.

## Intended final state

The PR-governance skill mirrors the current chain in `Agent.md`, remains explicitly subordinate to that routing authority, and directs agents to canonical team policy without reviving superseded documents. This report remains evidence of the bounded reconciliation and does not independently define policy.

## Authority conflict and resolution

The original Task #2563 wording expected the older AI team operating model to appear as an active layer before shared and core rules. Current repository authority no longer supports that sequence:

- `Agent.md` names `docs/governance/AGENT-TEAM.md` as the canonical team-policy layer immediately after the entry point.
- `docs/governance/AGENT-TEAM.md` explicitly supersedes `docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md` for team roles, approval routing, and protected stops.
- The superseded operating-model file identifies itself as historical context and routes current authority back to `AGENT-TEAM.md`.

Documented precedence therefore resolves the conflict without a protected stop: the skill must follow the current `Agent.md` chain and must not restore the superseded operating model as active authority.

## Before and after

| Position | Prior skill chain | Reconciled skill chain |
| --- | --- | --- |
| Entry | `Agent.md` | `Agent.md` as mandatory routing authority |
| Team policy | Omitted | `docs/governance/AGENT-TEAM.md` |
| Shared pointer | `SHARED-AGENT-RULES.md` | Retained and identified as a superseded pointer |
| Shared execution detail | `CORE-RULES.md` | Retained as detailed shared execution authority |
| Tool behavior | Applicable agent-specific rules | Retained as additive pointers only |
| Governance and procedures | Compressed into a partial list | Current source issue, task-linked authority, PR skill, PR template, lifecycle document, and other applicable governance |
| Additional skills | Not explicit | Additional task-triggered `.agents/skills/*/SKILL.md` files |
| Superseded operating model | Not addressed | Explicitly excluded as an active authority layer |

## Reconciled contract

The PR-governance skill now states that:

- it is subordinate to `Agent.md`;
- it cannot replace, abbreviate, or redefine the mandatory documentation chain;
- canonical `AGENT-TEAM.md` precedes shared and core execution rules;
- agent-specific files are additive only;
- repository governance and task-triggered skills remain required when applicable;
- the superseded AI team operating model must not be restored as current routing authority.

## Scope protection

Task #2563 changes only the documentation-chain section of the PR-governance skill. Existing PR procedure, PR-body field, lifecycle, and stop-condition text was intentionally left unchanged because broader PR-policy reconciliation is outside this task's allowlist and acceptance criteria.

## Acceptance-criteria disposition

- Chain starts with `Agent.md` and includes canonical `AGENT-TEAM.md`: **pass**.
- Chain matches current `Agent.md` routing without omitting governance or skill layers: **pass**.
- Skill states that it is subordinate to `Agent.md`: **pass**.
- Superseded operating model is not restored as active authority: **pass**.
- No unrelated PR-governance policy changed: **pass**.
- Reconciliation evidence is recorded here: **pass**.

## Validation plan

Required validation for the Task #2563 PR:

- agent-governance validation for the changed skill;
- documentation header and path validation for this report;
- manual comparison against the mandatory chain in `Agent.md`;
- changed-path allowlist review;
- `git diff --check` or equivalent whitespace inspection;
- repository CI and documentation checks on the PR head.

## Result

Task #2563 is implementation-complete on its working branch and ready for PR-based validation against `component/pmo-governance-workflow-automation`.
