---
Doc Type: How-To
Audience: LGFC editors, admins, operators, and AI implementation agents
Authority Level: Operational Procedure
Owns: Member submission review procedure within the LGFC content candidate pipeline
Does Not Own: Runtime admin UI, D1 migrations, legal conclusions, or autonomous publication
Canonical Reference: /docs/reference/content/member-submission-content-model.md
Related issues: #2273, #2277, #2275
Last Reviewed: 2026-07-05
---

# Member Submission Review

## Purpose

Review member-submitted content candidates before they become internal reference,
publication candidates, or published inventory.

Member submissions use the shared candidate model with `input_stream =
member_submission`. They remain private until every required review gate passes.

## Scope

This how-to covers:

- intake verification;
- submitter, permission, and consent review;
- privacy review;
- rights review;
- mapping to candidate registry and `submission_queue`;
- disposition outcomes.

Out of scope: runtime upload implementation, B2 ingest, D1 migrations.

Related: [Review a content submission](./review-content-submission.md) for
operational `submission_queue` editorial workflow.

## Steps

1. Open the pending member candidate or linked `submission_queue` row.
2. Verify submitter identity and contact from session-derived records.
3. Review ownership and permission statements.
4. Review privacy flag, privacy notes, and consent status.
5. Assess relevance and factual presentation (human decision).
6. Set candidate review, rights, and privacy states.
7. Record disposition; never publish directly from candidate registry.
8. If approved for public use, route to editorial conversion per unified workflow.

## Procedure

### Intake verification

Confirm:

- `submitter_name` and `submitter_contact` match authenticated member when linked;
- `submission_type` matches content;
- required member extension fields are present per
  `member-submission-content-model.md`.

### Permission and consent

| Check | Action if failed |
| --- | --- |
| `ownership_statement` missing or unclear | `deferred_source_verification` |
| `permission_statement` denies use | `rejected` or `private_internal_only` |
| `consent_status = pending` | hold; set `admin_followup_required` |
| `consent_status = denied` | `rejected` |

### Privacy review

| `privacy_flag` | Action |
| --- | --- |
| `none` | standard review |
| `donor_member` | apply Fan Club privacy rules |
| `living_person` | verify consent or defer |
| `minors` | escalate to Bill/ChatGPT; default reject for public |
| `sensitive` | redact or `private_internal_only` |

Set `privacy_review_status` accordingly.

### Rights review

Member narratives may be owned by submitter; underlying photos may not be.

- Set `rights_status` separately for narrative vs embedded media.
- Do not set `approved_public_candidate` until rights and privacy both acceptable.

### Disposition outcomes

| Outcome | Candidate states | Next step |
| --- | --- | --- |
| Internal only | `approved_internal_reference`, `private_internal_only` | retain in registry |
| Defer | `deferred_*` | follow-up queue |
| Reject | `rejected` | purge eligibility per queue policy |
| Publication candidate | `approved_public_candidate`, `draft_candidate` | editorial conversion |

### Link to submission queue

When operational queue row exists:

- update `submission_queue.status` through admin editorial APIs;
- keep candidate `review_status` as upstream authority for pipeline planning;
- link via `submission_queue_id` on candidate record.

## Verification

1. Review pilot member example `lgfc-gehrig-2026-030` in seed registry.
2. Confirm defaults are conservative (pending review, not_ready publication).
3. Confirm no public route reads candidate JSON.

## Related documents

- Model: `docs/reference/content/member-submission-content-model.md`
- Canonical candidate: `docs/reference/content/lgfc-content-candidate-model.md`
- Queue review: `docs/how-to/website/review-content-submission.md`
