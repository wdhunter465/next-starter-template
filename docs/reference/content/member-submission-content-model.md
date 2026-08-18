---
Doc Type: Reference
Audience: Bill, ChatGPT, Cursor, LGFC operators, editors, and implementation agents
Authority Level: Controlled
Owns: Member submission intake field and state model for the LGFC content pipeline
Does Not Own: Upload runtime, B2 configuration, D1 migrations, or admin UI implementation
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related issues: #2273, #2277, #2275
Last Reviewed: 2026-07-05
---

# Member Submission Content Model

## Purpose

Define how LGFC member submissions enter the same upstream candidate pipeline as
public research and admin seed records while remaining private until reviewed.

## Input stream

All member submissions use `input_stream = member_submission` in the canonical
candidate model.

## Submission types

| Type | Description | Example |
| --- | --- | --- |
| `story` | Personal or family memory | Grandparent attended a Gehrig game |
| `photo` | Photo upload or photo lead | Scan of family photo |
| `memorabilia` | Memorabilia image or description | Program, ticket stub |
| `correction` | Factual correction to existing content | Date correction |
| `identification` | People/place/date/object ID | Names someone in archive photo |
| `source_lead` | Points to external source | Newspaper clipping location |
| `historical_note` | Supporting historical context | Background on an event |

## Required member extension fields

See `member_submission` object in canonical model:

| Field | Requirement |
| --- | --- |
| `submitter_name` | Required |
| `submitter_contact` | Required; private; from session where possible |
| `submission_type` | Required |
| `ownership_statement` | Required |
| `permission_statement` | Required |
| `credit_preference` | Required |
| `consent_status` | Required; default `pending` |
| `admin_followup_required` | Required boolean |

Optional: `privacy_notes`, `uploaded_media_reference`, `related_candidate_id`,
`submitter_id`.

## Permission, credit, and privacy

| Field | Rule |
| --- | --- |
| `ownership_statement` | Submitter declares ownership or lawful source |
| `permission_statement` | Declares whether LGFC may use content |
| `credit_preference` | `public_credit`, `anonymous`, `private`, `custom` |
| `privacy_notes` | Free-text restrictions |
| `privacy_flag` | Category: `donor_member`, `living_person`, etc. |
| `privacy_review_status` | Process state; default `pending_review` |
| `consent_status` | `pending` until operator records grant/deny |

Member content is **never public** until all review dimensions pass.

## Default states on intake

| Dimension | Default |
| --- | --- |
| `review_status` | `pending_review` |
| `rights_status` | `permission_needed` |
| `source_trust_status` | `pending` |
| `relevance_status` | `pending` |
| `publication_status` | `not_ready` |
| `consent_status` | `pending` |

## Relation to operational surfaces

### Today (transition)

| Step | Surface |
| --- | --- |
| Member submit | `POST /api/library/submit` → `submission_queue` |
| Candidate mirror | Optional seed/registry row with `submission_queue_id` |
| Review | Admin editorial queue + future candidate review UI |
| Publish | `content_inventory` after editorial conversion |

### Future (post #2278)

| Step | Surface |
| --- | --- |
| Member submit | API → `member_submissions` D1 + optional B2 upload |
| Candidate | `content_items` row linked to submission |
| Publish | Same promotion path as other streams |

## Upload types (design; runtime deferred)

| Asset | Current runtime | Future |
| --- | --- | --- |
| Text story | Supported via submit API | Same |
| Photo binary | Reference string only | B2 upload + `uploaded_media_reference` |
| PDF/document | Not supported | B2 with type validation |
| Video/audio | Not supported | Link reference or licensed upload |

## Mapping from `submission_queue`

| Queue field | Candidate / member field |
| --- | --- |
| `submitted_by` | `submitter_name` + contact parsing |
| `title` | `title` |
| `description` | `summary` or story body in conversion |
| `source_name`, `source_url`, `credit_line` | top-level candidate fields |
| `media_reference` | `uploaded_media_reference` |
| `payload` JSON | full member extension snapshot |
| `status` | operational queue state; not candidate `review_status` |

## Admin follow-up

Set `admin_followup_required = true` when:

- consent is `pending` or `restricted`;
- privacy flag is `living_person`, `minors`, or `sensitive`;
- permission statement is ambiguous;
- media reference exists but binary not yet ingested.

## Cross-references

- Canonical model: `docs/reference/content/lgfc-content-candidate-model.md`
- Review procedure: `docs/how-to/website/member-submission-review.md`
- Legacy member submit: `docs/how-to/website/member-content-submission.md`
