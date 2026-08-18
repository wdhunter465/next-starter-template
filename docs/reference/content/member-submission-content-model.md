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
- `attest_owns_rights` legal gate and consent metadata structure;
- B2 object storage key prefixing (`LGFC_MEMBER_`);
- Default conservative status flags (`rights_hold = 1`, `consent_status = pending`);
- Rights evidence reconciliation model (#3598) for cleared media assets.

## Current known truth

- Member content intake supports both text submissions (`POST /api/library/content-pipeline/submit`) and binary photo uploads (`POST /api/fanclub/photos/upload`).
- Binary photo upload requests require `attest_owns_rights = true` alongside submitter attribution and consent fields (`submitter_name`, `ownership_statement`, `permission_statement`, `credit_preference`).
- Validated photo uploads are saved in B2 under `LGFC_MEMBER_<uuid>_<filename>` and indexed in `media_assets` with default `rights_hold = 1`.
- `member_submissions.consent_status` defaults to `pending`. Self-attestation is stored as legal evidence but does not publish content automatically.
- Admin rights evidence conclusions in `rights_evidence` are propagated into `photos` via rights evidence reconciliation (#3598).

## Intended final state

- Fully normalized multi-media member submission schema supporting stories, high-resolution photo archives, and memorabilia scans with automated rights validation and candidate pipeline conversion.

## Input stream

All member submissions use `input_stream = member_submission` in the canonical candidate model.

## Submission types

| Type | Description | Runtime status | Example |
| --- | --- | --- | --- |
| `story` | Personal or family memory | Active via submit API | Grandparent attended a Gehrig game in 1938 |
| `photo` | Photo upload with rights attestation | Active via Path C endpoint | Scan of family photo (`POST /api/fanclub/photos/upload`) |
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
| `attest_owns_rights` | Required for photo upload | Boolean gate; must be `true` at endpoint |
| `ownership_statement` | Required | Declaration of ownership or lawful rights |
| `permission_statement` | Required | Explicit grant of usage rights to LGFC |
| `credit_preference` | Required | `public_credit`, `anonymous`, `private`, or `custom` |
| `consent_status` | Required | Default `pending` |
| `admin_followup_required` | Required boolean | Set to `true` on intake |

Optional: `privacy_notes`, `uploaded_media_reference`, `related_candidate_id`, `submitter_id`.

## Storage and keying model

| Asset type | Ingest endpoint | Storage location | Key format / prefix |
| --- | --- | --- | --- |
| Text story | `POST /api/library/content-pipeline/submit` | D1 `content_items` / `member_submissions` | Candidate ID `lgfc-gehrig-YYYY-NNN` |
| Member photo | `POST /api/fanclub/photos/upload` | Backblaze B2 + D1 `media_assets` | `LGFC_MEMBER_<uuid>_<filename>` |
| Admin photo (Path B) | `POST /api/admin/content-pipeline/ingest` | Backblaze B2 + D1 `media_assets` | `LGFC_<uuid>_<filename>` |

## Default states on intake

| Dimension | Default value | Legal / pipeline effect |
| --- | --- | --- |
| `review_status` | `pending_review` | Excluded from public search/display |
| `rights_status` | `permission_needed` | Requires admin verification |
| `rights_hold` | `1` (true) | Media asset blocked from public gallery |
| `source_trust_status` | `pending` | Source unverified |
| `publication_status` | `not_ready` | Cannot be published |
| `consent_status` | `pending` | Member self-attestation pending admin review |

## Rights evidence reconciliation (#3598)

When an admin reviews a member photo submission and records a verified conclusion in `rights_evidence`:

1. `rights_evidence` records the formal determination (e.g., `cleared_public`).
2. Rights evidence reconciliation script/trigger evaluates `rights_evidence` records against `media_assets` and `member_submissions`.
3. Upon clearance, `media_assets.rights_hold` updates to `0` and corresponding `photos` table rows are updated to enable live surface display.

## Cross-references

- Canonical model: `docs/reference/content/lgfc-content-candidate-model.md`
- Submission review: `docs/how-to/website/member-submission-review.md`
- Member submit procedure: `docs/how-to/website/member-content-submission.md`
