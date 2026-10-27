---
Doc Type: Reference
Audience: Bill, Governance, Cursor, admin implementers, and LGFC editors
Authority Level: Controlled
Owns: Publication preparation model separating approval from public publication
Does Not Own: Runtime publication automation, admin UI code, or route implementation
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related issues: #2273, #2279, #2275, #2278
Last Reviewed: 2026-10-26
---

# Content Publication Preparation Model

## Purpose

Define how approved candidates become publication-ready without automatic public
exposure. Separates **approval**, **staging**, and **publication**.

## Core rule

Approved content ≠ published content.

A candidate reaches public surfaces only after:

1. source/submitter review acceptable;
2. item review acceptable;
3. rights status acceptable;
4. privacy review acceptable;
5. credit line present;
6. publication target selected;
7. human approval recorded;
8. editorial conversion to `content_inventory` with `status = published`.

## Publication preparation stages

| Stage | `publication_status` | Meaning |
| --- | --- | --- |
| Not eligible | `not_ready` | Missing review dimensions |
| Drafting | `draft_candidate` | Editor may prepare copy |
| Staging | `staged` | Operator preview; no public route |
| Approved for target | `approved_for_publish` | Human signed off for specific surface |
| Live | `published` | Linked inventory row is public |
| Withdrawn | `unpublished` / `archived` | Removed or inactive |

## Publication targets

`biography`, `timeline`, `gallery`, `library`, `memorabilia`, `article`,
`homepage_feature`, `lou_gehrig_day`, `newsletter`, `social`,
`internal_reference_only`

Target drives `allowed_sections` mapping at editorial conversion.

## Safe publication view (requirements)

Public helper must require:

```text
content_inventory.status = 'published'
AND source_name present
AND credit_line present
AND allowed_sections matches surface
AND NOT blocked by conversion-time rights/privacy flags
```

Implementations must not query `content_items` or seed JSON on public routes.

Reference: `functions/_lib/content-inventory-public.ts` — `publishedInventoryWhere()`.

## `publication_candidates` staging record (future D1)

| Field | Purpose |
| --- | --- |
| `content_item_id` | Source candidate |
| `publication_target` | Intended surface |
| `credit_line` | Final credit |
| `staging_notes` | Operator preview notes |
| `approved_by` / `approved_at` | Human approval |
| `content_inventory_id` | Set after conversion |

## Route exposure boundaries

| Route class | May read |
| --- | --- |
| Public homepage, library, gallery | published `content_inventory` only |
| Fan Club member | published inventory + approved photos catalog |
| Admin editorial | queue, inventory, candidates, publication prep |
| Admin candidate review (future) | `content_items`, moderation events |

## Deferred and rejected handling

| Case | Handling |
| --- | --- |
| `deferred_*` review | remain in candidate registry; excluded from publication prep |
| `rejected` | no publication prep; audit event retained |
| `private_internal_only` | never enter publication prep |

## Duplicate candidates

Duplicates with `duplicate_of` set must not enter publication prep until resolved.

## Cross-references

- Implementation plan: `docs/ops/implementation-plans/lgfc-content-admin-review-and-publication-prep.md`
- Storage model: `docs/reference/content/content-pipeline-storage-model.md`
