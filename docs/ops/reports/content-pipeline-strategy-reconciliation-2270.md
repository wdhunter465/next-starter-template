---
Doc Type: Operations
Audience: Product Authority, PMO, Engineering, Operations, editors, and implementation agents
Authority Level: Controlled
Owns: #2270 strategy reconciliation — overlapping-contract disposition, frozen source/candidate/submission/publication model, human-review boundaries, safe-publication interfaces, pilot/cost/retention/incident sequencing, and successor map
Does Not Own: D1 migrations, B2 configuration, crawler/runtime publishing, admin UI implementation, member-upload runtime, or Product publication Go
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related Issues: #2270, #3867, #3868, #3869, #3870, #3871, #3872, #1738, #2273, #2274, #2286, #2312, #2040, #2073, #2291, #2292, #3551, #2085
Last Reviewed: 2026-09-20
---

# Content Pipeline Strategy Reconciliation (#2270)

## Purpose

Finalize one authoritative content discovery, intake, human review, rights/privacy, provenance, publication-preparation, retention, and controlled-automation strategy for parent [#2270](https://github.com/wdhunter465/next-starter-template/issues/2270).

This report is the Model A strategy-reconciliation deliverable for work units [#3867](https://github.com/wdhunter465/next-starter-template/issues/3867)–[#3872](https://github.com/wdhunter465/next-starter-template/issues/3872). It does not authorize D1/B2 mutation, admin UI, member-upload changes, broad crawling, or automatic publication.

## Current known truth

- Product Graduation **GO** 2026-09-20 placed #2270 **Active** (`pmo:priority:2`). Entry HOLDs #1738 and #2312 are closed complete.
- Closed runtime Program #2286 is as-built evidence. It is not authority to recreate or supersede completed runtime work.
- Allowlisted Gehrig discovery/rights runtime already exists (#3551 lineage). As-built: `docs/ops/as-built/gehrig-content-collection-rights-pipeline-as-built-3826.md`.
- Canonical field/state vocabulary already exists in `docs/reference/content/lgfc-content-candidate-model.md` (Program #2273). This Issue **adopts that model**; it does not invent a second candidate schema.

## Scope

In scope: strategy authority; dispositions of overlapping Issues; frozen state model by citation; human-review boundaries; safe-publication interfaces; manual-pilot-first sequencing; successor map.

Out of scope: uncontrolled web crawling; bulk copyrighted ingestion; automatic public publication; AI as final factual authority; D1/B2 schema or code changes; new `/admin/*` routes; reopening #2286; implied implementation Go for #2040 or #2073.

---

## 1. Overlapping-contract inventory and disposition (#2270-001 / #3867)

Live GitHub state on 2026-09-20:

| Issue | Title | State | Disposition for #2270 |
| --- | --- | --- | --- |
| #1738 | Lou Gehrig Content Collection / Research Pipeline Expansion | CLOSED complete 2026-08-07 | **Reference layer.** Provenance, rights, privacy, and data-surface docs remain reusable. Do not reopen, relabel, or rewrite from this PR. |
| #2273 | Content Pipeline Reconciliation and Candidate Model | CLOSED complete 2026-08-07 | **Canonical candidate model owner.** `lgfc-content-candidate-model.md` plus seed JSON/schema remain the field/state freeze. #2270 does not replace #2273. |
| #2286 | Content Pipeline Runtime Implementation | CLOSED complete 2026-07-07 | **As-built runtime evidence.** Reconcile against it; do not recreate a parallel pipeline. |
| #2312 | Content acquisition storage policy and free-tier risk controls | CLOSED complete 2026-09-04 | **Storage/cost lock.** D1 = metadata/state; B2 = binaries; no paid acquisition service from this parent. Storage model: `docs/reference/content/content-pipeline-storage-model.md`. |
| #2040 | Website Automatic Content Publication Capability | CLOSED complete 2026-08-15 | **Reusable publication-state and admin review surfaces.** Not implied Go for new publication automation. |
| #2073 | Gehrig Content Collection Phase 2 / Advanced Research and Media Archive Acquisition | CLOSED complete 2026-09-02 | **Archive-acquisition successor lineage is closed at program level.** Physical donation/custody/loan is not this pipeline. As-built split: `docs/reference/content/content-rights-runtime-as-built-2073.md`. Do not reopen #2073 from this PR. |
| #2292 | AI-Assisted Tagging for LGFC Digital Content Assets | OPEN, Pipeline Design Ready | **Successor, not in this PR.** Launch packet waits until this strategy plus real asset-intake are far enough. Tags remain additive to the #2273 candidate arrays; AI is not a rights/privacy/publication decision-maker. |
| #3551 lineage | Allowlisted discovery + rights-evidence runtime | Shipped on `main` | **Completed capability to retain.** Six-source allowlist, metadata-only discovery, human (or mapped-license) rights conclusions, `/admin/rights-review`. Not a license to add sources or crawl. |
| #2085 | Admin Page and Tools Design Readiness | Active 13 (docs-only) | **Successor for remaining admin-queue IA.** Does not authorize `/admin/*` routes from #2270. |

#2274 reconciliation audit (`docs/ops/reports/lgfc-content-pipeline-reconciliation-audit.md`) remains the field-gap audit under #2273. This report does not reopen that audit; it records **authority disposition** after Graduation.

---

## 2. Frozen source / candidate / submission / publication model (#2270-002 / #3868)

**Canonical model:** `docs/reference/content/lgfc-content-candidate-model.md`.

**Supporting models (adopt, do not fork):**

| Concern | Canonical path |
| --- | --- |
| Member submission fields, `rights_choice`, private-until-reviewed | `docs/reference/content/member-submission-content-model.md` |
| D1 index vs B2 binaries; reuse of `content_inventory`, `submission_queue`, `photos`, `media_assets` | `docs/reference/content/content-pipeline-storage-model.md` |
| Approval ≠ published; publication targets and prep stages | `docs/reference/content/content-publication-prep-model.md` |
| Transitional seed registry | `data/research/lou-gehrig-content-candidates.json` and `.schema.json` (seed/fixture only; not operational truth) |

### Input streams (frozen)

`public_research` | `member_submission` | `admin_seed` | `scheduled_discovery`

`scheduled_discovery` remains reserved. Existing #3551 discovery is **allowlisted metadata capture**, not a general crawler and not a new stream enum.

### Orthogonal state dimensions (frozen)

Do not collapse these into a single `content_inventory.status`:

| Dimension | Owner vocabulary |
| --- | --- |
| `review_status` | pending_review, approved_internal_reference, approved_public_candidate, approved_citation_reference_only, deferred_source_verification, deferred_rights_review, deferred_privacy_review, rejected, private_internal_only |
| `rights_status` | unknown, public_domain_candidate, permission_needed, permission_requested, permission_granted, copyright_restricted, blocked |
| `privacy_flag` / `privacy_review_status` | as in the candidate model |
| `source_trust_status` | pending, trusted, questionable, blocked, deleted |
| `publication_status` | not_ready, draft_candidate, staged, approved_for_publish, published, unpublished, archived |

**Rule:** source trust never implies rights clearance. Rights clearance never implies privacy clearance. Approval never implies public publication.

---

## 3. Human-review boundaries (#2270-003 / #3869)

Final decisions that remain **human** (Product, editor, or designated curator — not an agent, not a Worker):

| Decision | Bound |
| --- | --- |
| Source trust | Allowlist membership and `source_trust_status`. Discovery code may only write against `sources` rows already present. |
| Factual accuracy / relevance | `relevance_status` and item review. AI assist is advisory only. |
| Rights / copyright | `rights_status` plus append-only `rights_evidence`. Search/metadata may be automated; conclusions may not be invented. |
| Privacy / living persons / minors | `privacy_flag` and `privacy_review_status`. Member submissions stay private until reviewed. |
| Consent / credit | Member `consent_status` and `credit_preference`; public `credit_line` required before publish. |
| Public use | `review_status = approved_public_candidate` **and** publication prep complete **and** inventory `status = published`. |
| Purge / destructive delete | Product Authority. Rejected or denied content is not automatically purged. Audit rows survive authorized purge. Member account soft-delete is a separate Operations control (#2919 / #3076), not a content-purge path. |

Member `rights_choice` (`member_owns_full_grant` vs `external_source_needs_evaluation`) is the submitter attestation. It is not a curator channel-scoped conclusion. Curator governed evidence (`recordGovernedRightsEvidence`) stays on the #3551 external-source path.

---

## 4. Safe-publication interfaces (#2270-004 / #3870)

Public consumers query **published `content_inventory` only**.

Required helper: `functions/_lib/content-inventory-public.ts` → `publishedInventoryWhere()`:

- `status = 'published'`
- non-empty `source_name`
- non-empty `credit_line`
- section/`allowed_sections` match for the surface

Public routes **must not** query `content_items`, seed JSON, raw `rights_evidence`, or member-private uploads.

A candidate becomes public only after all of:

1. source/submitter review acceptable;
2. item review acceptable;
3. rights status acceptable (unknown ownership blocks);
4. privacy review acceptable;
5. credit line present;
6. publication target selected;
7. human approval recorded;
8. editorial conversion to `content_inventory` with `status = published`.

`publication_candidates` (storage-model future table) is staging, not a public API. Existing #2040 publication-review surfaces remain prior art for editorial state, not a bypass of this helper.

---

## 5. Pilot sequencing, discovery limits, cost, retention, rollback, incidents (#2270-005 / #3871)

### Sequencing (manual first)

1. Keep using allowlisted metadata discovery and admin-seed / member-submission intake already on `main`.
2. Do not add sources, Workers, or scheduled discovery from this parent.
3. Do not automate publication.
4. Remaining queue UI (candidate review, search-runs, publication-prep pages) is successor work (#2085 design brief, then a later implementation Issue).

### Discovery limits

- Six-source allowlist only (`openverse.org`, `loc.gov`, `commons.wikimedia.org`, `dp.la`, `copyright.gov` human verification, `cmgworldwide.com` relationship). As-built table in the #3826 record.
- Metadata only. No bulk media download into git. B2 ingest is admin-gated and trusted-source only.
- Broad crawling is forbidden.

### Cost / credentials (#2312)

- No paid discovery, tile, or image-processing service from this parent.
- DPLA adapter remains opt-in and fails closed without `DPLA_API_KEY`.
- Default blob store remains existing B2. R2 is a later platform Issue.

### Retention

- Rejected, deferred, and private_internal_only rows remain for audit.
- Soft-delete / restore for members is #2919/#3076, not content purge.
- Destructive content purge requires a later Product-authorized source Issue.

### Rollback

Revert this documentation PR. Completed runtime (#2286 / #3551 / #2040 surfaces) stays in place. Successors blocked by this strategy stay blocked until a corrected strategy is approved.

### Incidents

Stop for: conflicting completed-runtime evidence, unclear rights/privacy authority, a proposed automatic publication path, unresolved storage/cost policy, paid-service need, destructive purge, or a material candidate-model change requiring Product decision. Day-2 Operations owns runtime health; PMO owns model/authority changes; Product owns publication, rights/privacy exceptions, cost, and purge.

---

## 6. Successor map (#2270-006 / #3872)

| Class | Item | Action |
| --- | --- | --- |
| Completed capability | #1738 reference layer | Retain docs; do not reopen |
| Completed capability | #2273 candidate model | Retain as schema authority |
| Completed capability | #2286 runtime | Retain as-built; do not duplicate |
| Completed capability | #2312 storage/free-tier policy | Retain; cite storage model |
| Completed capability | #2040 publication-state admin surfaces | Retain as prior art |
| Completed capability | #3551 allowlisted discovery + rights-evidence + `/admin/rights-review` | Retain; no new sources here |
| Completed capability | Member submit + Path C photo upload | Retain member-submission model |
| Completed program | #2073 Phase 2 archive acquisition | Closed; do not reopen from #2270 |
| Retired duplication | Second candidate schema, second crawler, second public inventory query | Do not create |
| Retained future (Pipeline) | #2292 AI-assisted tagging | Launch packet only after this strategy plus real intake; AI not a final reviewer |
| Retained future (Active docs) | #2085 admin IA for remaining queues | Design brief only until its own children execute |
| Future source Issue required | Dedicated candidate / search-run / publication-prep admin pages | Not this parent |
| Future source Issue required | New publication automation | Not implied by closed #2040 |
| Future source Issue required | Physical donation/custody/loan | Not #3551 and not member-upload |
| Future source Issue required | Candidate-model material change | Product decision, then new Issue |

#2291 SEO remains a separate Pipeline parent and is not activated by this report.

---

## Validation against launch-package acceptance

| Criterion | Recorded result |
| --- | --- |
| Every input stream enters one candidate model with provenance | Adopted #2273 model; four streams frozen |
| Member submissions private until reviewed | Member model + `pending_review` / `not_ready` defaults |
| Source trust never implies rights clearance | Explicit in §2–§3 |
| No candidate public solely through automation | §4–§5 |
| Public consumers cannot query raw candidates | `publishedInventoryWhere()` only |
| Rejected content not auto-purged; audit survives | §3, §5 |
| Closed #2286 reconciled without reopening | §1, §6 |
| #2040 / #2073 explicit entry conditions; no implied Go | §1, §6 |
| No conflicting D1/B2 rule after #2312 | Storage model cited |
| Fixture paths (approve/reject/defer/duplicate/restricted/unpublish/archive/purge-intent) | Vocabulary frozen in candidate model; runtime fixtures remain existing tests, not this PR |

## Rollback

Revert this file. No runtime change is included.

## Protected stops

Stop rather than implement if a change would add crawling, automatic publication, a new paid service, D1/B2 mutation, `/admin/*` routes, destructive purge, or a second candidate schema.
