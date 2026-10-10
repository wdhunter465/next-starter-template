---
Doc Type: Reference
Audience: LGFC maintainers, Product Authority, and implementation agents
Authority Level: Supporting
Owns: D1 design for content permission records, decision history, source standing and the permission communications archive
Does Not Own: The policy itself (the rights review model), migrations, runtime code, or any D1 write
Canonical Reference: /docs/reference/website/lou-gehrig-rights-privacy-publication-review.md
Related Issues: #4550, #4523, #4526, #4528, #4527, #4368
Last Reviewed: 2026-10-10
---

# Lou Gehrig Content Record D1 Design

## Purpose

This design turns the policy in the rights review model into D1 tables and columns, reusing what exists. It is a proposal for review. Nothing here is built.

## Principles

- Additive only: new tables and `ALTER TABLE ... ADD COLUMN`. No rebuild of `content_items` or `rights_evidence`, because widening a `CHECK` in SQLite needs a full table rebuild (as migration 0079 had to do).
- Default is not permitted. Every new record starts `not_permitted`.
- History is never overwritten. Permanent retention.
- No website behavior changes until the publishing gate (#4528) is wired. Adding columns changes nothing on the site.

## What already exists (reuse)

| Existing | Use |
| --- | --- |
| `sources` | The list of sites searched: domain, trust status, `blocked_at` |
| `content_search_runs` | Search-run audit with counts and errors |
| `content_items` | The found-item record: `candidate_id`, `source_url`, `source_domain`, `source_name`, `source_owner`, `credit_line`, `created_at`, `source_id`, `content_inventory_id`, `curator_decision` |
| `rights_evidence` | Per-evaluation evidence: `evidence_text` (the origin's own wording), `evidence_url`, `recorded_at`, `reviewer`, `conclusion`, `usage_decision`, `channel`, `rights_holder`, `contact_info`, `tagging_requirements`; `evidence_type` already includes `cmg_grant` |
| `content_inventory`, `content_inventory_events`, `content_inventory_placement_history`, Club Home editions | What is published and when; the usage log |
| `editorial_audit_events` | General editorial audit |

## Changes by table

### `content_items` (the record)

Mapping of policy fields to existing columns:

| Policy field | Column |
| --- | --- |
| Origin URL (cleaned https) | `source_url` |
| Date found (the record date that orders records) | `created_at` |
| Source site | `source_domain`, `source_id` |
| Citation | `credit_line` |

New columns (each `NOT NULL DEFAULT` so existing rows backfill without a rebuild):

| Column | Type and check | Default |
| --- | --- | --- |
| `origin_permission` | `permitted`, `not_permitted`, `not_applicable`, `for_admin_review` | `not_permitted` |
| `cmg_permission` | same four values | `for_admin_review` |
| `mlb_permission` | same four values | `for_admin_review` |
| `yankees_permission` | same four values | `for_admin_review` |
| `privacy_status` | same four values | `for_admin_review` |
| `final_status` | `permitted`, `not_permitted`, `for_admin_review` | `not_permitted` |
| `outcome_basis` | `origin_statement`, `email_permission`, `email_denial`, `no_response`, `fee_required`, `public_domain`, `manual_lgfc_decision`, `pending` | `pending` |
| `outcome_set_at`, `outcome_set_by` | text | null |
| `superseded_at`, `superseded_by` | text; `superseded_by` holds the newer `candidate_id` | null |
| `permission_exchange_id` | integer, references the communications table | null |

Rules:

- `final_status = 'permitted'` only when `origin_permission = 'permitted'` and each other layer is `permitted` or `not_applicable`. To be enforced by a `CHECK` or trigger; the Development migration must prove SQLite accepts the cross-column constraint on an added column, otherwise a trigger is used.
- `cmg_permission`, `mlb_permission`, `yankees_permission` and `privacy_status` default to `for_admin_review` because the scope of those layers is an open decision (below). Until the layers are decided, no record can reach `permitted`.
- One active record per origin URL: a partial unique index on `source_url` where `superseded_at IS NULL AND source_url IS NOT NULL`. Before it is created, a read-only query must list existing duplicate `source_url` values, which must be resolved first.
- `active_content_items` view: records where `superseded_at IS NULL`. Selection and publishing read this view.

### Supersession and the archive

A permission change creates a new dated record and the older one is superseded. Moving the older row into a separate archive table is risky: `rights_evidence.content_item_id` is `ON DELETE CASCADE` (migration 0079) and other child tables follow the same pattern, so deleting the old row would delete its evidence. That breaks the permanent audit.

Options:

1. **Same table (recommended).** Keep both rows in `content_items`, mark the older one `superseded_at`/`superseded_by`, and read the active ones through the view. No deletes, no cascade risk, history stays joined to its evidence. A physical archive table can be added later by copying the row and all child rows together.
2. **Physical archive table now.** Copy the old row and every child row (evidence, links) into archive tables inside one transaction before deleting. More tables, more ways to lose data.

The existing soft-delete columns (`deleted_at`, `purge_eligible_at`, `retention_reason`) conflict with permanent retention. Records in this system are never purged; the purge paths in `content-pipeline-candidate-repository.ts` and the admin editorial endpoints must not act on collected records.

### `rights_evidence` (the evidence log)

Reused as the log of what each decision was based on: the origin's wording (`evidence_text`), when it was captured (`recorded_at`), who evaluated it (`reviewer`), and the outcome (`usage_decision`, `conclusion`). New columns:

- `evidence_text_sha256` (text): hash of the origin's statement as captured, so a later change in wording is detected on re-find.
- `exchange_id` (integer): the permission exchange the evidence came from, when it is an email grant or denial.

Rows are append-only in practice for collected records: a correction is a new row.

### `sources` (searched sites)

New columns:

| Column | Meaning |
| --- | --- |
| `cost_model` | `free`, `fee`, `subscription`, `api_key`, `unknown` (default `unknown`) |
| `cost_notes`, `cost_flagged_at` | What the cost is and when it was recorded |
| `search_enabled` | 1 or 0; set to 0 for flagged cost sources so searches skip them |
| `standing`, `standing_at` | The origin's overall permit or deny for the site, which feeds each record's `origin_permission` |

### `content_search_runs` and search cycles

New table `search_cycles` (`id`, `cycle_uid`, `started_at`, `completed_at`, `admin_review_issue_number`) and `content_search_runs.cycle_id`. One admin-review Issue per cycle lists every item set to `for_admin_review` in that cycle.

## New tables

### `rights_parties` and standing history

CMG, MLB and the Yankees. Append-only rows: `party_key` (`cmg`, `mlb`, `yankees`), `standing` (`granted`, `denied`, `pending`, `unknown`), `scope_text`, `decided_at`, `exchange_id`, `recorded_by`. The current standing is the latest row per `party_key` (view `rights_party_current`). A change in standing re-evaluates affected records and writes new dated records.

### Permission communications (#4526)

- `permission_exchanges`: one per source or party: `source_id` or `party_key`, `status` (`not_sent`, `drafted`, `sent`, `reminder_1_sent`, `reminder_2_sent`, `reply_received`, `contact_incorrect`, `closed`), `attempts`, `contact_address`, `scope_requested`, `scope_granted_or_denied`, `credit_wording`, `conditions`, `opened_at`, `closed_at`.
- `permission_messages`: append-only: `exchange_id`, `direction`, `gmail_thread_id`, `gmail_message_id`, `message_date`, `from_address`, `to_addresses`, `cc_addresses`, `bcc_addresses`, `subject`, `body_text`, `attachments_json`, `recorded_at`, `recorded_by`.
- `permission_exchange_items`: links each content record to the exchange that covers it.

The schedule (attempt 1 at day 0, 2 at day 30, 3 at day 45) is computed from `permission_messages` dates and `attempts`.

### Append-only enforcement

`permission_messages`, the standing table, and `rights_evidence` rows for collected records get `BEFORE UPDATE` and `BEFORE DELETE` triggers that `RAISE(ABORT, ...)`. D1 does not enforce append-only by itself, so triggers carry it, and the application layer follows the same rule.

## Migration order (Development first)

1. Add columns to `sources`.
2. Add columns and indexes to `content_items` and `rights_evidence`; create the view. Run the duplicate `source_url` query before the unique index.
3. Create `rights_parties`, standing history and `search_cycles`.
4. Create the communications tables and triggers.

Each step is additive. Rollback is a forward fix or restore from the R2 backup, because SQLite column drops are limited. No Production run without an explicit Go.

## Backfill

Existing rows: layers per the defaults above. For rows that already carry evidence with `conclusion IN ('public_domain_confirmed','permission_granted')` and `usage_decision = 'permit'`, set `origin_permission = 'permitted'` and `outcome_basis` from the evidence type. No existing row becomes `permitted` overall until the other layers are decided. Because the site does not read `final_status` until #4528, the backfill does not change what is shown.

## Audit report

Three columns: date collected, multi-line details, final status. Filter by domain, with an as-of date.

```sql
SELECT ci.created_at                            AS date_collected,
       ci.title, ci.source_url, ci.source_domain,
       ci.origin_permission, ci.cmg_permission, ci.mlb_permission,
       ci.yankees_permission, ci.privacy_status, ci.outcome_basis,
       re.evidence_text AS origin_statement, re.recorded_at AS statement_captured_at,
       ci.final_status
FROM content_items ci
LEFT JOIN rights_evidence re
  ON re.content_item_id = ci.id
 AND re.id = (SELECT MAX(id) FROM rights_evidence WHERE content_item_id = ci.id)
WHERE ci.source_domain = :domain
  AND ci.created_at <= :as_of
  AND NOT EXISTS (SELECT 1 FROM content_items n
                  WHERE n.source_url = ci.source_url
                    AND n.created_at > ci.created_at
                    AND n.created_at <= :as_of)
ORDER BY ci.created_at;
```

The rendering (multi-line second column, PDF and CSV export) is a separate task.

## Publishing link

`content_inventory` rows carry `candidate_id` in `content_inventory_events` and link through `content_items.content_inventory_id`. The selection filter and the monitoring action (#4528) read `active_content_items.final_status`; `content_inventory_placement_history` and the events table are the usage log. No separate placements table is needed.

## Open decisions for Product Authority

1. Supersession: same table with a view (recommended) or physical archive tables.
2. CMG, MLB and Yankees scope: blanket (all Gehrig content waits) or scoped (merchandise, marks, endorsement, and party-controlled material only). Until decided, those layers default to `for_admin_review`.
3. Purge: confirm collected records are exempt from the existing purge fields.
4. Privacy layer: confirm living-person and minors criteria for `not_applicable`.
