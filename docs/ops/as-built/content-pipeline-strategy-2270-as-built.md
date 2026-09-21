---
Doc Type: AS-BUILT
Audience: Product Authority, PMO, Engineering, Operations, editors, and implementation agents
Authority Level: Operational Implementation Record
Owns: Exact delivered #2270 Model A strategy-reconciliation state — identities, files, child closeout, successor map, and documentation inventory
Does Not Own: D1/B2 mutation, crawler/runtime publishing, admin UI implementation, member-upload runtime, Product publication Go, or independent project/master close of parent #2270
Canonical Reference: /docs/ops/reports/content-pipeline-strategy-reconciliation-2270.md
Related Issues: #2270, #3867, #3868, #3869, #3870, #3871, #3872, #4252
Last Reviewed: 2026-09-21
---

# Content pipeline strategy (#2270) — AS-BUILT

## Purpose

Record what parent [#2270](https://github.com/wdhunter465/next-starter-template/issues/2270) actually delivered after Graduation GO 2026-09-20 and merged PR #4251. This is the mandatory AS-BUILT for that Model A strategy package. It describes the implemented documentation state, not a planned crawler, admin UI, or publication runtime.

## Current known truth

- Product Graduation **GO** 2026-09-20 placed #2270 Active at `pmo:priority:2`. Entry HOLDs #1738 and #2312 are closed complete.
- Children #3867–#3872 are closed complete. Strategy delivery is merged PR [#4251](https://github.com/wdhunter465/next-starter-template/pull/4251) at `9bc90cf907616cf1ae2193331cf4dc1a678e29ee`.
- The merged file is `docs/ops/reports/content-pipeline-strategy-reconciliation-2270.md`. No D1, B2, `/admin/*`, crawler, or publication-runtime mutation landed from this parent.
- Post-merge parent closeout of #2270 failed as #4252 (`too_many_source_issue_candidates`) and that exception is closed. The parent remains OPEN.
- Until this PR, no durable AS-BUILT existed under `docs/ops/as-built/` for #2270, which blocked project-documentation closeout.

## Intended final state

The Model A strategy package is recorded as implemented documentation, with this AS-BUILT as the completion record. Parent #2270 stays OPEN until an independent project/master closeout that did not solely implement the children. No runtime, crawler, admin UI, member-upload, automatic publication, or Production is started from this parent.

## Final objective and delivered outcome

**Objective:** one authoritative content discovery, intake, human review, rights/privacy, provenance, publication-preparation, retention, and controlled-automation strategy.

**Delivered:** merged strategy report `docs/ops/reports/content-pipeline-strategy-reconciliation-2270.md` covering children #3867–#3872. No runtime mutation.

## Scope of this record

In scope: strategy authority; overlapping-contract disposition; frozen state model by citation; human-review boundaries; safe-publication interfaces; manual-pilot-first sequencing; successor map; exact PR/Issue identities.

Out of scope (unchanged by #2270): D1 schema, B2 configuration, `/admin/*` routes, member-upload runtime, broad crawling, automatic publication, reopening #2286, implied Go for #2040 or #2073.

## Final identities

| Item | Identity |
| --- | --- |
| Parent project | #2270 |
| Launch package | `lgfc-project-launch-package:2270:v1` |
| Graduation | Product Authority GO 2026-09-20; Active `pmo:priority:2` |
| Delivery model | Model A, docs-only, one-step rollback |
| Child #2270-001 | #3867 CLOSED complete |
| Child #2270-002 | #3868 CLOSED complete |
| Child #2270-003 | #3869 CLOSED complete |
| Child #2270-004 | #3870 CLOSED complete |
| Child #2270-005 | #3871 CLOSED complete |
| Child #2270-006 | #3872 CLOSED complete |
| Implementation PR | [#4251](https://github.com/wdhunter465/next-starter-template/pull/4251) |
| Merge SHA | `9bc90cf907616cf1ae2193331cf4dc1a678e29ee` (2026-09-20T17:45:36Z) |
| Post-merge exception | #4252 CLOSED 2026-09-20T18:00:04Z |
| Branch used | `cursor/2270-content-pipeline-strategy-2e48` (launch package named `work/2270-content-pipeline-strategy`) |

## Architecture and component boundaries

#2270 did not add a new runtime pipeline. It adopted existing authorities:

| Concern | Canonical owner after #2270 |
| --- | --- |
| Candidate field/state vocabulary | `docs/reference/content/lgfc-content-candidate-model.md` (#2273) |
| Member submission / private-until-reviewed | `docs/reference/content/member-submission-content-model.md` |
| D1 metadata vs B2 binaries | `docs/reference/content/content-pipeline-storage-model.md` (#2312) |
| Publication prep vs published inventory | `docs/reference/content/content-publication-prep-model.md` |
| Public query helper | `functions/_lib/content-inventory-public.ts` → `publishedInventoryWhere()` (existing; not modified by PR #4251) |
| Allowlisted discovery + rights-evidence | #3551 lineage; as-built `docs/ops/as-built/gehrig-content-collection-rights-pipeline-as-built-3826.md` |

No new routes, workflows, Workers, migrations, secrets classes, or bindings were introduced.

## Files, routes, workflows, services, data, and credentials affected

| Surface | Result |
| --- | --- |
| Files written by PR #4251 | `docs/ops/reports/content-pipeline-strategy-reconciliation-2270.md` |
| Files written by this AS-BUILT PR | this document; pointer on the strategy report |
| Routes / admin UI | none |
| Workflows | none |
| D1 / B2 / R2 | none |
| Secrets / paid services | none; DPLA remains opt-in fail-closed (`DPLA_API_KEY`) per #2312 |

## Human-review and rights/privacy/cost boundaries (frozen, not newly coded)

Final decisions remain human: source trust, factual accuracy, rights, privacy, consent/credit, public use, and destructive purge. Source trust never implies rights clearance. No candidate becomes public solely through automation. Rejected content is not auto-purged.

Cost: no paid discovery or image-processing service from this parent.

## Validation and post-merge verification

| Check | Result |
| --- | --- |
| Launch-package acceptance vs report §§1–6 | Recorded PASS in the strategy report |
| Independent GitHub review | Required and completed on PR #4251 before merge |
| Post-merge parent closeout | Failed as #4252 (`too_many_source_issue_candidates`); exception closed; parent kept OPEN |
| Runtime tests | Not applicable (no runtime diff) |

## Rollback and recovery

Revert PR #4251 (strategy report) and this AS-BUILT PR. Completed runtime (#2286 / #3551 / #2040 surfaces) stays in place. Successors blocked by the strategy stay blocked until a corrected strategy is approved.

## Monitoring and Day-2 ownership

No new Production monitor was added. Day-2 Operations owns existing content-pipeline runtime health. Administration owns review-queue and audit-state reconciliation. PMO owns model/authority changes. Product Authority owns publication, rights/privacy exceptions, cost, and destructive purge.

## Known limitations and separately authorized future work

Per successor map (strategy report §6): remaining admin-queue IA is #2085 (not this parent); AI tagging is #2292; new publication automation, new sources, physical donation/custody, and candidate-model material changes each require a later source Issue. This AS-BUILT does not authorize those Issues.

## DIATAXIS dispositions

| Class | Disposition |
| --- | --- |
| Tutorial | Not applicable — no new operator learning path; strategy adopts existing models |
| How-to | Not applicable — no new operator procedure; existing rights-review and member-submission how-tos remain canonical |
| Reference | Existing candidate/storage/publication/member models retained; this project did not fork them |
| Explanation | Not applicable — no new conceptual design beyond the operations strategy report |
| Operations / AS-BUILT | This document plus `docs/ops/reports/content-pipeline-strategy-reconciliation-2270.md` |

## Documentation reconciliation inventory

| Documentation class | Path or justified Not applicable | Evidence |
| --- | --- | --- |
| Requirements / decisions | #2270 launch package `lgfc-project-launch-package:2270:v1` | Graduation GO 2026-09-20 |
| Design | `docs/reference/content/lgfc-content-candidate-model.md` | Adopted, not replaced |
| Implementation plan | Launch package ordered work units 1–6 | Children #3867–#3872 |
| Tutorial | Not applicable | No new capability tutorial |
| How-to | Not applicable | No new procedure |
| Reference | Candidate, member-submission, storage, publication-prep models cited above | Unchanged by PR #4251 |
| Explanation | Not applicable | Strategy lives in the operations report |
| Governance / PMO | #2270 current-state block; this AS-BUILT | Parent remains OPEN |
| Operations / recovery | Strategy report §5 incidents/rollback | Docs-only revert |
| AS-BUILT | `docs/ops/as-built/content-pipeline-strategy-2270-as-built.md` | This file |
| Final closeout evidence | Independent project/master closeout still required | Cursor implemented children and must not be sole parent closer |

## Project/master closeout

Children are complete. Parent #2270 stays OPEN until an independent PMO / Administration audit that did not solely implement the children records project/master close. This AS-BUILT does not close #2270 and is not Production or website Go.
