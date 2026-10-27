---
Doc Type: Archive
Audience: Human + AI
Authority Level: Historical Record
Owns: Legacy documentation retirement ledger (old path to DIATAXIS authority mapping)
Does Not Own: Active operational authority; legacy retirement policy rules
Canonical Reference: /docs/ops/pmo/diataxis-legacy-retirement-policy.md
Related issues: #1353, #1076, #1134, #2140, #4908, #4138
Last Reviewed: 2026-10-26
---

# Legacy Documentation Migration Manifest

## Purpose

Append-only ledger of legacy documentation retirements. Each row records where a former live path moved or was deleted and which DIATAXIS document now owns authority.

## Authority

This manifest is **historical traceability only**. It does not grant implementation authority. Active authority remains in DIATAXIS documents per `/docs/ops/pmo/diataxis-legacy-retirement-policy.md`.

## Row Schema

| Field | Required | Description |
| --- | --- | --- |
| legacy path | yes | Former live repository path |
| archive path or deleted | yes | archive destination permitted by the legacy retirement policy, or `deleted` |
| replacement DIATAXIS path | yes | Current authoritative document |
| status | yes | `planned`, `in-progress`, `retired`, or `deleted` |
| rationale | yes | Why the legacy path was retired |
| date | yes | Retirement date (YYYY-MM-DD) |

## Entries

Rows are append-only. Do not delete historical rows; append corrections with a new date and rationale if a mapping changes.

| legacy path | archive path or deleted | replacement DIATAXIS path | status | rationale | date |
| --- | --- | --- | --- | --- | --- |
| *(none yet)* | — | — | — | Placeholder manifest created before portfolio work | 2026-06-05 |
| docs/reference/orchestration/startup-governance.md | docs/archive/reference/orchestration/startup-governance.md | docs/ops/ai/CHATGPT-RULES.md | retired | Superseded by Agent.md startup routing and the ChatGPT startup contract; retained as historical startup governance evidence. | 2026-07-02 |
| PROMPTS/Cursor-Rules.md | docs/archive/superseded/PROMPTS/Cursor-Rules.md | docs/ops/ai/CURSOR-RULES.md | retired | Stale prompt contradicted current roles. Archived with a canonical header under #3155. | 2026-09-27 |
| PROMPTS/Cursor-Launch-Prompt.md | docs/archive/superseded/PROMPTS/Cursor-Launch-Prompt.md | docs/how-to/cursor/run-program-task.md | retired | Launch prompt routed to the current how-to. Archived with a canonical header under #3155. | 2026-09-27 |
| PROMPTS/PR-as-ticket-template.md | docs/archive/superseded/PROMPTS/PR-as-ticket-template.md | docs/templates/agent-assignment-template.md | retired | Template routed to the current assignment template. Archived with a canonical header under #3155. | 2026-09-27 |
| ops/ai/CROSS-AGENT-OPERATING-RULES.md | docs/archive/superseded/ops/ai/CROSS-AGENT-OPERATING-RULES.md | docs/ops/ai/CORE-RULES.md | retired | Superseded by #2823. Archived with a Historical header under #3155 instead of copying policy into docs/ops/ai. | 2026-09-27 |
| governance/ai/AGENT-GOVERNANCE.md | docs/archive/superseded/governance/ai/AGENT-GOVERNANCE.md | docs/governance/AGENT-TEAM.md | retired | Superseded by #2823. Archived with a Historical header under #3155. No replacement governance standard was authored. | 2026-09-27 |
| docs/governance/ai/AI-GUIDE.md | docs/archive/superseded/governance/ai/AI-GUIDE.md | docs/governance/REPOSITORY-AUTHORITY.md | retired | Last live file in the legacy governance/ai folder. Consumer check found no workflow, script, or Agent.md dependency. Archived under #4138. | 2026-10-23 |
| docs/ops/trackers/LGFC-REPO-RECOVERY-AND-IMPLEMENTATION_PLAN.md | docs/archive/superseded/ops/trackers/LGFC-REPO-RECOVERY-AND-IMPLEMENTATION_PLAN.md | docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md | retired | Recovery-era plan. The implementation worklist is the live sequence. Archived under #4138. | 2026-10-23 |
| docs/ops/ai/GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md | docs/archive/GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md | none, history only | retired | Concluded launch-control package archived in #4091 (commit 87aac9e7). Backfilled under #4908; dated by the source PR. | 2026-09-18 |
| docs/ops/ai/LGFC-AI-TEAM-OPERATING-MODEL.md | docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md | docs/governance/AGENT-TEAM.md | retired | Superseded operating model archived in #4091 (commit 87aac9e7). Backfilled under #4908; dated by the source PR. | 2026-09-18 |
| docs/ops/ai/WORK-CONTINUITY-LEDGER.md | docs/archive/WORK-CONTINUITY-LEDGER.md | docs/governance/AGENT-TEAM.md | retired | Continuity ledger of the retired WORK actor archived in #4091 (commit 87aac9e7). Backfilled under #4908; dated by the source PR. | 2026-09-18 |
| docs/ops/ai/SHARED-AGENT-RULES.md | deleted | docs/governance/REPOSITORY-AUTHORITY.md | deleted | Superseded pointer with no authority of its own; the chain is Agent.md, REPOSITORY-AUTHORITY.md, AGENT-TEAM.md, AGENT-EXECUTION.md. Deleted in #4091 (commit 87aac9e7). Backfilled under #4908; dated by the source PR. | 2026-09-18 |
| docs/ops/ai/pr-lifecycle-standard.md | deleted | docs/governance/PR_PROCESS.md | deleted | Contradicted PR_PROCESS.md and AGENT-TEAM.md by naming ChatGPT the owner of every PR. Deleted in #4091 (commit 87aac9e7). Backfilled under #4908; dated by the source PR. | 2026-09-18 |
| PROMPTS/Codex-Rules.md | deleted | docs/ops/ai/CODEX-RULES.md | deleted | Deleted with the Codex decommission in #4165 (commit b2b18f08); CODEX-RULES.md remains as a historical pointer. Backfilled under #4908; dated by the source PR. | 2026-09-19 |
| PROMPTS/Codex-Launch-Prompt.md | deleted | docs/ops/ai/CODEX-RULES.md | deleted | Deleted with the Codex decommission in #4165 (commit b2b18f08); CODEX-RULES.md remains as a historical pointer. Backfilled under #4908; dated by the source PR. | 2026-09-19 |
| docs/as-built/DEPLOYMENT_GUIDE.md | docs/reference/DEPLOYMENT_GUIDE.md | docs/reference/DEPLOYMENT_GUIDE.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/as-built/DOCS_CLEANUP_RECORD_2026-02-17.md | docs/reference/DOCS_CLEANUP_RECORD_2026-02-17.md | docs/reference/DOCS_CLEANUP_RECORD_2026-02-17.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/as-built/RECONCILIATION-NOTES_2026-02.md | docs/reference/RECONCILIATION-NOTES_2026-02.md | docs/reference/RECONCILIATION-NOTES_2026-02.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/as-built/accelerated-webpage-implementations-log.md | docs/reference/accelerated-webpage-implementations-log.md | docs/reference/accelerated-webpage-implementations-log.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/as-built/cloudflare-frontend.md | docs/reference/cloudflare-frontend.md | docs/reference/cloudflare-frontend.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/as-built/weekly-matchup-auto-rotation.md | docs/reference/weekly-matchup-auto-rotation.md | docs/reference/weekly-matchup-auto-rotation.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/as-built/weekly-matchup-photo-url-normalization.md | docs/reference/weekly-matchup-photo-url-normalization.md | docs/reference/weekly-matchup-photo-url-normalization.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/postmortems/2025-11-white-screen.md | docs/ops/incident-response/2025-11-white-screen.md | docs/ops/incident-response/2025-11-white-screen.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/postmortems/2026-05-11-reviewer-gate-incident.md | docs/ops/incident-response/2026-05-11-reviewer-gate-incident.md | docs/ops/incident-response/2026-05-11-reviewer-gate-incident.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/reports/2025-12-28-repo-cleanup.md | docs/ops/reports/2025-12-28-repo-cleanup.md | docs/ops/reports/2025-12-28-repo-cleanup.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/reports/documentation-inventory-report-1132.md | docs/ops/reports/documentation-inventory-report-1132.md | docs/ops/reports/documentation-inventory-report-1132.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/reports/program-1-diataxis-transition-status.md | docs/ops/reports/program-1-diataxis-transition-status.md | docs/ops/reports/program-1-diataxis-transition-status.md | retired | Undecided top-level folder folded into its recorded target by #4480 (PR #4482, commit 5bc5e78a). Moved to a live DIATAXIS path, not archived. Backfilled under #4908; dated by the source PR. | 2026-10-08 |
| docs/_Future/LGFC_Future_Design_Dev_Strategy.md | docs/archive/future/LGFC_Future_Design_Dev_Strategy.md | none, history only | retired | Archived in commit e4d32797, before this manifest existed (placeholder dated 2026-06-05). Backfilled under #4908; dated by the source PR. | 2026-02-20 |
| docs/project/lgfc-lite-documentation-map_MASTER.md | docs/archive/research/lgfc-lite-documentation-map_MASTER.md | none, history only | retired | Archived in commit e4d32797, before this manifest existed (placeholder dated 2026-06-05). Backfilled under #4908; dated by the source PR. | 2026-02-20 |
| docs/reference/lgfc-lite-baseline.md | docs/archive/research/lgfc-lite-baseline.md | none, history only | retired | Archived in commit e4d32797, before this manifest existed (placeholder dated 2026-06-05). Backfilled under #4908; dated by the source PR. | 2026-02-20 |
| docs/reference/lou-gehrig-deep-research.md | docs/archive/research/lou-gehrig-deep-research.md | none, history only | retired | Archived in commit e4d32797, before this manifest existed (placeholder dated 2026-06-05). Backfilled under #4908; dated by the source PR. | 2026-02-20 |
| docs/reference/phase-6-email.md | docs/archive/research/phase-6-email.md | none, history only | retired | Archived in commit e4d32797, before this manifest existed (placeholder dated 2026-06-05). Backfilled under #4908; dated by the source PR. | 2026-02-20 |
| docs/how-to/secrets-rotation_MASTER.md | docs/governance/standards/secrets-rotation_MASTER.md | none, moved with body unchanged | retired | Policy, not a procedure; moved out of how-to under #4932 (decision on #4921). Header corrected only. | 2026-10-26 |
| docs/how-to/verification/post-recovery-425.md | docs/ops/reports/post-recovery-425.md | none, moved with body unchanged | retired | Point-in-time verification report, not a procedure; moved out of how-to under #4933 (decision on #4921). Header corrected only. | 2026-10-26 |
| docs/governance/standards/document-status-and-naming_MASTER.md | superseded-in-place | docs/governance/DOCUMENT-MANAGEMENT.md | retired | Superseded in place under #4856. The file remains at its path as a pointer. It was not moved. | 2026-10-27 |
