# PR Summary

- **Issue:** #3634
- Related exception: #3699
- Intent label: intent:docs
- PR class: docs-content
- Size: small
- Delivery model: A
- Change mode: routine-ops
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: production-candidate
- Rollback profile: one-step
- Implementation agent: Jules

## Scope

Allowed paths:
- `docs/how-to/website/member-submission-review.md`
- `docs/how-to/website/member-content-submission.md`
- `docs/reference/content/member-submission-content-model.md`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

PR #3698 aligned member-submission documentation with runtime `rights_choice` behavior. Exception #3699 captured six late Copilot findings that were not dispositioned before merge. The bounded #3699 remediation updates the same three documentation surfaces to remove remaining contradictions and records explicit dispositions below.

## Acceptance Criteria

- [x] All six late reviewer findings are reconciled.
- [x] Documentation distinguishes immediate `member_owns_full_grant` rights clearance from held external-source evaluation.
- [x] Verification targets both rights paths.
- [x] Invalid `rights_choice` sequencing matches runtime behavior: fail before reading bytes/B2 write, not necessarily before file-field presence validation.
- [x] `rights_choice` requirement is documented for member content-pipeline intake, not only photo upload.
- [x] Privacy/follow-up override for full-grant submissions is documented.

Follow-up issue required: YES
Follow-up issue if required: #3699

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3852925897 — accepted — opening review procedure now states rights state is conditional on `rights_choice`; full-grant clears rights immediately while external-source submissions remain held. — thread state: outdated
- review-comment:3852925943 — accepted — verification now explicitly tests `external_source_needs_evaluation` for the held initial state and separately verifies `member_owns_full_grant` begins with `rights_hold = 0`. — thread state: outdated
- review-comment:3852925976 — accepted — submission procedure no longer claims self-attestation can never clear rights; it distinguishes immediate full-grant rights clearance from independent privacy/content/publication gates. — thread state: outdated
- review-comment:3852926014 — accepted — failure-order wording now states invalid rights choice fails before reading file bytes or writing B2, while acknowledging a file-presence check may occur first. — thread state: outdated
- review-comment:3852926064 — accepted — content model/procedure now document `rights_choice` as required for member `POST /api/library/content-pipeline/submit` intake as well as Path C photo uploads. — thread state: outdated
- review-comment:3852926090 — accepted — rights-state table now documents privacy/independent-review overrides that can leave a full-grant submission `pending_review` with `admin_followup_required = true`. — thread state: outdated

## Post-merge remediation record

Exception #3699 is remediated on branch `fix/3699-member-submission-doc-findings`; substantive documentation corrections and all six canonical dispositions are kept together for deterministic closeout.
