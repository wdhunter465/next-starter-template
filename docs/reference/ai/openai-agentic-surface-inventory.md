---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Inventory of OpenAI-consumed LGFC Agentic/bootstrap/startup/skill/config surfaces for Codex, ChatGPT, and retired OpenAI/Work
Does Not Own: Repository-wide governance policy, queue precedence, PR lifecycle, merge authority, or restoring OpenAI/Work as a live product
Canonical Reference: /Agent.md
Related Issues: #3815, #3755, #3825, #4074, #4052, #3808, #4091
Last Reviewed: 2026-09-18
---

# OpenAI Agentic surface inventory

## Purpose

Record every OpenAI-consumed Agentic/bootstrap/startup/skill/config surface that LGFC currently uses, including WORK retirement under #4074. This inventory is navigation evidence for #3815. It does not redefine shared governance.

## Shared routing

| Surface | Product(s) | Purpose | Authority | Canonical owner | Read timing | `run startup` | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | Any tool that auto-loads this filename, including Codex and Cursor Cloud | Product-neutral compatibility/router | Navigation only | This file → `Agent.md` | Session start | Yes, as router only | **Revised** #3815: no longer forces every product through `CURSOR-RULES.md` |
| `Agent.md` | All | Mandatory navigation chain | Navigation | `REPOSITORY-AUTHORITY.md` | Before any repo work | Yes | Retained; WORK pointer marked retired |
| `docs/governance/REPOSITORY-AUTHORITY.md` | All | Constitution / ownership | Domain policy | itself | Startup chain step 2 | Yes | Retained; out of #3815 edit scope |
| `docs/governance/AGENT-TEAM.md` | All | Durable roles and member mapping | Domain policy | itself | Startup chain step 3 | Yes | Retained; ChatGPT = Governance + PMO; Work removed |
| `docs/ops/ai/CORE-RULES.md` | All | Shared execution law and PRODUCT STARTUP FRAMEWORK | Operational rules | itself | Startup chain step 4 | Yes | Retained; WORK-RULES called retired |
| `docs/ops/ai/SHARED-AGENT-RULES.md` | Historical | Former shared-law index | — | Retired #4091 | Do not read as live | No | **Removed**; mapping in `docs/reference/DIATAXIS-MAPPING.md` |
| `.agents/skills/lgfc-pr-governance/SKILL.md` | All implementers | PR/issue/review/closeout technique | Skill | `PR_PROCESS.md` / `Agent.md` | When doing PR work | No, unless PR work is loaded | Retained; must not add approval gates |
| `.agents/skills/lgfc-docs-authority/SKILL.md` | All | Docs header/DIATAXIS technique | Skill | DOCUMENT-ARCHITECTURE | Task-selected | No | Retained |
| `.agents/skills/lgfc-design-compliance/SKILL.md` | All | Design-compliance technique | Skill | Production design standards | Task-selected | No | Retained |
| `.agents/skills/lgfc-verification-closeout/SKILL.md` | All | Verification/closeout technique | Skill | closeout protocol | Task-selected | No | Retained |
| `.agents/skills/lgfc-cloudflare-static-export/SKILL.md` | All | Static-export technique | Skill | Pages/export docs | Task-selected | No | Retained |
| `.github/pull_request_template.md` | All PR authors | Required PR body fields | Process template | `PR_PROCESS.md` | PR work | No | Retained |
| Generic/plugin skills (`~/.codex`, ChatGPT GPTs, vendor plugins) | Host/product local | Technique only | None over LGFC | Product vendor | Optional | No | Must not override LGFC authority or invent gates |

## Codex

| Surface | Purpose | Authority | Canonical owner | Read timing | `run startup` | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/ops/ai/CODEX-RULES.md` | Codex identity, startup, wake/continuity | Agent-specific additive | `AGENT-TEAM.md` | After shared chain | Yes | **Revised** #3815: wake/awareness contract |
| `docs/how-to/codex/qualify-codex-runtime.md` | Runtime qualification procedure | How-to | #3758 | Qualification tasks | No | Retained |
| `docs/how-to/codex/run-codex-end-to-end-qualification.md` | End-to-end qualification procedure | How-to | #3759 | Qualification tasks | No | Retained; parent #3755 closed |
| `.github/workflows/lgfc-codex-dispatch.yml` | Trusted GitHub → local Codex wake | CI / runner | `codex-local-dispatch-contract.md` | Event-driven | No | Retained (#4052); not the failed #3844 broad event surface |
| `scripts/lgfc-codex-dispatch/**` | Identifiers-only wrapper | CI / runner | same contract | On dispatch | No | Retained |
| `config/github-actions/codex-dispatch-runner.json` | Runner contract | Controlled config | same | Operator/CI | No | Retained |
| `docs/how-to/ci/configure-lgfc-codex-dispatch-runner.md` | Operator how-to | How-to | #4052 | Operator setup | No | Retained |
| `docs/reference/ci/codex-local-dispatch-contract.md` | Dispatch contract | Reference | #4052 | Design/review | No | Retained |
| `.github/workflows/lgfc-codex-runner-health.yml` | Missed-wake / runner health | CI | same | Scheduled/event | No | Retained |
| `PROMPTS/Codex-Launch-Prompt.md` / `PROMPTS/Codex-Rules.md` | Historical launch prompts | Not live authority | `CODEX-RULES.md` | Do not substitute for the chain | No | Historical; must not compete with `Agent.md` |
| Host `~/.codex` skills/config | Product-local | None over LGFC | Operator host | Product load | Documented limitation | Not in repo; must remain subordinate |

Codex mapped role after startup: Implementation / Operations first responder (`AGENT-TEAM.md`). Task execution remains Issue → allowlist → implement → test → PR → CI/reviewer remediation → submitting-agent exception ownership → independent-review handoff. No self-merge.

## ChatGPT

| Surface | Purpose | Authority | Canonical owner | Read timing | `run startup` | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/ops/ai/CHATGPT-RULES.md` | ChatGPT identity, Governance+PMO, continuity, concise default | Agent-specific additive | `AGENT-TEAM.md` | After shared chain | Yes | **Revised** #3815: concise default + live-GitHub continuity |
| `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` | ChatGPT↔Cursor handoff technique | Operational | Administration/comms | When handing off | No | Retained |
| ChatGPT product persistent instructions / Custom GPT | Product-local | None over LGFC | OpenAI product surface | Product load | Documented limitation | Repository cannot mutate external product config; encode required alignment in `CHATGPT-RULES.md` |

ChatGPT mapped roles after startup: Governance and PMO. Independent review only of work ChatGPT did not implement. ChatGPT must execute authorized repository mutations rather than acknowledgement-only responses, and must not ask Product Authority to perform routine work it can perform directly.

## WORK (retired)

| Surface | Purpose | Authority | Canonical owner | Read timing | `run startup` | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `docs/ops/ai/WORK-RULES.md` | Former Work operating rules | Historical only | `AGENT-TEAM.md` #4074 | Do not run | **No** | **Retired** 2026-09-14 |
| `docs/archive/WORK-CONTINUITY-LEDGER.md` | Former PMO conversational ledger | Historical only | #4074 | Do not resume from | **No** | **Retired**; ChatGPT does not load this as PMO resume |

Product Authority permanently removed OpenAI / Work from the LGFC Agentic Team on 2026-09-03 (#4074) for unreliable PMO/closeout performance. WORK AC on #3815 that required a live WORK startup, watcher/webhook PMO control plane, and continuity-ledger resume are **superseded by #4074**, not deferred to a follow-on Issue. Historical comments remain truthful records.

## Omission audit

Known #3815 comment requirements and disposition:

- ChatGPT/WORK concise default → encoded in `CHATGPT-RULES.md`. WORK has no live file to update.
- ChatGPT/WORK continuity after session reset → ChatGPT reloads the `Agent.md` chain and live GitHub; WORK ledger retired.
- Codex observation/polling/notification → Cursor-parity `lgfc-codex-dispatch` (#4052) plus `CODEX-RULES.md` wake/awareness; the #3844 `pull_request` / `workflow_run` surface remains rejected.
- `AGENTS.md` must not force Codex through Cursor → product-neutral router plus governance-check regression.
- Invalid OpenAI-consumed LGFC `SKILL.md` files → the five repository `.agents/skills/*/SKILL.md` files remain shared technique skills; none redefine queue/PR/merge authority.
- Fresh-session Codex/ChatGPT `run startup` proof inside this PR → not executable from Cursor Local for those products; the contracts above are the repository-side qualification. Runtime proof remains the existing Codex qualification how-tos (#3758/#3759, closed) and ChatGPT's next Product Authority `run startup`.
- Peer-comparison performance ledger as a standing metric store → out of file-touch scope; evidence lives on closed qualification Issues #3755–#3759 and dispatch #4052.

No additional OpenAI Agentic/startup follow-on Issue is opened. Remaining live-product gaps are contract enforcement on the files in this inventory, not missing surfaces.
