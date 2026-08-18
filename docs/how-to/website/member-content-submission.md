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
- Mandatory rights attestation (`attest_owns_rights`), ownership statements, and credit preferences;
- Server-side binary ingest validation and B2 key prefixing (`LGFC_MEMBER_`);
- Conservative default state enforcement (`rights_hold = 1` and `consent_status = pending`).

Out of scope:

- Admin editorial review and publishing steps (see [Member submission review](./member-submission-review.md));
- Photo gallery catalog management and DB schema migrations;
- Public search or homepage publication.

## Current known truth

- Authenticated members can submit text stories and upload binary photo assets (Path C).
- `POST /api/fanclub/photos/upload` enforces a strict legal gate: `attest_owns_rights` must be `true`. Submissions missing rights attestation are failed closed immediately (HTTP 400) before any file or B2 operation.
- Member photo uploads require `submitter_name`, `ownership_statement`, `permission_statement`, and `credit_preference`.
- File uploads are validated server-side for content-type allowlist, magic-byte signatures, and size limits before writing to Backblaze B2.
- Uploaded assets are written to B2 under the `LGFC_MEMBER_` key sub-prefix to visually distinguish member contributions from admin-curated assets.
- Ingested member photos always default to `rights_hold = 1` in `media_assets` and `consent_status = 'pending'` in `member_submissions`. Self-attestation is captured as evidence but does not publish the asset until an admin records a rights evidence conclusion and reconciliation runs (#3598).

## Intended final state

- Unified Fan Club member portal supporting single-step submission of rich text, multi-file photo attachments, and memorabilia scans with interactive rights attestation guidance.
- Seamless automated pipeline routing member uploads into admin candidate review queues, with automated rights evidence reconciliation (#3598) propagating approved media to live fanclub and public surfaces.

## Steps

1. Confirm the member has an active Fan Club session (`requireMember`).
2. For text submissions, open `/fanclub/submit` and fill required story fields (`name`, `title`, `content`) along with source/credit details.
3. For photo uploads, attach the image file and complete required rights attestation fields:
   - Check required `attest_owns_rights` checkbox;
   - Provide `submitter_name`, `ownership_statement`, `permission_statement`, and `credit_preference`.
4. Submit the form and verify success response with assigned candidate or submission identifier.
5. Verify the submission enters the candidate intake queue with conservative defaults (`rights_hold = 1`, `consent_status = pending`).

## Procedure

### Session gate

Member submission routes require member authentication (`useMemberSession` / `requireMember`). Guests are redirected per Fan Club layout policy. Client-supplied email values are not trusted; email is derived from the authenticated session.

### Text submission intake

Required JSON payload for `POST /api/library/submit` and `POST /api/library/content-pipeline/submit`:

| Field | Required | Notes |
| --- | --- | --- |
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

1. **Rights Attestation Gate:** The request body/form-data MUST include `attest_owns_rights = true`. If omitted or false, the backend rejects the request immediately with status 400.
2. **Metadata Validation:** `submitter_name`, `ownership_statement`, `permission_statement`, and `credit_preference` must all be populated.
3. **File Ingest Validation:** Server inspects file magic bytes, MIME type (JPEG, PNG, WebP), and file size against safety thresholds.
4. **B2 Storage:** Validated binary files are saved in B2 under `LGFC_MEMBER_<uuid>_<filename>`.
5. **D1 Record Creation:** `content_items` (stream `member_submission`), `submitters`, `member_submissions` (`consent_status = 'pending'`), and `media_assets` (`rights_hold = 1`) records are created atomically.

### Conservative default states

- **Self-attestation captured, never self-granted:** Member self-attestation is recorded as legal evidence (`ownership_statement`, `permission_statement`).
- **Default Hold:** Assets are stored with `rights_hold = 1` and `publication_status = 'not_ready'`.
- **Admin Review Required:** An admin must review the submission, record a formal rights evidence conclusion, and execute reconciliation (#3598) before the photo can appear on public or member gallery surfaces.

## Verification

1. Submit test content as an authenticated member test account.
2. Attempt photo upload without `attest_owns_rights` checked; confirm HTTP 400 rejection.
3. Submit photo upload with valid file and checked rights attestation; confirm HTTP 200/201 response.
4. Verify created `media_assets` record has `rights_hold = 1` and B2 key uses `LGFC_MEMBER_` sub-prefix.
5. Confirm public gallery and library routes do not show the unapproved upload.

## Related Documents

- Member submission content model: `docs/reference/content/member-submission-content-model.md`
- Member submission review procedure: `docs/how-to/website/member-submission-review.md`
- Editorial submission review procedure: `docs/how-to/website/review-content-submission.md`
- Unified workflow: `docs/reference/website/unified-content-workflow.md`
