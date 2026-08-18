---
Doc Type: How-To
Audience: LGFC editors, admins, moderators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Submission queue review procedure, manual decision boundaries, and rejected-submission purge preparation
Does Not Own: Runtime moderation UI, D1 migrations, legal policy, or autonomous factual decisions
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related issues: #1256, #824, #819, #1137, #1689
Last Reviewed: 2026-06-23
---

# Review a Content Submission

## Purpose

Use this procedure to review a `submission_queue` item before it becomes
approved content inventory.

The queue protects the approved archive from incomplete, duplicate, unsupported,
or unreviewed submissions while preserving potentially useful historical
material for human editorial decisions.

## Scope

This how-to covers:

- objective triage review;
- manual factual/editorial review;
- canonical, alternate, merge, and rejection decisions;
- media/source review;
- quarterly rejected-submission purge preparation.

Member intake path: see [Member content submission](./member-content-submission.md).
Unified workflow reference: `docs/reference/website/unified-content-workflow.md`.

## Steps

1. Open the pending or triaged queue item.
2. Review objective triage flags without treating them as factual decisions.
3. Check source, URL/reference, and credit-line completeness.
4. Search existing inventory for duplicates or matching tags.
5. Decide whether the submission should become a new canonical story, alternate
   perspective, merge/update, rejection, or retention hold.
6. Review media references and attribution.
7. Record the manual decision and notes.
8. Convert approved content to inventory or mark rejected/retained status.
9. Prepare rejected items for quarterly purge when eligible.

## Procedure

### 1. Open the queue item

Review the raw payload, submitter information, proposed title, proposed tag,
source fields, media references, triage flags, and submission timestamp.

### 2. Interpret objective triage

Automation may flag:

- missing source fields;
- unsupported media type;
- malformed URLs;
- duplicate candidates;
- spam/risk indicators based on objective rules;
- OCR confidence;
- suggested tags or keywords.

Automation must not decide:

- whether a historical claim is true;
- whether a story should be canonical;
- whether an alternate perspective should be merged;
- whether content should be published;
- whether historical material should be deleted.

### 3. Verify attribution

Check whether the submission includes:

- `source_name`;
- `source_url` or durable offline reference when available;
- `credit_line`;
- contributor or collection details;
- media-specific attribution when media is included.

If attribution is incomplete but the submission may be useful, keep the item in
review or request follow-up rather than publishing.

### 4. Check for duplicates and existing tags

Search approved inventory for:

- same or similar tag;
- same source;
- same event date or year;
- matching media;
- existing canonical row;
- related alternate-perspective rows.

Duplicate detection is advisory. A human editor decides whether to merge,
reject, or preserve an alternate perspective.

### 5. Choose the editorial outcome

| Outcome | Use when |
|---|---|
| New canonical story | No canonical row exists for the tag and the submission is the preferred editorial account. |
| Alternate perspective | A canonical row exists, but the submission adds attributed perspective or source context. |
| Merge/update | Useful details should update an existing inventory row. |
| Reject | The submission is spam, unusable, unsupported, out of scope, or lacks enough information after review. |
| Retain on hold | The submission should remain reviewable beyond normal purge because of legal, moderation, source, or historical reasons. |

### 6. Review media

For media submissions:

- verify media source and credit;
- identify media role;
- confirm whether the media should attach to a new or existing story;
- preserve OCR/source images when historically useful;
- avoid creating media-only editorial records.

### 7. Record decision notes

Decision notes should include:

- reviewer identity;
- decision timestamp;
- outcome;
- source/credit concerns;
- canonical or alternate rationale;
- merge target when applicable;
- media decision;
- retention reason when rejected content should not be purged.

### 8. Convert, merge, or reject

Approved queue items may:

- create a new `content_inventory` row;
- create an alternate-perspective row under an existing tag;
- update or merge into an existing row;
- create or update story-media associations.

Rejected queue items remain excluded from public search, homepage rotation,
archive, Fan Club library, and related content.

### 9. Prepare for quarterly purge

For rejected items, set or verify:

- rejection timestamp;
- purge eligibility date;
- retention reason when the item must remain beyond the purge cycle;
- audit notes needed for operations.

## Quarterly Purge Rules

Rejected submissions are eligible for quarterly purge unless retained for:

- legal or moderation review;
- unresolved source follow-up;
- historical preservation review;
- duplicate/merge audit trail;
- operational incident investigation.

The purge process must not delete approved inventory records or published media.
It applies to rejected queue intake records and must preserve any required audit
trail defined by the approved implementation.

## Closeout Criteria

A reviewed submission is closed when the manual decision is recorded, useful
content has been converted or merged, rejected content is isolated from public
surfaces, and purge or retention metadata is complete.
