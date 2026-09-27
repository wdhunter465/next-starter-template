---
Doc Type: Reference
Audience: Human + AI
Authority Level: Informational
Owns: Per-file disposition of the remaining legacy-to-Diátaxis paths owned by #3155
Does Not Own: Entry-chain consolidation, continuous stewardship, document-asset registry, or non-migration product implementation
Canonical Reference: /docs/reference/DIATAXIS-MAPPING.md
Related Issues: #3155, #1132, #2823
Last Reviewed: 2026-09-27
---

# Legacy-to-Diátaxis disposition map

## Purpose

This is the #3155 package-1 inventory. It replaces active execution routing that still says Program 3 or closed #1132. Historical mapping rows stay in `docs/reference/DIATAXIS-MAPPING.md` with their original status words.

No row here authorizes a deploy, a new policy owner, or closure of #3155.

Every legacy file a package moves or archives receives the canonical documentation header in that same change: Doc Type, Audience, Authority Level, Owns, Does Not Own, Canonical Reference, and Last Reviewed. Archived files use an archived Doc Type and Authority Level Historical, following `docs/archive/reference/orchestration/startup-governance.md`. Files that already have a header keep it, and the package corrects a live authority claim to Historical when the file is archived. `PROMPTS/` has no header today. The two superseded root files already have a header, and it still says Operational.

## Scope

In scope: the per-file disposition of the remaining legacy roots and `docs/ops/ai/` files owned by #3155.
Out of scope: entry-chain consolidation, a document-asset registry, deploy authorization, and non-migration product work.

## Current known truth

- This file is the package-1 inventory. It does not close #3155.
- The three `PROMPTS/` files and the two superseded root files are the archive-now rows. That archive is open in #4398.
- `AI-GUIDE.md`, the recovery-era plan, and the stale ChatGPT sentence in `WORK-RULES.md` stay for a later package.
- `COPILOT-RULES.md` and `DEVIN-RULES.md` stay until Product records a retirement.

## Intended final state

Each remaining legacy file is archived, retained, or corrected according to the table below, with the canonical documentation header applied in the same change. #3155 closes only after that required migration work is accepted and every residual #1132 obligation is evidenced complete or explicitly owned.

## Obligation reconciliation

#1132 transferred these obligations. Predecessor closure is not completion evidence.

| #1132 obligation | Disposition | Owner |
| --- | --- | --- |
| Documentation inventory | Phase 1 root mapping exists in `DIATAXIS-MAPPING.md`. This file is the remaining per-file inventory for live legacy roots and `docs/ops/ai/`. | #3155 package 1 |
| Gap analysis | PR #1146 / the #1132 migration matrix is planning evidence, not acceptance proof. | #3155, historical |
| Fan Club design package | Non-migration production definition. Not a file move. No sole current owner was verified in this pass. | Needs Product routing; not implemented here |
| Admin design package | Same as Fan Club. | Needs Product routing; not implemented here |
| Content Collection design package | Same as Fan Club. Open review #4374 is a later rights-intake design, not this obligation. | Needs Product routing; not implemented here |
| CI Orchestration design package | CI strategy reconciliation is #4089, closed. Documentation references stay coordinated with that record. | #4089 consumed; #3155 does not reopen it |
| DIATAXIS migration package | Remaining moves are the packages below. | #3155 |
| Legacy retirement package | Manifest rows land in the same PR as each retirement. | #3155 |
| Implementation plans | Historical plans stay historical. Recovery-era plan disposition is in the per-file table. | #3155 package later |
| Agent-consumable task decomposition | The recorded packages below are the decomposition. They are not new Issues. | #3155 |

## Overlap owners

| Issue | Record | Meaning |
| --- | --- | --- |
| #1019, #1021, #1022, #1023, #1024, #1031, #1033, #1076, #1078 | Closed; requirements transferred 2026-09-04 | Consumed as obligation transfer, not as proof the work is done |
| #1039 | Open | Retained external owner for continuous stewardship. Not superseded |
| #2087, #2217 | Open | Retained external owners for monitored assets and any registry. This map does not add a registry |
| #2794 | Open | Retained owner of entry-chain consolidation into `AGENTS.md` |
| #2823 | Closed | Consumed evidence: the two root files below are already superseded |
| #3074 | Closed | Consumed evidence for website design / as-built reconciliation, not for the Fan Club, Admin, or Content Collection packages |
| #4089 | Closed | Consumed CI-strategy owner |

## Per-file dispositions

Action words: migrate, rewrite, route, retain, archive, delete.

| Source path | Content type | Canonical owner | State | Action | Reason | Owner | Dependency | Validation | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ops/ai/CROSS-AGENT-OPERATING-RULES.md` | Prior operating guidance | `Agent.md` authority chain, then `docs/ops/ai/CORE-RULES.md` | Superseded #2823; header still says Operational | archive | Do not copy it into `docs/ops/ai/`. Set the archived header to Historical. | #3155 package 3 | Update `.agents/checks/agent-governance-check.mjs` and the `Agent.md` historical citation in the same PR | Header is Historical; check still requires the superseded marker | Revert the PR |
| `governance/ai/AGENT-GOVERNANCE.md` | Prior governance rules | `docs/governance/AGENT-TEAM.md` and `docs/governance/REPOSITORY-AUTHORITY.md` | Superseded #2823; header still says Operational | archive | Do not author `docs/governance/standards/agent-governance.md`. Set the archived header to Historical. | #3155 package 3 | Same check and citation update | Header is Historical; check still requires the superseded marker | Revert the PR |
| `PROMPTS/Cursor-Rules.md` | Stale prompt | `docs/ops/ai/CURSOR-RULES.md` | Live; no header; contradicts current roles | archive | Says ChatGPT is the planner and Cursor must not open PRs. Add the canonical header on archive. | #3155 package 2 | Remove `PROMPTS/` from intent allowlists in the same PR | Header present; no required-file check loads `PROMPTS/` | Revert the PR |
| `PROMPTS/Cursor-Launch-Prompt.md` | Stale prompt | `docs/how-to/cursor/run-program-task.md` | Live; no header | archive | Launch behavior already has a how-to. Add the canonical header on archive. | #3155 package 2 | Same allowlist removal | Header present | Revert the PR |
| `PROMPTS/PR-as-ticket-template.md` | Stale template | `docs/templates/agent-assignment-template.md` | Live; no header; names retired Codex execution | archive | Current assignment template already exists. Add the canonical header on archive. | #3155 package 2 | Same allowlist removal | Header present | Revert the PR |
| `docs/governance/ai/AI-GUIDE.md` | Historical build prompt | Design standards named by `Agent.md` | Live; header still says Canonical | archive later | It is not agent routing authority. Archive only after a consumer check. | #3155 later package | Consumer check before the move | Not this package | — |
| `docs/ops/trackers/LGFC-REPO-RECOVERY-AND-IMPLEMENTATION_PLAN.md` | Recovery-era plan | Current ops trackers that are still live | Live | archive later | Archive only after the reference check. | #3155 later package | Reference check | Not this package | — |
| `docs/ops/ai/CORE-RULES.md` | Shared execution rules | This path | Current | retain | Detailed execution law. Not a legacy root. | Existing path | None | Header already present | — |
| `docs/ops/ai/CURSOR-RULES.md` | Agent-specific rules | `docs/governance/AGENT-TEAM.md` for role | Current | retain | Cursor product rules. Role state stays in `AGENT-TEAM.md`. | Existing path | None | — | — |
| `docs/ops/ai/CLAUDE-CODE-RULES.md` | Agent-specific rules | `docs/governance/AGENT-TEAM.md` for role | Current | retain | Claude Code product rules. | Existing path | None | — | — |
| `docs/ops/ai/CHATGPT-RULES.md` | Retired pointer | `docs/governance/AGENT-TEAM.md` | Retired #4173 | retain | Bootstrap/history pointer. Not live policy. | Existing path | None | — | — |
| `docs/ops/ai/CODEX-RULES.md` | Retired pointer | `docs/governance/AGENT-TEAM.md` | Retired #4165 | retain | The governance check still requires this path. | Existing path | Do not delete while the check requires it | — | — |
| `docs/ops/ai/WORK-RULES.md` | Retired pointer | `docs/governance/AGENT-TEAM.md` | Retired #4074 | retain | Body still says ChatGPT is permanent PMO. That sentence is stale. Correct it in a later hygiene package; do not treat the body as current. | #3155 later hygiene | None for this map | — | — |
| `docs/ops/ai/COPILOT-RULES.md` | Agent-specific rules | `docs/governance/AGENT-TEAM.md` | Path retained; not in the current role table | retain | No Product retirement record was verified here. Do not treat the file as a live role. | Later Product disposition | None | — | — |
| `docs/ops/ai/DEVIN-RULES.md` | Agent-specific rules | `docs/governance/AGENT-TEAM.md` | Path retained; not in the current role table | retain | Same as Copilot. | Later Product disposition | None | — | — |
| `docs/ops/ai/AI-REVIEW-ACCESS.md` | Operator reference | This path | Current | retain | Review-access configuration. ChatGPT wording is later hygiene, not a move. | Existing path | None | — | — |
| `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` | Procedure | `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md` | Current procedure; ChatGPT in the title | retain | Keep the procedure. Title hygiene is later. It does not create role authority. | Existing path | None | — | — |
| `docs/ops/ai/.gitkeep` | Placeholder | — | Empty | retain | Not a document. | Existing path | None | — | — |
| `docs/ops/trackers/LGFC-WEBSITE-IMPLEMENTATION-QUEUE-NORMALIZATION.md` | Tracker | `docs/reference/website/lgfc-website-as-built-reconciliation.md` | Routed | retain | Tracker stays readable. Ops truth stays in the as-built reconciliation. | Existing path | None | — | — |
| `docs/reference/lgfc-implementation-coverage-map.md` | Reference | This path | Routed | retain | Reference only. Not the ops queue. | Existing path | None | — | — |
| `docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md` | Operations tracker | This path | Current | retain | Master worklist. | Existing path | None | — | — |
| `docs/ops/trackers/THREAD-LOG_Master.md` | Historical log | This path | Current path | retain | Thread log. | Existing path | None | — | — |

Files already under `docs/tutorials/`, `docs/how-to/`, `docs/reference/`, `docs/explanation/`, `docs/governance/`, and `docs/ops/` that are not listed above stay in place. Governance and ops are approved folders. This map does not count them as defects.

## Recorded packages

Starting SHA for this record: `e7f4e11c161ec36838b3b8779b5a68ab79d9f56f`. Delivery model A. Reviewer is Product Authority. Rollback is revert of that package PR. None of these packages close #3155.

Package 1 is this file plus the active-owner pointer in `docs/reference/DIATAXIS-MAPPING.md`.

Package 2 archives the three `PROMPTS/` files, adds the canonical header to each archived file, appends manifest rows, and removes `PROMPTS/` from the intent allowlists.

Package 3 archives the two superseded root files, changes their headers from Operational to Historical, points the governance check and the `Agent.md` historical citations at the archive paths, and does not change the mandatory authority chain. Entry-chain consolidation stays with #2794.

## What this map does not do

It does not create `docs/governance/standards/agent-governance.md`. It does not move binding policy into `docs/ops/ai/`. It does not edit the mandatory authority chain. It does not add attestation or a document registry. It does not archive `AI-GUIDE.md` or the recovery-era plan until their consumer checks are done.
