---
Doc Type: How-To
Audience: LGFC operators, member-support staff, editors, and AI implementation agents
Authority Level: Operational Procedure
Owns: Member content submission path from `/fanclub/submit` through `submission_queue` intake
Does Not Own: Editorial approval decisions, binary media upload implementation, or publication into `content_inventory`
Canonical Reference: /docs/reference/website/unified-content-workflow.md
Related issues: #1689, #1685, #1256
Last Reviewed: 2026-06-23
---

# Member Content Submission

## Purpose

Document the authenticated member path for contributing stories or notes to the
Lou Gehrig Fan Club editorial intake queue.

Member submissions are **intake only**. Publication requires editor review through
the unified editorial workflow.

## Scope

This how-to covers:

- `/fanclub/submit` member route;
- `POST /api/library/submit` request fields;
- queue status after submit;
- source/credit expectations;
- current text-only scope and deferred binary upload.

Out of scope:

- editor review and publish steps (see [Review a content submission](./review-content-submission.md));
- photo gallery catalog management;
- moderation, FAQ, or discussion lanes.

## Steps

1. Confirm the member has an active Fan Club session.
2. Open `/fanclub/submit`.
3. Complete required fields (`name`, `title`, `content`) and source/credit fields.
4. Submit the form and confirm success messaging.
5. Verify the item appears in the admin editorial review queue as `pending`.
6. Inform the member that publication requires editorial review.

## Procedure

### Session gate

`/fanclub/submit` requires member authentication. Guests are redirected per Fan
Club layout policy.

### Submit the form

Required JSON/body fields for `POST /api/library/submit`:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Display name for attribution |
| `title` | yes | Submission title |
| `content` | yes | Story or note body |
| `source_name` | recommended | Original source name |
| `source_url` | recommended | Reference URL when available |
| `credit_line` | recommended | Credit/rights line for editors |
| `proposed_tag` | optional | Slugified tag suggestion; defaults from title |
| `media_url` | optional | Reference string only today |
| `media_reference` | optional | Alias/reference for editors |

The member email is taken from the authenticated session. Client-supplied email
values are not trusted.

### After submit

- A new `submission_queue` row is created with `status = pending`.
- The submission does **not** appear on public or Fan Club library surfaces until
  an editor publishes an approved `content_inventory` record.
- Editors process the item through `/admin/editorial` per
  [Review a content submission](./review-content-submission.md).

### Text-only scope (current)

As-built member intake supports **text submissions** and optional media reference
strings. Binary photo or PDF upload to B2 is **not** available on this path.

Operators should set member expectations accordingly:

- Photo Gallery CTAs that reference sharing may route here for story/context
  intake until binary upload is implemented.
- Visual assets already in the legacy `photos` catalog are operator-managed and
  separate from this queue path.

### Deferred capabilities

Binary upload, direct photo promotion into `photos`, and PDF attachment intake
are deferred to later implementation tasks after Task 004 workflow
reconciliation. Do not promise immediate gallery publication from this form.

## Verification

1. Submit test content as a member test account.
2. Confirm API returns success and queue row exists (`pending`).
3. Confirm the submission is visible in admin editorial review.
4. Confirm public library and Club Home do not show the unpublished item.

## Related Documents

- Unified workflow: `docs/reference/website/unified-content-workflow.md`
- Editor review: `docs/how-to/website/review-content-submission.md`
- Fan Club operator paths: `docs/how-to/website/fanclub-operational-workflows.md`
