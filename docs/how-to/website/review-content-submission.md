---
Doc Type: How-To
Audience: LGFC editors, admins, moderators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Submission queue review procedure, manual decision boundaries, and rejected-submission purge preparation
Does Not Own: Runtime moderation UI, D1 migrations, legal policy, or autonomous factual decisions
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related issues: #1256, #824, #819, #1137, #1689, #3552, #3553, #3597, #3598
Last Reviewed: 2026-08-18
---

# Review a Content Submission

## Purpose

Use this procedure to review a `submission_queue` or member intake item before it becomes approved content inventory or published media.

The queue protects the approved archive from incomplete, duplicate, unsupported, unverified, or unreviewed submissions while preserving potentially useful historical material for human editorial decisions.

## Scope

This how-to covers:

- Objective triage review for text stories and member photo uploads;
- Manual factual and editorial review;
- Reviewing member legal gates (`rights_choice`) and derived rights statements (`ownership_statement`, `permission_statement`, `credit_preference`);
- Canonical, alternate, merge, and rejection decisions;
- Media/source review and recording rights evidence conclusions;
- Running rights evidence reconciliation (#3598) for approved photos;
- Quarterly rejected-submission purge preparation.

Member intake path: see [Member content submission](./member-content-submission.md) and [Member submission review](./member-submission-review.md).
Unified workflow reference: `docs/reference/website/unified-content-workflow.md`.

## Current known truth

- Submission review covers text submissions (`submission_queue`, `POST /api/library/submit`) and binary photo uploads (`POST /api/fanclub/photos/upload`).
- Member photo uploads require explicit legal gate `rights_choice` (`member_owns_full_grant` or `external_source_needs_evaluation`) captured at intake.
- `member_owns_full_grant` uploads set `rights_hold = 0` immediately. `external_source_needs_evaluation` uploads default to `rights_hold = 1` in `media_assets` and `consent_status = 'pending'` in `member_submissions`.
- Editor or admin approval for externally-sourced uploads requires recording a formal rights evidence conclusion in `rights_evidence` and running rights evidence reconciliation (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598) to clear `rights_hold` and update `photos`.
- Rejected or held submissions remain excluded from public search, homepage rotation, fanclub gallery, and archive surfaces.

## Intended final state

- Single, integrated admin editorial queue supporting single-click review of stories, member photo uploads, and rights attestation evidence with automated rights evidence reconciliation (#3598) and purge lifecycle automation.

## Steps

1. Open the pending or triaged queue item or member submission.
2. Review objective triage flags without treating them as factual decisions.
3. Check source, attribution, credit line, `rights_choice`, and derived submitter rights statements (`ownership_statement`, `permission_statement`).
4. Search existing inventory for duplicates or matching tags.
5. Decide whether the submission should become a new canonical story, alternate perspective, merge/update, photo gallery asset, rejection, or retention hold.
6. For approved media assets, record the formal rights evidence conclusion in `rights_evidence`.
7. Execute rights evidence reconciliation (#3598) to propagate cleared status (`rights_hold = 0`) to `photos`.
8. Convert approved content to inventory or mark rejected/retained status.
9. Prepare rejected items for quarterly purge when eligible.

## Procedure

### 1. Open the queue item

Review the raw payload, submitter information, proposed title, proposed tag, source fields, media references, rights attestation fields, triage flags, and submission timestamp.

### 2. Interpret objective triage

Automation may flag:

- missing source or attestation fields;
- unsupported media type or failed magic-byte validation;
- malformed URLs;
- duplicate candidates;
- spam/risk indicators based on objective rules;
- OCR confidence;
- suggested tags or keywords.

Automation must not decide:

- whether a historical claim is true;
- whether a story should be canonical;
- whether an alternate perspective should be merged;
- whether member rights self-attestation is legally sufficient for publication;
- whether content should be published;
- whether historical material should be deleted.

### 3. Verify attribution and rights attestation

Check whether the submission includes:

- `source_name` or `submitter_name`;
- `source_url` or durable offline reference when available;
- `credit_line` or `credit_preference`;
- `ownership_statement` and `permission_statement` for member contributions;
- `rights_choice` (`member_owns_full_grant` or `external_source_needs_evaluation`) for photo uploads.

If attribution or rights attestation is incomplete but the submission may be useful, keep the item in review or request follow-up rather than publishing.

### 4. Check for duplicates and existing tags

Search approved inventory for:

- same or similar tag;
- same source;
- same event date or year;
- matching media checksum;
- existing canonical row;
- related alternate-perspective rows.

Duplicate detection is advisory. A human editor decides whether to merge, reject, or preserve an alternate perspective.

### 5. Choose the editorial outcome

| Outcome | Use when |
| --- | --- |
| New canonical story | No canonical row exists for the tag and the submission is the preferred editorial account. |
| Alternate perspective | A canonical row exists, but the submission adds attributed perspective or source context. |
| Merge/update | Useful details should update an existing inventory row. |
| Approved photo asset | Member photo upload has valid rights attestation, passes editorial review, and receives a cleared `rights_evidence` record. |
| Reject | The submission is spam, unusable, unsupported, out of scope, or lacks enough information/rights after review. |
| Retain on hold | The submission should remain reviewable beyond normal purge because of legal, moderation, source, or historical reasons. |

### 6. Review media and clear rights (#3598)

For media submissions and photo uploads (Path C):

- verify media source and credit;
- confirm B2 asset key (`LGFC_MEMBER_` prefix for member uploads);
- verify `rights_choice` and derived ownership/permission statements;
- record a cleared decision in `rights_evidence` for externally-sourced candidates;
- execute rights evidence reconciliation (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598) to clear `rights_hold = 0` on `media_assets` and update `photos` for live display.

### 7. Record decision notes

Decision notes should include:

- reviewer identity;
- decision timestamp;
- outcome;
- source, credit, or rights attestation concerns;
- canonical, alternate, or media clearance rationale;
- merge target when applicable;
- retention reason when rejected content should not be purged.

### 8. Convert, merge, or reject

Approved queue items may:

- create a new `content_inventory` row;
- create an alternate-perspective row under an existing tag;
- update or merge into an existing row;
- clear photo rights via `rights_evidence` and reconciliation (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598).

Rejected queue items remain excluded from public search, homepage rotation, archive, Fan Club library/gallery, and related content.

### 9. Prepare for quarterly purge

For rejected items, set or verify:

- rejection timestamp;
- purge eligibility date;
- retention reason when the item must remain beyond the purge cycle;
- audit notes needed for operations.

## Quarterly Purge Rules

Rejected submissions are eligible for quarterly purge unless retained for:

- legal or moderation review;
- unresolved source or rights follow-up;
- historical preservation review;
- duplicate/merge audit trail;
- operational incident investigation.

The purge process must not delete approved inventory records or published media. It applies to rejected queue intake records and must preserve any required audit trail defined by the approved implementation.

## Closeout Criteria

A reviewed submission is closed when the manual decision is recorded, useful content has been converted or merged, photo rights conclusions are recorded and reconciled (`scripts/ops/reconcile-photos-rights-from-media-assets.mjs` #3598), rejected content is isolated from public surfaces, and purge or retention metadata is complete.
