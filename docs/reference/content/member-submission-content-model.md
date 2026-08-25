---
Doc Type: Reference
Audience: Bill, ChatGPT, Cursor, LGFC operators, editors, and implementation agents
Authority Level: Controlled
Owns: Member submission intake field and state model for the LGFC content pipeline
Does Not Own: Upload runtime, B2 configuration, D1 migrations, or admin UI implementation
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related issues: #2273, #2277, #2275, #3552, #3553, #3597, #3598
Last Reviewed: 2026-08-18
---

# Member Submission Content Model

## Purpose

Define how LGFC member submissions (text stories and photo uploads) enter the upstream candidate pipeline with strict rights attestation controls, remaining private until reviewed and reconciled.

## Scope

This reference specifies:

- `input_stream = member_submission` schema mapping and required member extension fields;
- `photo` submission type runtime capabilities (`POST /api/fanclub/photos/upload`);
- `rights_choice` (`member_owns_full_grant` | `external_source_needs_evaluation`) legal gate and consent metadata structure;
- B2 object storage key prefixing (`LGFC_MEMBER_`);
- Status flags and rights hold rules (`rights_hold = 0` for `member_owns_full_grant`; `rights_hold = 1` and `consent_status = pending` for `external_source_needs_evaluation`);
- Rights evidence reconciliation model (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598) for cleared media assets.

## Current known truth

- Member content intake supports both text submissions (`POST /api/library/content-pipeline/submit`) and binary photo uploads (`POST /api/fanclub/photos/upload`).
- Binary photo upload requests require legal gate `rights_choice` (`member_owns_full_grant` or `external_source_needs_evaluation`) alongside submitter attribution and credit fields (`submitter_name`, `credit_preference`). Request fields do not collect `ownership_statement` or `permission_statement`; those strings are derived in `functions/_lib/member-photo-submission-repository.ts`.
- Validated photo uploads are saved in B2 under `LGFC_MEMBER_<uuid>_<filename>` and indexed in `media_assets`.
- `member_owns_full_grant` uploads set `rights_hold = 0` immediately and record full grant evidence conclusions. `external_source_needs_evaluation` uploads set `rights_hold = 1` and `consent_status = 'pending'`.
- Admin rights evidence conclusions in `rights_evidence` are propagated into `photos` via rights evidence reconciliation (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598).

## Intended final state

- Fully normalized multi-media member submission schema supporting stories, high-resolution photo archives, and memorabilia scans with automated rights validation and candidate pipeline conversion.

## Input stream

All member submissions use `input_stream = member_submission` in the canonical candidate model.

## Submission types

| Type | Description | Runtime status | Example |
| --- | --- | --- | --- |
| `story` | Personal or family memory | Active via submit API | Grandparent attended a Gehrig game in 1938 |
| `photo` | Photo upload with `rights_choice` gate | Active via Path C endpoint | Scan of family photo (`POST /api/fanclub/photos/upload`) |
| `memorabilia` | Memorabilia image or description | Active via photo or text intake | Program, ticket stub |
| `correction` | Factual correction to existing content | Text intake | Date correction |
| `identification` | People/place/date/object ID | Text intake | Names someone in archive photo |
| `source_lead` | Points to external source | Text intake | Newspaper clipping location |
| `historical_note` | Supporting historical context | Text intake | Background on an event |

## Required member extension fields

See `member_submission` object in canonical model:

| Field | Requirement | Operational rule |
| --- | --- | --- |
| `submitter_name` | Required | Display name for attribution |
| `submitter_contact` | Required | Derived from authenticated session (`requireMember`) |
| `submission_type` | Required | `story`, `photo`, `memorabilia`, etc. |
| `rights_choice` | Required for photo upload | Legal gate enum: `member_owns_full_grant` \| `external_source_needs_evaluation` |
| `ownership_statement` | Derived | Generated in repository helper based on `rights_choice` |
| `permission_statement` | Derived | Generated in repository helper based on `rights_choice` |
| `credit_preference` | Required | `public_credit`, `anonymous`, `private`, or `custom` |
| `consent_status` | Required | Derived (`granted` for `member_owns_full_grant`; `pending` for `external_source_needs_evaluation`) |
| `admin_followup_required` | Required boolean | Derived (`false` for `member_owns_full_grant`; `true` for `external_source_needs_evaluation`) |

Optional: `privacy_notes`, `uploaded_media_reference`, `related_candidate_id`, `submitter_id`.

## Storage and keying model

| Asset type | Ingest endpoint | Storage location | Key format / prefix |
| --- | --- | --- | --- |
| Text story | `POST /api/library/content-pipeline/submit` | D1 `content_items` / `member_submissions` | Candidate ID `lgfc-gehrig-YYYY-NNN` |
| Member photo | `POST /api/fanclub/photos/upload` | Backblaze B2 + D1 `media_assets` | `LGFC_MEMBER_<uuid>_<filename>` |
| Admin photo (Path B) | `POST /api/admin/content-pipeline/ingest` | Backblaze B2 + D1 `media_assets` | `LGFC_<uuid>_<filename>` |

## States on intake by `rights_choice`

| Dimension | `member_owns_full_grant` | `external_source_needs_evaluation` |
| --- | --- | --- |
| `review_status` | `approved_public_candidate` | `pending_review` |
| `rights_status` | `permission_granted` | `permission_needed` |
| `rights_hold` | `0` (false) | `1` (true) |
| `consent_status` | `granted` | `pending` |
| `admin_followup_required` | `false` | `true` |
| `rights_evidence` | `lgfc_member_owned_item_photo` recorded | Pending evaluation (`conclusion = null`) |

## Rights evidence reconciliation (#3598)

When an admin reviews an externally-sourced member photo submission (`external_source_needs_evaluation`) and records a verified conclusion in `rights_evidence`:

1. `rights_evidence` records the formal determination (e.g., `cleared_public`).
2. Rights evidence reconciliation script (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598) evaluates `rights_evidence` records against `media_assets` and `member_submissions`.
3. Upon clearance, `media_assets.rights_hold` updates to `0` and corresponding `photos` table rows are updated to enable live surface display.

## Cross-references

- Canonical model: `docs/reference/content/lgfc-content-candidate-model.md`
- Submission review: `docs/how-to/website/member-submission-review.md`
- Member submit procedure: `docs/how-to/website/member-content-submission.md`
