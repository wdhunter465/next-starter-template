---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor
Authority Level: Audit Artifact (non-authoritative planning output)
Owns: #2360 repository documentation audit, overlap inventory, disposition recommendations, and smallest safe promotion set for Content Collection Drive intake
Does Not Own: Diataxis promotion of Drive drafts, feature implementation, CI workflow changes, issue mutation beyond disposition discussion, merge authorization
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related Issues: #2360, #2359, #2367, #1738, #2286, #2273, #2274
Last Reviewed: 2026-07-08
---

# Content Collection Documentation Audit and Dedup Plan (#2360)

## Purpose

Repository-grounded audit of staged Drive drafts under `_incoming/drive-drafts/content-collection/` against existing LGFC documentation authority.

This report is an **audit artifact for #2360**. It does **not** promote Drive drafts into Diataxis authority.

## Source basis

| Field | Value |
| --- | --- |
| Parent program | #2359 |
| Source issue | #2360 |
| Intake branch | `ChatGPT/drive-draft-intake-2367` |
| Working branch | `cursor/2360-docs-audit-2e48` |
| Intake folder | `_incoming/drive-drafts/content-collection/` |
| Manifest | `_incoming/drive-drafts/content-collection/SOURCE-MANIFEST.md` |
| Phase | Phase 0 — documentation migration / enrichment / Diataxis placement planning only |

Intake rule (from intake README/manifest): staged `.docx` files and the retained ZIP are **non-authoritative source material only**.

## Validation evidence (2026-07-08)

| Command | Result |
| --- | --- |
| `bash scripts/ci/docs_check_headers.sh` | **FAIL** — pre-existing on intake branch: legacy handoff path reference; active workflow is `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` |
| `node scripts/ci/diataxis_folder_audit.mjs` | **PASS** — no DIATAXIS folder hygiene defects detected |
| `node scripts/check-repo-structure.mjs` | **PASS** |
| `node .agents/checks/agent-governance-check.mjs` | **PASS** |
| ZIP-in-root check (`test ! -f ./drive-download*.zip`) | **PASS** — ZIP retained only under intake folder |

Notes:

- Header failure is **pre-existing** on the intake branch tip and is **outside** this audit allowlist. Flagged for ChatGPT; not fixed in #2360.
- No Drive draft was promoted; no new Diataxis authority file was created except this audit report.

## Repo tree findings that block blind promotion

These proposed draft target roots **do not exist** in the current repository:

| Proposed path / root | Repo reality |
| --- | --- |
| `docs/ops/programs/` | **Missing.** Existing ops clustering uses `docs/ops/projects/`, `docs/ops/implementation-plans/`, `docs/ops/pmo/`, `docs/ops/reports/`, `docs/ops/trackers/` |
| `docs/reference/website/content-collection/` | **Missing.** Existing content/reference authority lives under `docs/reference/content/` and `docs/reference/website/` (flat / Lou-Gehrig-named files) |
| `docs/governance/digital-asset-standard.md` | **Missing** |
| `docs/governance/website-accelerated-implementation-policy.md` | **Missing** |
| `docs/how-to/ops/cursor-parallel-worktree-standard.md` | Parent `docs/how-to/ops/` **exists**; file missing |
| `docs/reference/ci/pr-body-generator-contract.md` | **Missing** (CI refs exist under `docs/reference/ci/` for other surfaces) |

**ChatGPT decision (accepted):** do **not** create `docs/ops/programs/content-collection/`. Remap program docs to existing ops patterns (`docs/ops/reports/`, `docs/ops/implementation-plans/`, `docs/ops/pmo/`, `docs/how-to/ops/`). Do **not** create `docs/reference/website/content-collection/`; merge reference material into existing content and Lou Gehrig website docs.

## Existing overlapping authority (high-value inventory)

Content pipeline / model:

- `docs/explanation/lgfc-content-collection-strategy.md`
- `docs/reference/projects/content-collection-production-definition.md`
- `docs/reference/content/lgfc-content-candidate-model.md`
- `docs/reference/content/content-pipeline-storage-model.md`
- `docs/reference/content/content-publication-prep-model.md`
- `docs/reference/content/member-submission-content-model.md`
- `docs/reference/website/lou-gehrig-source-provenance-model.md`
- `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md`
- `docs/reference/website/lou-gehrig-content-metadata-schema.md`
- `docs/reference/website/unified-content-workflow.md`
- `docs/reference/website/content-inventory-model.md`
- `docs/ops/reports/lgfc-content-pipeline-reconciliation-audit.md`
- `docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md`
- `docs/ops/implementation-plans/lou-gehrig-content-collection-expansion.md`

Governance / CI / PMO / PR:

- `Agent.md`, `docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md`, shared/core/Cursor rules
- `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md`
- `.agents/skills/lgfc-pr-governance/SKILL.md`
- `docs/ops/pmo/PMO-V4-OPERATING-MODEL.md` (PR #2282 merged 2026-07-05)
- `docs/ops/pmo/github-issue-closeout-protocol.md`
- `docs/templates/agent-assignment-template.md`
- `docs/reference/ci/*` (merge protection, post-merge validation, workflow inventory surfaces)
- `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`

Design / website surfaces:

- `docs/reference/design/LGFC-Production-Design-and-Standards.md`
- `docs/reference/design/fanclub*.md`
- `docs/ops/pmo/program-3-club-home-page-design.md`
- `docs/how-to/website/club-home-content-operations-runbook.md`

## Authority conflicts requiring ChatGPT/Bill direction

Do **not** silently resolve. Stop conditions from #2360 apply.

| ID | Conflict | Draft(s) | Existing authority | Recommended handling |
| --- | --- | --- | --- | --- |
| C1 | “Pre-approved merge” language remains in body despite v2 note reframing it as procedural preclearance | Accelerated Implementation / PR Closeout Policy | `Agent.md`, PR lifecycle, merge authorization owned by Bill/ChatGPT | **Do not promote as-is.** Enrich to remove merge-authorization reinterpretation; keep procedural preclearance only |
| C2 | Codex still described as an active/possible implementation package consumer | Code Package Standard; Runbook v1; Accelerated Policy Codex section | `LGFC-AI-TEAM-OPERATING-MODEL.md` — Codex inactive/out | Strip/gate Codex language before promote |
| C3 | CC-001 content-asset contract vs existing candidate / inventory / metadata authority | CC-001 | `lgfc-content-candidate-model.md`, content inventory/schema, #2286 as-built pipeline docs | **Merge plan required** before any new parallel contract; forbid duplicate SOTs |
| C4 | CC-002 provenance/rights package vs existing Lou Gehrig provenance/rights models | CC-002 | `lou-gehrig-source-provenance-model.md`, `lou-gehrig-rights-privacy-publication-review.md`, how-to provenance review | Prefer **merge into existing** unless ChatGPT freezes a supersession |
| C5 | Validation Standard and VAL-001 both target the same promoted path | Validation Standard; VAL-001 | — | Consolidate into one ops validation doc; second becomes merge/do-not-promote |
| C6 | GitHub label/status addendum may invent program-local lifecycle vocabulary | Label/Status Mapping Addendum | PMO V4 + existing label/lifecycle docs | Promote only as **addendum that defers** to PMO V4; no parallel label authority |
| C7 | Proposed `docs/ops/programs/**` tree vs current ops folder authority | Diataxis Promotion Map; most program/package drafts | `DIATAXIS-FOLDER-AUTHORITY.md`, existing ops tree | ChatGPT picks tree strategy before any mass promotion |
| C8 | Accelerated policy / continuous-execution tone vs gate and parse-safe PR discipline | Accelerated Policy; Runbook v2 continuous-execution model | Shared/core PR preflight, issue-first, no mixed intent | Enrich carefully; must not weaken parser/gate law |
| C9 | PMO V4 header text still says V3 remains until #2100 PR merges, but PR #2282 is merged | (repo doc staleness affecting disposition) | `PMO-V4-OPERATING-MODEL.md`, merged PR #2282 | Note for separate docs hygiene; treat V4 as current for this audit |

## Disposition key

| Disposition | Meaning |
| --- | --- |
| `promote` | Safe to create new target path after enrichment + ChatGPT path approval |
| `merge_into_existing` | Absorbed into named current repo doc(s); no parallel authority |
| `supersede` | Newer draft replaces older draft or thin planning artifact (not live product law without review) |
| `defer` | Real content, but later phase / later child issue |
| `do_not_promote` | Keep intake-only; outdated, provenance-only, or issue-body material |

Phase mapping uses program cadence from readiness/implementation-plan docs:

- **P0** docs audit/enrichment/promotion
- **P1** tooling/contracts/validation/PR-closeout support
- **P2** internal/admin/staging test surfaces
- **P3** visible Gallery/Library/Memorabilia/Club website work
- **P4** hardening/closeout registers

## Full disposition table

### Intake control artifacts

| # | Source | Disposition | Overlapping repo docs | Proposed target (pending ChatGPT tree decision) | Conflicts | Enrichment needed | Phase | Notes |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `README.md` | `do_not_promote` | — | remain under `_incoming/...` | none | keep as intake boundary | P0 | Intake control only |
| M | `SOURCE-MANIFEST.md` | `do_not_promote` | this audit | remain under `_incoming/...` | none | update status after dispositions accepted | P0 | Inventory only |
| Z | `drive-download-*.zip` | `do_not_promote` | — | remain under `_incoming/...` | none | provenance retention only | P0 | Never Diataxis |

### Planning / program / control drafts

| # | Source draft | Disposition | Overlapping repo docs | Proposed target | Conflicts | Enrichment needed | Phase |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Runbook v1 (CI Orchestration…) | `supersede` by Runbook v2; `do_not_promote` as standalone | agent operating model; #1738 readiness/plan; #2286 pipeline reports | n/a (superseded) | C2; outdated #1738-as-active framing | archive note only after v2 lands | P0 |
| 9 | Runbook v2 | `promote` (after path + conflict scrub) | readiness + implementation plan; Agent.md chain; PMO V4 | `docs/ops/reports/content-collection-runbook-v2.md` **or** `docs/ops/implementation-plans/content-collection-runbook-v2.md` | C7, C8 | path rewrite to approved ops cluster; link live issue graph; remove Codex/merge drift | P0 |
| 10 | #2286 Inheritance Map | `promote` | #2286 as-built pipeline reports; candidate model; reconciliation audit | `.../2286-inheritance-map.md` under chosen ops cluster | C7 | cite concrete repo paths/migrations/functions | P0 |
| 11 | #1738 Successor Program Decision | `promote` | #1738 readiness + implementation plan | `.../1738-successor-program-decision.md` | C7 | align with #2359 as active docs program wrapper | P0 |
| 6 | Master Program draft | `merge_into_existing` / issue body | #2359 body; readiness docs | do not invent parallel master authority file until successor program issue authorized | scope | keep as planning input for ChatGPT issue authorship | P0 |
| 7 | Project Lane Map + Agent Assignment | `promote` (split) | operating model; agent assignment template | `project-lane-map.md` + `agent-assignment-plan.md` under chosen ops cluster | C7 | agent roles must match Cursor-sole executor | P0 |
| 14 | Successor Master Program Issue Body | `do_not_promote` | GitHub issues | GitHub only | none if kept out of docs tree | ChatGPT authors live issue when authorized | P0 |
| 15 | Project Lane Issue Body Pack | `do_not_promote` | GitHub issues / templates | GitHub only (or fold snippets into `docs/templates/`) | none | optional template enrichment later | P0 |
| 22 | Per-Lane Task Issue Body Pack | `do_not_promote` | GitHub issues / templates | GitHub only | none | optional later | P0 |
| 13 | PMO-Compatible Issue Template Pack | `merge_into_existing` | `docs/templates/*`, PMO V4 | enrich templates rather than parallel pack | C6 | reconcile with PMO V4 fields | P0 |
| 33 | GitHub Label/Status Mapping Addendum | `merge_into_existing` / conditional `promote` as non-authority helper | PMO V4; label docs | only if framed as addendum under PMO | C6 | must defer to PMO V4 | P0 |
| 25 | Diataxis Promotion Map | `promote` after ChatGPT tree decision (or absorb into this report) | DIATAXIS folder authority; this audit | chosen ops cluster path | C7 | rewrite paths to approved tree | P0 |
| 26 | Documentation Dedup and Merge Plan | `merge_into_existing` | **this report** | keep audit report as the executable #2360 output | none | Drive draft remains planning input | P0 |
| 16 | Parallel Execution Matrix / File Allowlist Plan | `promote` | CORE allowlist discipline; Cursor worktree how-to | chosen ops cluster | C7 | repo-ground paths; hot-zone list | P0/P1 |
| 27 | Cursor Parallel Worktree Operating Standard | `promote` | `docs/how-to/ops/*`, Cursor rules | `docs/how-to/ops/cursor-parallel-worktree-standard.md` | none hard | align with existing Cursor execution rules | P0 |
| 23 | Launch Readiness Checklist v2 | `promote` | readiness package; launch-readiness scripts | chosen ops cluster checklist | C7 | map commands to real npm/scripts | P0/P4 |
| 24 | Package Index / Asset Inventory | `promote` | content reports; package manifests | chosen ops cluster package-index | C7 | inventory must reflect repo reality | P0/P1 |
| 28 | Program Closeout / As-Built Template | `promote` | verification-closeout skill; closeout protocols | chosen ops cluster | C7 | align with verification-closeout skill | P4 |
| 36 | Deferred Work Register | `promote` | readiness missing-decision register | chosen ops cluster | C7 | sync with issue-tracked deferrals | P4 |
| 37 | Risk Register | `promote` | readiness risks / stop rules | chosen ops cluster | C7 | keep stop rules issue-linked | P0/P4 |
| 34 | Cursor Assignment Prompt Pack | `merge_into_existing` | `docs/templates/agent-assignment-template.md` | enrich template / how-to rather than parallel pack | none hard | remove prompt drift vs Agent.md | P0 |
| 35 | Review Throttle / PR Queue Standard | `defer` / conditional merge | PR lifecycle; reviewer gates | only after conflict review vs PR governance | C8 | may weaken gate posture if promoted raw | P1 |
| 4 | Accelerated Implementation + PR Closeout Policy | `do_not_promote` until rewritten | PR lifecycle; governance enforcement; operating model | future `docs/governance/...` only after C1/C8 cleared | **C1, C8, C2** | rewrite merge language; Bill/ChatGPT must approve policy intent | P0 gate |
| 2 | Digital Asset Standard | `promote` after governance review | design/governance masters; agent assignment | `docs/governance/digital-asset-standard.md` (if ChatGPT wants governance) **or** ops reference | C7 | define Owns/Does-Not-Own vs locked design docs | P0/P1 |
| 8 | Code Package Standard | `promote` after Codex scrub | agent assignment template; Cursor rules | chosen ops cluster | **C2**, C7 | remove Codex execution assumptions | P0/P1 |
| 3 | Validation and Evidence Standard | `promote` (canonical validation doc) | verification-closeout; CORE verification doctrine | chosen ops validation path | **C5**, C7 | consolidate with VAL-001 | P0/P1 |
| 19 | VAL-001 Integrated Program Validation Package | `merge_into_existing` into Validation Standard / validation-plan | same | single validation plan file | **C5** | avoid dual authority | P1/P4 |
| 12 | CI Stage 0 Current-State Gap Analysis Plan | `promote` | `docs/reference/ci/*`, closeout/self-heal how-tos | `docs/ops/implementation-plans/ci-stage-0-current-state-gap-analysis.md` | none hard if inventory-first | must be analysis-only; no workflow edits in P0 | P0 then P1 |
| 5 | CI Program Orchestration + Admin Closeout Automation | `defer` | post-merge closeout automation docs/queues | implementation-plan only after Stage 0 | Phase drift to P1 tooling | keep docs-plan, no CI code in Phase 0 | P1 |
| 20 | CI-001 PR Body Generator Package | `defer` | PR template; pr-governance skill | package path after Stage 0 + path approval | Phase 1 tooling | docs package enrichment in later child issue | P1 |
| 21 | CI-002 Admin Closeout Auto-Repair Package | `defer` | closeout protocols; self-heal runbooks | package path after Stage 0 | Phase 1 tooling / safety boundary | docs only first; no workflow impl in P0 | P1 |

### Content contract / feature packages

| # | Source draft | Disposition | Overlapping repo docs | Proposed target | Conflicts | Enrichment needed | Phase |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 17 | CC-001 Content Asset Model | `merge_into_existing` first; conditional later promote of thin delta | candidate model; content inventory; metadata schema; #2286 as-built | prefer update existing `docs/reference/content/*` + website Lou-Gehrig refs; only create `content-asset-model.md` if ChatGPT freezes gap set | **C3**, C7 | explicit gap matrix vs #2286 / #2273 | P0→P1 |
| 18 | CC-002 Provenance / Rights Contract | `merge_into_existing` | provenance + rights models + how-tos | update existing Lou Gehrig provenance/rights docs | **C4** | avoid parallel contract | P0→P1 |
| 29 | GAL-001 Gallery Package | `defer` | fanclub design; club home design; content strategy | package under chosen ops cluster later | Phase 3 website | incomplete vs design authority; needs CC freeze | P3 (package docs may start late P1/P2) |
| 30 | LIB-001 Library Package | `defer` | library/content how-tos; design | same | Phase 3 | same | P3 |
| 31 | MEM-001 Memorabilia Package | `defer` | design / content strategy | same | Phase 3 | same | P3 |
| 32 | CLUB-001 Club Newspaper Design Package | `defer` / merge with design later | program-3 club home design; fanclub design; club how-to | prefer merge into design/ops club docs | Phase 3 | sparse draft (≈65 lines) | P3 |

### Manifest item not present as Drive draft

| # | Item | Disposition | Notes |
| ---: | --- | --- | --- |
| 38 | PMO Lessons Learned / Continuous Improvement Register | `do_not_promote` from this intake | Manifest says issue-created requirement in #2366; not a Drive draft in folder |

## Smallest safe first promotion set

Recommended **first documentation PR set** after ChatGPT disposition acceptance (still separate from this audit commit if preferred):

1. **Keep this audit report** as the #2360 closeout artifact (`docs/ops/reports/content-collection-docs-audit-dedup-2360.md`).
2. **Promote only after path decision C7:**
   - #2286 Inheritance Map
   - #1738 Successor Program Decision
   - Runbook v2 (with C2/C8 scrub)
3. **Explicitly exclude from first promotion PR:**
   - Accelerated Policy (C1)
   - GAL/LIB/MEM/CLUB packages (Phase 3)
   - CI-001/CI-002 and CI orchestration impl plans beyond Stage 0 inventory framing (Phase 1)
   - CC-001/CC-002 as new parallel contracts (C3/C4) until merge matrix approved
   - Issue-body packs as docs files
   - ZIP / intake README/manifest

Optional fourth item if ChatGPT wants governance early: **Digital Asset Standard** only after Owns/Does-Not-Own review against locked design docs.

## Recommended next child-issue packaging (#2359)

Align to parent child list, using this audit:

1. #2360 — audit/dedup (**this deliverable**)
2. Foundation enrichment: Runbook v2, inheritance/successor decisions, Digital Asset + Code Package + Validation standards (after conflict scrub)
3. Feature package enrichment: CC-001/CC-002 merge matrices, then GAL/LIB/MEM/CLUB package docs
4. Control/ops enrichment: Stage 0 CI gap analysis, review throttle, label addendum under PMO
5. Support docs: deferred/risk/closeout registers, prompt pack → template merge
6. Promotion PR + validation closeout (only after issue-level disposition approval)

## ChatGPT disposition decisions (accepted 2026-07-08)

ChatGPT reviewed the Phase 0 handoff on #2360 with status `disposition-approved-with-constraints`. Cursor accepts these decisions and records them here as authoritative for downstream #2359 child work.

| Topic | Decision |
| --- | --- |
| C7 tree strategy | **Do not** create `docs/ops/programs/`. Reuse `docs/ops/reports/`, `docs/ops/implementation-plans/`, `docs/ops/pmo/`, `docs/how-to/ops/`, and existing `docs/reference/projects/` / content / website reference folders. |
| C3/C4 reference strategy | **Do not** create `docs/reference/website/content-collection/` at this time. Merge model/provenance/rights/metadata into existing `docs/reference/content/*` and Lou Gehrig website reference docs. CC-001/CC-002 become gap matrices / deltas only — not parallel SOTs. |
| Accelerated Policy (C1/C8) | Reject promote-as-is; defer/rewrite only. |
| First promotion set (after scrub) | Audit report; #2286 Inheritance Map; #1738 Successor Decision; Runbook v2 — with exclusions listed below. |
| Digital Asset Standard | Not in first PR unless Owns/Does-Not-Own review against locked design/governance is clean. |
| Downstream work | Block #2361 / #2363 / #2364 enrichment until this #2360 audit PR is reviewed/merged. |

**Approved first promotion set constraints (Runbook v2 scrub required):**

- No GAL/LIB/MEM/CLUB packages
- No CI-001 / CI-002 tooling packages
- No CC-001 / CC-002 as new parallel contracts
- No issue-body packs as standalone docs
- Scrub Codex language, legacy ChatGPT terminology, and merge/authorization drift from Runbook v2

**Remapped target paths (per ChatGPT C7):**

| Draft (when promoted later) | Approved target pattern |
| --- | --- |
| Runbook v2, inheritance map, successor decision, lane map, package index, registers | `docs/ops/reports/` or `docs/ops/implementation-plans/` under content-collection naming |
| CI Stage 0 gap analysis | `docs/ops/implementation-plans/ci-stage-0-current-state-gap-analysis.md` |
| Cursor parallel worktree standard | `docs/how-to/ops/cursor-parallel-worktree-standard.md` |
| CC-001 / CC-002 deltas | merge into `docs/reference/content/*` + existing Lou Gehrig website refs |
| Feature packages (GAL/LIB/MEM/CLUB) | deferred; enrich under later child issues when Phase allows |

## Documentation source classification

`DIATAXIS_ROUTED` — ops report audit artifact under `docs/ops/reports/`; Drive intake remains non-Diataxis source material.

