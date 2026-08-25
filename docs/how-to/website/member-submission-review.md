---
Doc Type: How-To
Audience: LGFC editors, admins, operators, and AI implementation agents
Authority Level: Operational Procedure
Owns: Member submission review procedure within the LGFC content candidate pipeline
Does Not Own: Runtime admin UI, D1 migrations, legal policy decisions, or autonomous publication
Canonical Reference: /docs/reference/content/member-submission-content-model.md
Related issues: #2273, #2277, #2275, #3552, #3553, #3597, #3598
Last Reviewed: 2026-08-18
---

# Member Submission Review

## Purpose

Review member-submitted text stories and uploaded photo candidates before they become internal reference, publication candidates, or published gallery inventory.

Member submissions use the candidate model with `input_stream = member_submission`. All submissions (including binary photo uploads) remain private and held (`rights_hold = 1`, `consent_status = pending`) until every required review gate and rights evidence reconciliation pass.

## Scope

This how-to covers:

- Intake verification for member text stories and uploaded photo binaries;
- Verification of member legal gates (`rights_choice`) and derived rights statements;
- Inspection of B2-stored assets (`LGFC_MEMBER_` sub-prefix);
- Recording formal rights evidence conclusions in `rights_evidence`;
- Executing rights evidence reconciliation (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598) to clear `rights_hold` and surface approved photos;
- Privacy, consent, and disposition outcomes.

Out of scope: runtime upload implementation, B2 infrastructure setup, D1 migrations.

Related: [Review a content submission](./review-content-submission.md) for operational `submission_queue` editorial review.

## Current known truth

- Member photo uploads (Path C) arrive with `rights_choice` (`member_owns_full_grant` or `external_source_needs_evaluation`) and `credit_preference`, stored in B2 under `LGFC_MEMBER_` key prefixes.
- `member_owns_full_grant` uploads set `rights_hold = 0` immediately and record full grant evidence conclusions. `external_source_needs_evaluation` uploads enter `media_assets` with `rights_hold = 1` and `member_submissions.consent_status = 'pending'`.
- Submissions selecting `external_source_needs_evaluation` require an admin to inspect the upload, evaluate the provided `source_url`, and write a formal conclusion record into `rights_evidence`.
- Running rights evidence reconciliation (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598) evaluates `rights_evidence` records and updates cleared `media_assets` (`rights_hold = 0`) and `photos` records for live display.

## Intended final state

- Streamlined admin review portal enabling side-by-side inspection of member photo uploads, submitter rights statements, and automated rights evidence reconciliation (#3598) with full audit logging.

## Steps

1. Open the pending member candidate, `member_submissions` record, or linked media asset.
2. Verify submitter identity and contact from session-derived records.
3. Inspect submitter self-attestation (`ownership_statement`, `permission_statement`, `credit_preference`).
4. For photo uploads, inspect the B2 file object (`LGFC_MEMBER_` prefix) and verify media quality and content appropriateness.
5. Perform privacy and living-person review.
6. Record formal admin conclusion in `rights_evidence` (e.g., `cleared_public`, `cleared_member_only`, or `rejected`).
7. Execute rights evidence reconciliation (#3598) to propagate approved conclusions into `media_assets` (`rights_hold = 0`) and `photos`.
8. Confirm approved photos appear in member gallery surfaces while rejected/held items remain private.

## Procedure

### 1. Intake and attestation verification

Confirm:

- `submitter_name` and `submitter_contact` match authenticated session data;
- `rights_choice` is recorded (`member_owns_full_grant` or `external_source_needs_evaluation`);
- Derived `ownership_statement` and `permission_statement` provide clear legal basis for LGFC usage;
- `credit_preference` is documented (`public_credit`, `anonymous`, etc.).

| Check | Action if failed |
| --- | --- |
| `ownership_statement` missing or ambiguous | Set `admin_followup_required = true`; defer review |
| `permission_statement` denies or restricts usage | Mark `consent_status = denied` / set candidate state to `rejected` |
| `rights_choice` missing or invalid | Invalid intake; reject or purge candidate |

### 2. Media asset inspection (Path C uploads)

For uploaded photo binaries stored under `LGFC_MEMBER_` prefixes:

- Download or preview the asset from B2 storage;
- Verify image subject matches title and description;
- Check for copyright watermarks, third-party publication marks, or living-person privacy concerns.

### 3. Privacy review

| `privacy_flag` | Operational rule |
| --- | --- |
| `none` | Standard review path |
| `donor_member` | Apply Fan Club privacy and attribution preferences |
| `living_person` | Verify explicit consent from subject or restrict display |
| `minors` | Escalate to Product/Legal Authority; default reject for public display |
| `sensitive` | Redact or mark `private_internal_only` |

### 4. Record rights evidence conclusion

Admin review conclusions must be written to `rights_evidence`:

- Insert `rights_evidence` row specifying `media_asset_id` or `content_item_id`;
- Set `conclusion` to `cleared_public`, `cleared_member_only`, `permission_needed`, or `rejected`;
- Record reviewer identity, timestamp, and verification rationale.

### 5. Execute rights evidence reconciliation (#3598)

Once `rights_evidence` is recorded:

- Trigger/run the canonical rights evidence reconciliation handler (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598);
- Reconciliation verifies that `rights_evidence.conclusion` is cleared;
- Updates `media_assets.rights_hold` from `1` to `0`;
- Updates corresponding `photos` table row to make the photo accessible on member gallery / public surfaces.

## Verification

1. Inspect pending test member submission `lgfc-gehrig-2026-001`.
2. Confirm initial state is `rights_hold = 1` and `consent_status = pending`.
3. Record a test cleared conclusion in `rights_evidence`.
4. Run rights evidence reconciliation (#3598); confirm `media_assets.rights_hold` changes to `0`.
5. Verify photo becomes queryable on member photo routes (`/fanclub/photo`).

## Related documents

- Content model: `docs/reference/content/member-submission-content-model.md`
- Submission intake procedure: `docs/how-to/website/member-content-submission.md`
- Queue review procedure: `docs/how-to/website/review-content-submission.md`
