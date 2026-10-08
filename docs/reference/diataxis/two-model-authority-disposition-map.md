---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Authority disposition inventory for Delivery System v1 Task 2 (#2486) touched documents, related agent-policy routing, and the #4138 undecided folder inventory
Does Not Own: Domain policy content, constitutional precedence, implementation behavior, or the file moves named for later children
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2477, #2486, #2478, #2686, #2687, #2688, #2689, #2690, #4138, #4196, #4199, #4480
Last Reviewed: 2026-10-08
---

# Two-Model Authority Disposition Map

## Purpose

Record the authority disposition for every canonical document touched by issue #2486 and the related agent-policy placement conflict. No document may be moved or archived until its row is complete and references are updated.

## Disposition actions

| Action | Meaning |
| --- | --- |
| retain | Keep path; update content and references only |
| consolidate | Merge into another canonical path; supersede source |
| migrate | Move content to a new canonical path in a later child issue |
| archive | Move to `docs/archive/**` when historical retention is required |
| supersede | Mark inactive; remove active routing in touched set |

## Touched documents (#2486 allowlist)

| Current path | Current owner | Target owner | Action | Replacement / notes | Reference-update scope |
| --- | --- | --- | --- | --- | --- |
| `docs/governance/REPOSITORY-AUTHORITY.md` | — | Constitution (Layer 0) | retain (new) | This file is the new constitution | `Agent.md`, architecture docs, inventory map |
| `docs/governance/standards/document-authority-hierarchy_MASTER.md` | Governance | Documentation and Knowledge | supersede | Competing canonical precedence removed; file is a superseded pointer to `REPOSITORY-AUTHORITY.md` until archived | Self, `DOCUMENT-ARCHITECTURE.md` |
| `docs/governance/DOCUMENT-ARCHITECTURE.md` | Governance | Documentation and Knowledge | retain | Reconcile `docs/ops/ai/` binding-policy claim with DIATAXIS ops prohibition | All paths citing ops/ai as binding policy owner |
| `docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md` | Documentation and Knowledge | Documentation and Knowledge | retain | Align ops prohibition with agent routing table in constitution | `DOCUMENT-ARCHITECTURE.md`, resolution doc |
| `docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md` | Documentation and Knowledge | Documentation and Knowledge | retain | Add constitution precedence above resolution rules | Inventory map, architecture |
| `docs/reference/diataxis/authority-inventory-and-routing-map.md` | Documentation and Knowledge | Documentation and Knowledge | retain | Point Layer 0 to `REPOSITORY-AUTHORITY.md` | Intro and authority layers section |

## Agent-policy placement conflict (cross-cutting)

Binding material currently under `docs/ops/ai/` conflicts with DIATAXIS ops folder rules (`ops/` prohibited: authority, system definitions).

| Current path | Current owner | Target owner | Action | Replacement / notes | Program child |
| --- | --- | --- | --- | --- | --- |
| `docs/ops/ai/SHARED-AGENT-RULES.md` | ops/ai (incorrect for binding policy) | Agent Team governance | migrate | File is absent. Live role policy is already `docs/governance/AGENT-TEAM.md` | Task 4 #4198 |
| `docs/ops/ai/CORE-RULES.md` | ops/ai | Agent Team governance | migrated | Canonical text is `docs/governance/AGENT-EXECUTION.md`. This path is a compatibility pointer (#4198) | Task 4 #4198 |
| `docs/ops/ai/CURSOR-RULES.md` | ops/ai | Agent Team governance + reference | migrated | Role mapping is `docs/governance/AGENT-TEAM.md`. This file keeps Cursor execution discipline only | Task 4 #4198 |
| `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` | Operations | Operations (procedure) | retain | Procedure stays under ops; constitution links as related | — |
| `docs/how-to/cursor/github-poll-wake-loop.md` | Operations procedure | Operations procedure | retain | Local runtime procedure; linked from runtime routing standard | — |
| `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` | Agent Team governance | Agent Team governance | retain | Already in correct layer from #2489 | — |

`docs/ops/ai/CORE-RULES.md` is no longer binding policy (#4198). Shared execution law is `docs/governance/AGENT-EXECUTION.md`. New binding policy must not be added under `docs/ops/ai/`. Retired product files stay historical and are not live policy.

## Domain policy disposition

| Domain | Canonical policy path | Disposition |
| --- | --- | --- |
| Product and Design | `docs/governance/PRODUCT-AND-DESIGN.md` | Introduced by #2687 and activated through integrated reconciliation #2690 |
| PMO and Portfolio | `docs/governance/PMO-PORTFOLIO.md` | Active canonical owner |
| Delivery and Release | `docs/governance/DELIVERY-AND-RELEASE.md` | Active canonical owner |
| Agent Team | `docs/governance/AGENT-TEAM.md` | Active canonical owner |
| CI and Verification | `docs/governance/CI-AND-VERIFICATION.md` | Introduced by #2689 and activated through integrated reconciliation #2690 |
| Operations and Recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` | Active canonical owner |
| Platform and Environment | `docs/governance/PLATFORM-AND-ENVIRONMENT.md` | Introduced by #2688 and activated through integrated reconciliation #2690 |

## Undecided inventory (#4138 / #4199)

#4196 froze three undecided top-level folders. This section names a disposition row for each folder and for every file in that freeze inventory. Rows use the existing action vocabulary. This child does not move, delete, or archive those files, and it does not declare migration complete.

| Current path | Current owner | Target owner | Action | Replacement / notes | Reference-update scope |
| --- | --- | --- | --- | --- | --- |
| `docs/as-built/` | as-built (undecided) | reference | migrate | Folder row for the #4138 table. Later child folds the seven files below into `docs/reference/`. Moved in #4480. | docs/reference/ |
| `docs/postmortems/` | postmortems (undecided) | ops/incident-response | migrate | Folder row for the #4138 table. Later child folds the two files below into `docs/ops/incident-response/`. Moved in #4480. | docs/ops/incident-response/ |
| `docs/reports/` | reports (undecided duplicate) | ops/reports | consolidate | Folder row for the #4138 table. Later child merges the three files below into `docs/ops/reports/` and removes the top-level duplicate. Moved in #4480. | docs/ops/reports/ |
| `docs/as-built/DEPLOYMENT_GUIDE.md` | as-built | reference | migrate | Later child folds this file into `docs/reference/DEPLOYMENT_GUIDE.md`. Moved in #4480. | docs/reference/DEPLOYMENT_GUIDE.md |
| `docs/as-built/DOCS_CLEANUP_RECORD_2026-02-17.md` | as-built | reference | migrate | Later child folds this file into `docs/reference/DOCS_CLEANUP_RECORD_2026-02-17.md`. Moved in #4480. | docs/reference/DOCS_CLEANUP_RECORD_2026-02-17.md |
| `docs/as-built/RECONCILIATION-NOTES_2026-02.md` | as-built | reference | migrate | Later child folds this file into `docs/reference/RECONCILIATION-NOTES_2026-02.md`. Moved in #4480. | docs/reference/RECONCILIATION-NOTES_2026-02.md |
| `docs/as-built/accelerated-webpage-implementations-log.md` | as-built | reference | migrate | Later child folds this file into `docs/reference/accelerated-webpage-implementations-log.md`. Moved in #4480. | docs/reference/accelerated-webpage-implementations-log.md |
| `docs/as-built/cloudflare-frontend.md` | as-built | reference | migrate | Later child folds this file into `docs/reference/cloudflare-frontend.md`. Moved in #4480. | docs/reference/cloudflare-frontend.md |
| `docs/as-built/weekly-matchup-auto-rotation.md` | as-built | reference | migrate | Later child folds this file into `docs/reference/weekly-matchup-auto-rotation.md`. Moved in #4480. | docs/reference/weekly-matchup-auto-rotation.md |
| `docs/as-built/weekly-matchup-photo-url-normalization.md` | as-built | reference | migrate | Later child folds this file into `docs/reference/weekly-matchup-photo-url-normalization.md`. Moved in #4480. | docs/reference/weekly-matchup-photo-url-normalization.md |
| `docs/postmortems/2025-11-white-screen.md` | postmortems | ops/incident-response | migrate | Later child folds this file into `docs/ops/incident-response/2025-11-white-screen.md`. Moved in #4480. | docs/ops/incident-response/2025-11-white-screen.md |
| `docs/postmortems/2026-05-11-reviewer-gate-incident.md` | postmortems | ops/incident-response | migrate | Later child folds this file into `docs/ops/incident-response/2026-05-11-reviewer-gate-incident.md`. Moved in #4480. | docs/ops/incident-response/2026-05-11-reviewer-gate-incident.md |
| `docs/reports/2025-12-28-repo-cleanup.md` | reports | ops/reports | consolidate | Later child merges this file into `docs/ops/reports/2025-12-28-repo-cleanup.md` and removes the top-level duplicate. Moved in #4480. | docs/ops/reports/2025-12-28-repo-cleanup.md |
| `docs/reports/documentation-inventory-report-1132.md` | reports | ops/reports | consolidate | Later child merges this file into `docs/ops/reports/documentation-inventory-report-1132.md` and removes the top-level duplicate. Moved in #4480. | docs/ops/reports/documentation-inventory-report-1132.md |
| `docs/reports/program-1-diataxis-transition-status.md` | reports | ops/reports | consolidate | Later child merges this file into `docs/ops/reports/program-1-diataxis-transition-status.md` and removes the top-level duplicate. Moved in #4480. | docs/ops/reports/program-1-diataxis-transition-status.md |

## Validation checklist (#2486)

- [x] Every touched allowlist row has target owner and action recorded
- [x] Agent-policy conflict documented with interim authority noted
- [x] Every required domain names exactly one canonical policy file in `REPOSITORY-AUTHORITY.md`
- [x] `document-authority-hierarchy_MASTER.md` no longer carries competing canonical precedence
- [x] No duplicate active authority introduced in touched set
- [x] Direct references updated within touched documents
- [x] Header checks pass on modified files (local run)
- [x] `docs/as-built/`, `docs/postmortems/`, and `docs/reports/` each have a disposition row (#4199)
- [x] Every file named in the #4196 freeze inventory has a disposition row
- [x] No file move in this child
