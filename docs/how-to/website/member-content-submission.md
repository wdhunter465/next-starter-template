---
Doc Type: How-To
Audience: LGFC operators, member-support staff, editors, and AI implementation agents
Authority Level: Operational Procedure
Owns: Member content submission path from `/fanclub/submit` through `submission_queue` and candidate intake
Does Not Own: Editorial approval decisions, admin UI implementation, or publication into `content_inventory`
Canonical Reference: /docs/reference/website/unified-content-workflow.md
Related issues: #1689, #1685, #1256, #3552, #3553, #3597, #3598
Last Reviewed: 2026-08-18
---

# Member Content Submission

## Purpose

Document the authenticated member path for contributing stories, historical notes, and photo uploads to the
Lou Gehrig Fan Club editorial and candidate intake queue with required rights attestation.

Member submissions are **intake only**. Self-attestation is recorded as legal evidence but never self-grants publication.
Publication requires editor review and rights evidence reconciliation through the unified workflow.

## Scope

This how-to covers:

- `/fanclub/submit` member route and session authentication;
- Text submission intake via `POST /api/library/submit` and `POST /api/library/content-pipeline/submit`;
- Member photo upload intake via `POST /api/fanclub/photos/upload` (Path C);
- Mandatory legal gate `rights_choice` (`member_owns_full_grant` | `external_source_needs_evaluation`), submitter attribution, and credit preferences;
- Server-side binary ingest validation and B2 key prefixing (`LGFC_MEMBER_`);
- Rights hold state rules (`rights_hold = 0` for immediate `member_owns_full_grant`; `rights_hold = 1` and `consent_status = pending` for `external_source_needs_evaluation`).

Out of scope:

- Admin editorial review and publishing steps (see [Member submission review](./member-submission-review.md));
- Photo gallery catalog management and DB schema migrations;
- Public search or homepage publication.

## Current known truth

- Authenticated members can submit text stories and upload binary photo assets (Path C).
- `POST /api/fanclub/photos/upload` enforces a strict legal gate: `rights_choice` must be `member_owns_full_grant` or `external_source_needs_evaluation`. Submissions missing or invalid `rights_choice` (or missing `source_url` when `external_source_needs_evaluation` is selected) fail closed immediately (HTTP 400) before any file or B2 operation.
- Member photo uploads require `submitter_name` and `credit_preference`. Request fields do not collect `ownership_statement` or `permission_statement`; those strings are derived in `functions/_lib/member-photo-submission-repository.ts` based on `rights_choice`.
- File uploads are validated server-side for content-type allowlist, magic-byte signatures, and size limits before writing to Backblaze B2.
- Uploaded assets are written to B2 under the `LGFC_MEMBER_` key sub-prefix to visually distinguish member contributions from admin-curated assets.
- `member_owns_full_grant` sets `rights_hold = 0` immediately and records a full grant evidence conclusion; `external_source_needs_evaluation` sets `rights_hold = 1` in `media_assets` and `consent_status = 'pending'` in `member_submissions` until an admin records a rights evidence conclusion and reconciliation runs (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598).

## Intended final state

- Unified Fan Club member portal supporting single-step submission of rich text, multi-file photo attachments, and memorabilia scans with interactive rights attestation guidance.
- Seamless automated pipeline routing member uploads into admin candidate review queues, with automated rights evidence reconciliation (#3598) propagating approved media to live fanclub and public surfaces.

## Steps

1. Confirm the member has an active Fan Club session (`requireMember`).
2. For text submissions, open `/fanclub/submit` and fill required story fields (`name`, `title`, `content`) along with source/credit details.
3. For photo uploads, attach the image file and complete required fields:
   - Select `rights_choice` (`member_owns_full_grant` or `external_source_needs_evaluation` with `source_url`);
   - Provide `submitter_name` and `credit_preference`.
4. Submit the form and verify success response with assigned candidate or submission identifier.
5. Verify the submission rights hold state (`rights_hold = 0` for `member_owns_full_grant`; `rights_hold = 1` for `external_source_needs_evaluation`).

## Procedure

### Session gate

Member submission routes require member authentication (`useMemberSession` / `requireMember`). Guests are redirected per Fan Club layout policy. Client-supplied email values are not trusted; email is derived from the authenticated session.

### Text submission intake

Required JSON payload for `POST /api/library/submit` and `POST /api/library/content-pipeline/submit`:

| Field | Required | Notes |
| --- | --- | --- |
| `submission_type` | yes | Required on `content-pipeline/submit` (`story`, `photo`, `memorabilia`, etc.) |
| `name` / `submitter_name` | yes | Display name for attribution |
| `title` | yes | Submission title |
| `content` / `summary` | yes | Story or note body |
| `ownership_statement` | yes | Submitter declaration of ownership or rights |
| `permission_statement` | yes | Submitter grant of usage permission to LGFC |
| `credit_preference` | yes | `public_credit`, `anonymous`, `private`, or `custom` |
| `source_name` | optional | Original source name |
| `source_url` | optional | Reference URL |

### Photo upload intake (Path C)

For binary photo uploads to `POST /api/fanclub/photos/upload`:

1. **Rights Choice Legal Gate:** Request body/form-data MUST include `rights_choice` (`member_owns_full_grant` or `external_source_needs_evaluation`). If omitted, invalid, or missing `source_url` when `external_source_needs_evaluation` is selected, the backend rejects the request immediately with status 400.
2. **Metadata Validation:** `submitter_name` and `credit_preference` must be populated. Photo uploads do not collect `ownership_statement` or `permission_statement` request fields; statements are derived in `functions/_lib/member-photo-submission-repository.ts` from `rights_choice`.
3. **File Ingest Validation:** Server inspects file magic bytes, MIME type (JPEG, PNG, WebP), and file size against safety thresholds.
4. **B2 Storage:** Validated binary files are saved in B2 under `LGFC_MEMBER_<uuid>_<filename>`.
5. **D1 Record Creation:** `content_items` (stream `member_submission`), `submitters`, `member_submissions`, and `media_assets` records are created atomically. If `rights_choice` is `member_owns_full_grant`, `rights_hold = 0` is set immediately and `rights_evidence` records `lgfc_member_owned_item_photo`. If `external_source_needs_evaluation`, `rights_hold = 1` is set with `consent_status = pending`.

### Rights hold and review rules

- **Member Owns Full Grant (`member_owns_full_grant`):** Sets `rights_hold = 0` immediately and records `lgfc_member_owned_item_photo` evidence. Does not require a separate admin review step before syncing to site.
- **External Source (`external_source_needs_evaluation`):** Stored with `rights_hold = 1` and `consent_status = 'pending'`. An admin must review the submission, record a formal rights evidence conclusion, and run reconciliation (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598) before the photo can clear rights hold.

## Verification

1. Submit test content as an authenticated member test account.
2. Attempt photo upload without `rights_choice`; confirm HTTP 400 rejection.
3. Submit photo upload with valid file, `rights_choice = member_owns_full_grant`, `submitter_name`, and `credit_preference`; confirm HTTP 200 response and `rights_hold = 0`.
4. Confirm `external_source_needs_evaluation` photo upload sets `rights_hold = 1` and B2 key uses `LGFC_MEMBER_` sub-prefix.
5. Confirm public gallery and library routes do not show unapproved held uploads (`rights_hold = 1`).

## Related Documents

- Member submission content model: `docs/reference/content/member-submission-content-model.md`
- Member submission review procedure: `docs/how-to/website/member-submission-review.md`
- Editorial submission review procedure: `docs/how-to/website/review-content-submission.md`
- Unified workflow: `docs/reference/website/unified-content-workflow.md`
