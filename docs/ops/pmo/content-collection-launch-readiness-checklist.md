---
Doc Type: Operational Checklist
Audience: Bill, Governance, Cursor, LGFC maintainers
Authority Level: Operational
Owns: Go/no-go checklist before Content Collection Phase 0 issue creation, Phase 1 launch, implementation start, and terminal promotion
Does Not Own: Merge authorization, GitHub issue mutation, feature implementation, or automatic launch authorization
Canonical Reference: /docs/ops/reports/content-collection-docs-audit-dedup-2360.md
Related Issues: #2363, #2359, #2360, #2365, #2431, #2432, #2433, #2434, #2435, #2436, #2437, #2438, #4776
Last Reviewed: 2026-10-26
---

# Content Collection Launch Readiness Checklist

## Purpose

Determine go/no-go for Content Collection program steps: Phase 0 documentation enrichment, terminal Phase 0 promotion closeout, Phase 1 preparation, and later implementation launch.

## Scope

This checklist covers repository-documentation and implementation-control gates. It does not authorize implementation by itself.

## Current known truth

- #2360 audit disposition is authoritative (`docs/ops/reports/content-collection-docs-audit-dedup-2360.md`).
- Phase 0 documentation promotion completed via PR #2427.
- Phase 1 preparation issue set is #2431–#2438.
- #2431 is the prepared Phase 1 Go / NoGo control issue.
- Rejected paths remain `docs/ops/programs/` and `docs/reference/website/content-collection/`.
- Cursor is sole implementation executor; Codex is inactive.
- Product Authority retains merge authorization — no pre-approved merge language.
- GAL / LIB / MEM / CLUB feature code remains blocked until `CONTRACT-FROZEN: content-asset-model v1` is posted and PMO Admin verifies downstream release.

## Pre-enrichment PR (Phase 0 child issues)

| # | Check | Pass criteria | Status field |
| ---: | --- | --- | --- |
| 1 | Source issue open with a Product Authority PR authorization comment | `#2363` / `#2364` etc. | `issue_authorized` |
| 2 | #2360 audit merged and disposition recorded | Report on `main` | `audit_complete` |
| 3 | File allowlist defined before edits | Listed in issue or PR body | `allowlist_defined` |
| 4 | No governance conflict with PMO July 2026 / PR lifecycle / Agent.md chain | Stop and `CHATGPT HANDOFF` if conflict | `governance_clear` |
| 5 | Docs validation commands planned | See Validation section | `validation_planned` |

## Pre-implementation launch (post–Phase 0 docs)

| # | Check | Pass criteria | Status field |
| ---: | --- | --- | --- |
| 6 | Foundation packages enriched (#2361) | On `main` | `foundation_docs` |
| 7 | Feature packages enriched (#2362) | On `main` | `feature_docs` |
| 8 | Control docs enriched (#2363) | On `main` | `control_docs` |
| 9 | Support docs enriched (#2364) | On `main` | `support_docs` |
| 10 | `CONTRACT-FROZEN: content-asset-model v1` posted | On program issue when required | `contract_frozen` |
| 11 | Implementation child issue with exact allowlist | Per package doc | `child_issue_ready` |
| 12 | Design authority cited for UI work | `LGFC-Production-Design-and-Standards.md` + route design | `design_cited` |

## Pre–#2365 terminal promotion

| # | Check | Pass criteria | Status field |
| ---: | --- | --- | --- |
| 13 | Package index reflects promoted paths | `docs/ops/implementation-plans/content-collection/package-index.md` | `index_current` |
| 14 | Diataxis promotion map status fields current | `docs/ops/pmo/content-collection-diataxis-promotion-map.md` | `promotion_map_current` |
| 15 | Deferred/risk registers reviewed | Support docs on `main` | `registers_current` |
| 16 | VAL-001 evidence template fillable | `docs/ops/implementation-plans/content-collection/packages/val-001-integrated-program-validation-package.md` | `validation_plan_ready` |
| 17 | No open post-merge queue blocker | No unresolved `post-merge-failure` exception blocking queue | `queue_unblocked` |

## Phase 1 Go / NoGo gate

| # | Check | Pass criteria | Status field |
| ---: | --- | --- | --- |
| 18 | Phase 0 terminal state accepted | #2359 / #2365 complete and PR #2427 merged | `phase0_complete` |
| 19 | Phase 1 parent issue prepared | #2431 exists and is blocked pending Go / NoGo | `phase1_parent_ready` |
| 20 | Phase 1 child graph prepared | #2432–#2438 exist and cite #2431 | `phase1_children_ready` |
| 21 | Phase 1 prep doc exists | `docs/ops/implementation-plans/content-collection/phase1-launch-prep.md` | `phase1_doc_ready` |
| 22 | Gate 0 stale-state repair is first | #2432 precedes implementation tasks | `gate0_first` |
| 23 | CC-001 / CC-002 freeze sequence explicit | #2433 then #2434 before feature lanes | `contract_sequence_ready` |
| 24 | CI Stage 0 precedes CI tooling | #2435 before #2436 / #2437 | `ci_stage0_first` |
| 25 | Feature lanes remain blocked | D-008 deferred until verified freeze | `feature_lanes_blocked` |
| 26 | CI tooling remains gated | D-009 under review, not auto-launched | `ci_tooling_gated` |
| 27 | Review throttle accepted | Maximum two to three `READY FOR REVIEW` PRs | `review_throttle_ready` |
| 28 | No automation overreach | No AI/OCR/crawler/auto-publication authorization | `automation_guardrails_clear` |
| 29 | Product Authority launch decision recorded | Explicit Go / NoGo comment on #2431 | `launch_decision_recorded` |

## Stop rules

Stop and post `CHATGPT HANDOFF` when:

- Operational doc conflicts with `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`, PR lifecycle, or shared agent rules.
- Accelerated Policy / pre-approved merge language appears in promoted docs (C1/C8).
- Proposed path reintroduces `docs/ops/programs/`.
- Phase 1 issue attempts to start feature implementation before the freeze marker.
- CI tooling attempts to bypass Product Authority merge, review, or closeout authority.

## Validation

Before claiming readiness on a docs PR:

```bash
bash scripts/ci/docs_check_headers.sh
node scripts/ci/diataxis_folder_audit.mjs
node .agents/checks/agent-governance-check.mjs
```

Record PASS/FAIL in PR body.

## Procedure

1. Copy the relevant gate subset into the source issue or terminal closeout issue.
2. Mark each row `pass` / `fail` / `deferred` with evidence link.
3. **No-go** if any blocking row is `fail` without approved deferral issue.
4. **Go** when all required rows for the target gate are `pass` and Product Authority explicitly authorizes launch.

## Execution

Use gate-specific subsets:

- **Enrichment PR:** rows 1–5.
- **Implementation launch:** rows 6–12.
- **#2365 closeout:** rows 13–17.
- **Phase 1 Go / NoGo:** rows 18–29.
