---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Broader agent-team rollout package and evidence-based recommendation for program #3125
Does Not Own: Bill’s rollout decision, live routing of WORK/Cursor/Claude Code, Codex execution of #3124, or program/master closeout of #3125
Canonical Reference: /docs/reference/ai/agent-configuration-architecture.md
Related Issues: #3125, #3884, #3883, #3882, #3126, #3133, #3124, #3145, #3132, #3407
Last Reviewed: 2026-09-18
---

# Agent-configuration rollout package (#3125-003)

## Purpose

Define the package required to extend, revise, or reject the repository-hosted agent configuration framework after the Codex-only pilot. Bill retains the final rollout decision.

## Scope

This package covers proposed product configurations, a phased plan that does not interrupt website delivery, documentation consolidation, CI expansion, and a program-level recommendation. It does not turn on WORK, Cursor, or Claude Code routing.

## Current known truth

- Architecture is defined under #3882.
- Codex schemas, validator, product config, and the #3124 envelope are implemented under #3883.
- The #3124 envelope is package-valid and **not executable** until Bill records implementation Go (`implementationGo: required-on-source-issue`).
- Codex has not executed #3124 through this stack in this delivery. Cursor must not impersonate Codex (#3407 still open).
- Therefore this package does **not** contain measured before/after Codex adherence metrics from a completed #3132 run.

## Intended final state

After Codex completes #3132 and Claude Code records `PILOT ACCEPT`, `PILOT REMEDIATE`, or `PILOT HOLD`, Product Authority accepts or rejects general rollout. Accepted controls then gain product configs for the remaining team without copying governance.

## Pilot findings available now

| Question | Evidence now | Gap |
| --- | --- | --- |
| Fail-closed missing Issue / allowlist / reviewer | Validator unit tests in #3883 | No live Codex session evidence |
| Implementer/reviewer collision | Validator unit tests | No live review of a Codex PR produced through the stack |
| Authority-path drift | Validator checks files exist | Does not parse superseded-document tables |
| Isolation of Cursor/WORK/Claude | Codex config excludes those products; tests reject routing Cursor | Website lanes unchanged by this program |
| Friction / false positives | Not measured | Requires #3132 |
| CI reliability | Validator is a unit test, not a required workflow on unrelated PRs | Optional expansion after acceptance |

Accepted remediation before any generalize step:

1. Keep `implementationGo: required-on-source-issue` until Bill records Go on the source Issue.
2. Do not add Cursor/Claude/ChatGPT product configs until #3132 has a terminal disposition.
3. Close or explicitly except #3407 before treating Codex GitHub attribution as solved.

## Proposed product configurations (not live)

These are names and pointers only. They must not be loaded by those products until Bill accepts rollout.

| Product | Proposed config path | Authority pointer | Isolation until Go |
| --- | --- | --- | --- |
| Codex | `.agents/configs/codex.json` | `CODEX-RULES.md` | Live pilot only |
| Cursor Local | `.agents/configs/cursor-local.json` | `CURSOR-RULES.md` | Not created |
| Cursor Cloud | `.agents/configs/cursor-cloud.json` | `CURSOR-RULES.md` / `AGENTS.md` | Not created |
| Claude Code | `.agents/configs/claude-code.json` | `CLAUDE-CODE-RULES.md` | Not created |
| ChatGPT / PMO | `.agents/configs/chatgpt.json` | `CHATGPT-RULES.md` | Not created |
| Deterministic CI | no product config | existing workflows | Checks stay path-scoped |

Each future config must repeat: cannot grant merge, Production, standing role, or self-approval; authority chain points at existing docs; assignment envelopes remain Issue-scoped.

## Phased rollout plan

1. **Pilot (current):** Codex only. Website lanes untouched.
2. **Pilot execution:** Codex runs #3124 under the envelope after Bill Go. Claude Code independent review.
3. **Decision:** Bill records GENERALIZE, REVISE AND RE-PILOT, or RETIRE FRAMEWORK.
4. **If GENERALIZE:** add one product config per accepted agent, still fail-closed, still Issue-scoped. Do not interrupt Active website children.
5. **CI expansion:** path-filtered validation for `.agents/configs/**` and `.agents/pilots/**` only. Do not make the check a default blocker for unrelated PRs.
6. **Docs consolidation:** point product rule files at the config load step; do not duplicate CORE-RULES.

Rollback at every phase is git revert of the config tree. No production service depends on it.

## Documentation consolidation plan

- Keep `Agent.md` as navigation.
- Keep product pointers additive.
- Add a single load step in `CODEX-RULES.md` only after #3883 merges: validate `.agents/configs/codex.json` when present.
- Do not add the load step to Cursor or Claude Code during the pilot.
- Skills remain technique-only.

## CI expansion plan

- Today: `tests/agent-config-validate.test.mjs` via ordinary quality tests on PRs that change the stack.
- Next: optional path filter so only `.agents/configs|schemas|pilots` and `scripts/ci/agent_config_validate.mjs` invoke the validator.
- Never fail WORK/Cursor/Claude website PRs that do not touch the pilot tree.

## Program acceptance recommendation

Required disposition vocabulary: `GENERALIZE` | `REVISE AND RE-PILOT` | `RETIRE FRAMEWORK`.

**Recommendation: do not GENERALIZE and do not RETIRE.** Record **REVISE AND RE-PILOT** only if #3132 finds material defects. With the stack implemented and the Codex/#3124 run still pending, the honest program packet is:

```text
DISPOSITION: HOLD GENERALIZE
Pending: #3132 Codex execution of #3124 and Claude Code pilot disposition
Bill decision: not recorded
Website continuity: protected (no WORK/Cursor/Claude routing change)
```

This is not Product Authority acceptance. #3125 remains open until that decision and independent project/master closeout exist.

## HOLD contract for authorization

- Affected scope: general-team rollout and program/master closeout of #3125
- Evidence: no #3132 terminal disposition; #3407 open; envelope Go is `required-on-source-issue`
- Why continuation of GENERALIZE is unauthorized: program acceptance requires Codex pilot evidence and Bill’s decision
- Mitigation owner: Product Authority / Codex / Claude Code
- Release condition: #3132 disposition plus Bill GENERALIZE | REVISE AND RE-PILOT | RETIRE FRAMEWORK
- Parallel-safe work: architecture and validator already packaged; website Active work continues
- Disputed-risk decision owner: Product Authority
