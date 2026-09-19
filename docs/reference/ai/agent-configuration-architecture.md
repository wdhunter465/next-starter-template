---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Architecture, authority boundaries, directory layout, fail-closed rules, and ordered project map for program #3125
Does Not Own: Canonical governance policy, live Codex/WORK/Cursor/Claude routing, merge authority, Production authorization, or program/master closeout of #3125
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #3125, #3882, #3883, #3884, #3126, #3127, #3124, #3145, #3407
Last Reviewed: 2026-09-18
---

# Repository-hosted agent configuration architecture (#3125)

## Purpose

Define the machine-readable configuration layer that points at existing LGFC governance without replacing it. Configuration declares current operating facts for a named product. Governance remains the authority.

## Scope

This document owns the #3125 architecture, the Codex-only parallel-pilot boundary, fail-closed field rules, and the ordered project map. Child #3883 implements schemas and validation. Child #3884 records the rollout package. Nested project #3126 children #3127–#3133 are mapped onto those three program tasks; they are not a second implementation queue.

This document does not own Product Authority Go, independent review, Codex execution of Skeetersoft #3124, or general-team adoption.

## Current known truth

- Canonical authority remains `Agent.md` → `REPOSITORY-AUTHORITY.md` → `AGENT-TEAM.md` → `CORE-RULES.md` → product pointer → source Issue.
- `.agents/skills/` and `.agents/checks/` are technique and deterministic checks. They must not become a parallel constitution.
- No `.agents/configs/`, `.agents/schemas/`, or `.agents/pilots/` tree exists on `main` at starting SHA `05b678a8`.
- Codex is the isolated pilot consumer. WORK, Cursor, and Claude Code keep their current bootstrap until Bill accepts general rollout.
- Skeetersoft #3124 is the first bounded Codex execution candidate. It is Pipeline, allowlisted to `tools/skeetersoft/**`, and must not merge to `main` from this program.
- Distinct Codex GitHub identity remains open under #3407. Cursor must not impersonate Codex to generate #3132 pilot evidence.
- Configuration files cannot create role, approval, merge, or Production authority.

## Intended final state

Codex loads a versioned product configuration and an assignment envelope, validates them fail-closed, prints a compact acknowledgment, then executes only the authorized source Issue. Other products ignore the pilot tree until an accepted rollout. Preferred PMO order is advisory; enforceable stops use the #3134 HOLD contract.

## Design principle

Governance explains authority. Agent configuration declares current operating behavior. Project manifests declare team composition. Assignment envelopes authorize exact work. Issues record communication and decisions. PRs record implementation and review evidence.

## Existing authority inventory

| Surface | Role in this architecture |
| --- | --- |
| `Agent.md` | Mandatory navigation; not replaced |
| `docs/governance/REPOSITORY-AUTHORITY.md` | Constitution |
| `docs/governance/AGENT-TEAM.md` | Durable roles and member mapping |
| `docs/ops/ai/CORE-RULES.md` | Shared execution law and PRODUCT STARTUP FRAMEWORK |
| Product pointers (`CODEX-RULES.md`, `CURSOR-RULES.md`, …) | Additive product identity |
| Open source Issue | Task authority, allowlist, Go |
| `docs/templates/agent-assignment-template.md` | Human assignment envelope |
| `docs/reference/pmo/executable-child-contract.md` | Child-package completeness |
| `.agents/skills/*` | Technique only |
| `.agents/checks/*` | Deterministic repo checks |
| `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` | Event vocabulary |
| CI gates / `scripts/ci/*` | Machine-provable checks |
| `docs/reference/ai/openai-agentic-surface-inventory.md` | OpenAI surface inventory (#3815) |

Facts that stay in governance: precedence, roles, promotion, merge, Production, protected stops.

Facts that may live in configuration: product identity, config version, pointers to canonical paths, current role claim for this product, required envelope fields, pilot isolation flags.

## Precedence and conflict resolution

When sources conflict:

1. Locked Product / explicit Product Authority decisions
2. Repository constitution
3. Canonical domain policy
4. Open source Issue for the active task
5. Agent configuration and assignment envelope

A configuration that disagrees with (1)–(4) is invalid. The validator fails closed. It must not “fix” the conflict by granting extra authority.

## Directory layout

Reconcile with the existing `.agents/skills` and `.agents/checks` trees. Do not move those trees.

```text
.agents/
  skills/                 # existing technique skills — unchanged by this program
  checks/                 # existing deterministic checks — unchanged by this program
  schemas/                # JSON Schema for managed artifacts (#3883)
  configs/                # product configurations (Codex only during pilot)
  templates/              # envelope/manifest templates
  pilots/codex/           # Codex-only assignment packages
```

Validation implementation is planned for `scripts/ci/agent_config_validate.mjs` (introduced by #3883) so CI stays with other machine checks. Pilot CI must not fail WORK, Cursor, or Claude Code PRs that do not touch this tree.

## Manifest types

| Type | Owner file pattern | Required facts |
| --- | --- | --- |
| Agent product config | `.agents/configs/<product>.json` | product id, status, durable role pointer, authority-chain paths, version, pilotIsolation |
| Project manifest | optional under `pilots/` | parent issue, members, exclusions |
| Assignment envelope | `.agents/pilots/codex/<issue>.json` | source Issue, branch, starting SHA, mode, promotion profile, allowlist, reviewer, implementation Go, protected stops |
| Review packet | same envelope or sibling | independent reviewer identity, prohibition on self-approval |
| Handoff event | Issue comments using existing vocabulary | not a second comment protocol |

## Required envelope fields (fail closed)

An executable Codex assignment is invalid unless all of the following have real values:

- source Issue (open, same-repository, non-PR)
- durable role
- branch
- starting SHA
- exact file-touch allowlist
- independent reviewer (different from implementer)
- implementation Go recorded on the source Issue
- promotion profile
- protected-stop acknowledgment

Missing or `TODO`/`TBD` values fail closed. Implementer/reviewer identity collision fails closed. Authority-path references that do not exist in the repository fail closed. Fields that claim merge, Production, or standing role grants fail closed.

## Runtime load and acknowledgment (Codex pilot only)

After the shared PRODUCT STARTUP FRAMEWORK, Codex additionally:

1. Load `.agents/configs/codex.json` when present.
2. Load the assignment envelope for the claimed source Issue when present.
3. Run `scripts/ci/agent_config_validate.mjs`.
4. Print a compact acknowledgment:

```text
CONFIG ACK
product: codex
configVersion: <version>
sourceIssue: #<n>
role: <durable role>
branch: <name>
startingSha: <sha>
allowlist: <paths>
reviewer: <role or identity>
go: <recorded|missing>
validation: pass|fail
```

5. Stop before edits when validation fails.

Cursor, ChatGPT, Claude Code, and WORK must not load this tree as a bootstrap requirement during the pilot.

## Codex-only parallel pilot boundary

- Only Codex is routed through `.agents/configs/codex.json` and `.agents/pilots/codex/`.
- Cursor website and local bootstrap remain `AGENTS.md` / `.cursor/rules` / `CURSOR-RULES.md`.
- Claude Code remains `CLAUDE-CODE-RULES.md`.
- ChatGPT remains `CHATGPT-RULES.md`.
- Configuration cannot assign those products new roles.
- Rollback: delete or revert the `.agents/configs`, `.agents/schemas`, `.agents/pilots`, and validator files. No production runtime depends on them.

## Skeetersoft integration

#3131 / #3883 packages #3124 as:

- source Issue `#3124`
- branch `sandbox/skeetersoft-replay-ledger`
- allowlist `tools/skeetersoft/**`
- Sandbox / Pipeline promotion profile
- Codex implementer, Claude Code independent reviewer for work Claude Code did not implement
- WORK and Cursor excluded from that envelope

#3132 (Codex executes #3124) is not claimed by Cursor. HOLD contract:

- Affected scope: Codex execution and independent Claude Code pilot disposition of #3124
- Evidence: #3407 is still open; this session is Cursor, not Codex; #3124 remains Pipeline
- Why continuation as Cursor is unauthorized: program requires Codex as isolated pilot executor; impersonating Codex would falsify #3132 evidence
- Mitigation owner: Product Authority / Codex
- Release condition: distinct Codex identity (or recorded Bill exception) plus Bill implementation Go on #3124, then Codex execution and Claude Code `PILOT ACCEPT` | `PILOT REMEDIATE` | `PILOT HOLD`
- Parallel-safe work: #3882 architecture, #3883 schemas/validation/package, #3884 rollout definition
- Disputed-risk decision owner: Product Authority

## Ordered project map (#3125)

Preferred serial order is advisory (#3134). Collision-safe children may proceed in parallel from the same starting SHA.

| Task | Issue | Objective | Nested #3126 coverage | Successor |
| --- | --- | --- | --- | --- |
| #3125-001 | #3882 | Architecture and ordered map | #3127 design | #3883 |
| #3125-002 | #3883 | Schemas, Codex config, validation, #3124 package | #3129, #3130, #3131 | #3884 |
| #3125-003 | #3884 | Rollout package and recommendation | #3133 | Parent verification |

#3128 (Claude Code `APPROVE DESIGN`) is independent review of the #3882 PR, not a Cursor self-approval. #3132 remains the HOLD above. Program/master closeout of #3125 stays PMO / Engineering with independent verification and Bill’s rollout decision.

## Test and rollback

- Positive: valid Codex config + #3124 envelope passes.
- Negative: missing Issue, missing allowlist, implementer=reviewer, unknown authority path, `mergeAuthority: true`, routing Cursor through the Codex pilot config.
- Rollback is git revert of the #3883 tree. Pilot isolation means other agents need no runtime rollback.

## Communication

Use the existing event vocabulary in `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`. Do not invent a second handoff-comment protocol.
