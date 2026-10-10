---
Doc Type: Implementation Plan
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, implementation agents
Authority Level: Operational Plan (non-authoritative until promoted via Issue/PR)
Owns: CC-002 implementation envelope — source, provenance, rights, privacy, publication-review, takedown, and human-review authority for Content Collection assets
Does Not Own: Legal conclusions, runtime enforcement, canonical provenance/rights reference docs, or merge authorization
Canonical Reference: /docs/reference/website/lou-gehrig-source-provenance-model.md
Related Issues: #2361, #2359, #2360, #1738, #2286
Last Reviewed: 2026-07-08
---

# CC-002 Source Provenance and Rights Contract Package

## Purpose

Define the source, credit, citation, provenance, rights, privacy, publication-review, takedown, and human-review authority contract for LGFC content assets — as a companion to CC-001 and **merged into** existing Lou Gehrig provenance/rights reference authority.

## Scope

**In scope:**

- Field and state models for source identification and exposure control.
- Public/member display rules by rights and privacy state.
- Human-review authority (no AI auto-approval).
- Gap matrix vs existing reference docs.
- Repo-verified paths, allowlist, validation, and freeze dependency on CC-001.

**Out of scope:**

- Creating `docs/reference/website/content-collection/provenance-and-rights-contract.md` as a parallel SOT (rejected per #2360 C4).
- Gallery/Library/Memorabilia/Club route implementation.
- Legal advice or automated rights determination.

## Current known truth

| Surface | Repo path | Role |
| --- | --- | --- |
| Source provenance model | `docs/reference/website/lou-gehrig-source-provenance-model.md` | Credit, contributor records, conflicting sources (#1741) |
| Rights/privacy/publication review | `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md` | Clearance states, no-publish conditions (#1742) |
| Metadata schema | `docs/reference/website/lou-gehrig-content-metadata-schema.md` | Required candidate fields |
| Provenance how-to | `docs/how-to/website/lou-gehrig-source-provenance-review.md` | Operator workflow |
| #2286 pipeline | `functions/_lib/content-pipeline-publication-prep.ts`, `content-pipeline-candidate-admin.ts` | Publication-prep and review surfaces |
| Intake draft | `_incoming/.../CC-002 … Draft.docx` on `ChatGPT/drive-draft-intake-2367` | Non-authority |

**ChatGPT disposition (#2360):** CC-002 is `merge_into_existing`. Prefer updates to existing Lou Gehrig provenance/rights docs unless ChatGPT freezes supersession.

## Relationship to CC-001 and #2286

- CC-002 is a **companion** to CC-001; public/member display lanes require both contracts frozen.
- CC-002 **consumes** #2286 publication-prep and admin review APIs — does not rebuild them.
- `contract_dependency`: `CONTRACT-FROZEN: content-asset-model v1` before downstream feature display implementation.

## Gap matrix (draft CC-002 vs repo authority)

| CC-002 draft concept | Existing authority | Gap / action |
| --- | --- | --- |
| Source fields (`source_name`, `source_type`, `source_credit`, `citation_text`, …) | metadata schema + provenance model | **Mostly covered** — align enum values at implementation |
| `source_type` values (member_submission, archive_reference, …) | candidate `source_type` / `acquisition_method` | **Partial** — map draft enums to candidate model enums |
| Rights state model | rights model clearance table | **Covered** — draft uses more granular labels; map to `rights_status` values |
| Privacy state model | `privacy_flag` + privacy review process | **Covered** |
| Publication review states | `review_status` + publication approval path | **Covered** |
| Human review authority rule | metadata schema automation boundary; rights model | **Covered** — reinforce in implementation PR |
| Takedown/suppression fields | soft-delete/retention in #2286; rejection states | **Gap** — explicit `suppression_reason`, `takedown_request_source` not in metadata schema; narrow extension if needed |
| Per-surface display requirements | provenance model credit display table | **Partial** — Gallery/Library/Memorabilia/Club display lists in CC-001/CC-002 packages must align at freeze |
| Public display block rules | rights model no-publish conditions | **Covered** |

## Rights and privacy public-display rules

Content **must not** display publicly when canonical or draft-equivalent states match the blocking sets below.

### Field-name normalization (canonical → draft alias)

| Canonical (repo authority) | CC-002 draft alias | Notes |
| --- | --- | --- |
| `privacy_flag` | `privacy_status` | Same semantic role in candidate/inventory models |
| `review_status` | `publication_status` | Map draft publication states to `review_status` values in `lou-gehrig-content-metadata-schema.md` |
| `rights_status` | draft rights labels (`unknown_pending_review`, …) | Map draft labels to canonical `rights_status` enum before enforcement |

Implementers must normalize to **canonical** field names at runtime and in tests. Draft enum labels in this package are planning aliases only.

### Blocking values

| Domain | Blocking values |
| --- | --- |
| `rights_status` | `unknown`, `permission-needed`, `rejected`, `fee-required` (never publish; `link-only` retired 2026-10-10), or draft equivalent `unknown_pending_review`, `restricted_do_not_publish`, `takedown_requested`, `internal_reference_only`, `fair_use_review_required` (unless Bill/ChatGPT approved) |
| `privacy_status` / `privacy_flag` | `private_admin_only`, unresolved `privacy_review_required`, `restricted_do_not_publish`, `takedown_requested`, unreviewed `contains_personal_information` |
| `publication_status` / `review_status` | not `approved-for-public-copy` / `approved_for_publication` / `published` |
| Suppression | `takedown_requested`, `suppressed`, `soft_deleted` |

## Human review authority rule

Human/operator review is authoritative. AI, OCR, automated tagging, or inferred metadata **must not** approve publication, rights, privacy, credit, or provenance. AI-ready fields remain advisory until human workflow completes.

## Takedown and suppression

Required when suppressing public display:

- `suppression_reason`
- `suppressed_by`
- `suppressed_at`
- `takedown_request_source`
- `takedown_resolution_note`

Verify whether #2286 retention/soft-delete fields satisfy these before adding schema deltas.

## Repo-verified implementation surfaces

| Kind | Verified paths |
| --- | --- |
| Canonical reference (update when child issue authorizes) | `docs/reference/website/lou-gehrig-source-provenance-model.md`, `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md`, `docs/reference/website/lou-gehrig-content-metadata-schema.md` |
| Package envelope | `docs/ops/implementation-plans/content-collection/packages/cc-002-provenance-rights-contract-package.md` |
| Pipeline integration | `functions/_lib/content-pipeline-publication-prep.ts`, `functions/_lib/content-pipeline-candidate-admin.ts` |
| Tests | `tests/*provenance*`, `tests/*rights*`, `tests/*content-asset*` (when authorized) |

**Hot zones — require explicit approval:**

- `src/app/fanclub/**` route files
- `.github/workflows/**`, `scripts/ci/**`
- `functions/_middleware.ts`, broad unrelated migrations

## File allowlist (CC-002 implementation child issue)

```text
docs/reference/website/lou-gehrig-source-provenance-model.md
docs/reference/website/lou-gehrig-rights-privacy-publication-review.md
docs/reference/website/lou-gehrig-content-metadata-schema.md
docs/ops/implementation-plans/content-collection/packages/cc-002-provenance-rights-contract-package.md
functions/_lib/content-pipeline-publication-prep.ts
functions/_lib/content-pipeline-candidate-admin.ts
tests/*provenance*
tests/*rights*
tests/*content-asset*
```

## Parallel execution control

| Field | Value |
| --- | --- |
| `parallel_safe` | `conditional` |
| `contract_dependency` | CC-001 freeze marker for downstream feature lanes |
| `merge_order_constraint` | CC-002 should merge before public/member-facing content display lanes |

## Validation plan

**What to verify:**

- Source/rights/privacy/publication models documented.
- Public display cannot bypass review states.
- Human review authority preserved.
- Downstream lanes know display/enforcement fields.

**Commands (docs review):**

```bash
bash scripts/ci/docs_check_headers.sh
node scripts/ci/diataxis_folder_audit.mjs
```

**Commands (code child issue):**

```bash
npm run typecheck
npm test -- --run tests/provenance*
npm test -- --run tests/rights*
```

**Pass:** Public/member-visible content cannot bypass source/rights/privacy requirements.

**Fail:** Unsafe public display path exists — stop affected display lane.

## PR closeout requirements

- Source issue, package path, field/state summary.
- Public/private display rules stated.
- Human review authority statement.
- CC-001 freeze dependency noted.
- Validation evidence and downstream lane impacts.

## Procedure

1. Read CC-001 package and canonical provenance/rights refs.
2. Resolve gap matrix (especially takedown/suppression fields).
3. Implement only within child-issue allowlist.
4. Verify negative-case fixtures: blocked rights/privacy states never render on public routes.
5. Post `CHATGPT HANDOFF` if canonical ref updates conflict with locked design/governance.

## Acceptance criteria

- [ ] Source/provenance/rights contract documented with repo-verified merge targets.
- [ ] Public/private exposure rules explicit and testable.
- [ ] Human review remains authoritative; no AI auto-approval path.
- [ ] CC-001 freeze dependency documented for feature lanes.
- [ ] Validation commands and evidence requirements defined.
- [ ] No parallel SOT under rejected `content-collection/` reference tree.
