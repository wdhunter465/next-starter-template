---
Doc Type: Reference
Audience: LGFC operators, editors, and Bill/ChatGPT
Authority Level: Controlled
Owns: Clearance states, public-domain review, privacy review, excerpt/summary treatment, and no-publish conditions
Does Not Own: Legal conclusions, runtime enforcement, or public publication
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related issues: #1738, #1742, #1741, #4524
Last Reviewed: 2026-10-10
---

# Lou Gehrig Rights, Privacy, and Publication Review Model

## Purpose

Define operator review workflow for rights clearance, copyright assessment,
privacy review, excerpt/summary treatment, and conditions that block publication.

This is an operator review workflow, not legal advice. Bill/ChatGPT retain final
authority on ambiguous cases.

## Clearance states

| Rights status | Meaning | Public use |
| --- | --- | --- |
| `unknown` | Not yet assessed | Block public use |
| `public-domain-candidate` | Likely PD; needs confirmation | Reference only until confirmed |
| `permission-needed` | Rights holder approval required | Block public use |
| `permission-granted` | Documented approval | Allowed per license terms |
| `owned` | LGFC owns or created | Allowed with credit |
| `fee-required` | Source or owner wants payment or a license fee | Must not use; record and flag only |
| `link-only` | Retired 2026-10-10 | Not an admission state; see Collection versus admission |
| `rejected` | Rights unacceptable | Must not use |

## Collection versus admission (Product Authority, 2026-10-10)

Search collects the URL and provenance record for everything it finds, whatever
its rights. Collection decides nothing about relevance or use. The content
evaluation process in the repository decides what is relevant and what is
admitted into the B2 and D1 libraries.

Admission and website display are hosted-only. LGFC admits only content it can
host and display on its own site: members stay on the LGFC website, and content
must not open new tabs or switch the site the member is viewing. A source URL may
appear in the credit line as a citation but is never the content. A found item
that cannot be hosted stays as a collection record and is held for permission or
rejected; it is not converted into a link on the site. Existing `link-only` rows
move to `permission-needed` or `rejected`.

## The simple rule (Product Authority, 2026-10-10)

Every found item ends in one of two outcomes:

- **Use:** free use or permission received. The item is added to the LGFC library
  and used on the website with its source cited.
- **Do not use:** no permission (denied, fee required, or rights retained with no
  grant). The item is noted in the library so a later search does not add it
  again, and it is never used on the website.

Pending requests and unanswered requests are recorded and unused, the same as
no permission.

## Audit record (Product Authority, 2026-10-10)

An auditor must be able to see what LGFC knew at the moment of each decision and
how LGFC arrived at it. The flow is: search, record the finding as **not
permitted**, evaluate permissions, set the outcome, and record what the decision
was based on.

**Default.** Every newly found item is recorded as `not_permitted` with
evaluation `pending`. Nothing is used on the website until an evaluation sets
`permitted`.

**Columns on the content record**

| Column | Holds |
| --- | --- |
| `origin_url` | Where the content was found |
| `found_at`, `found_by_run` | Date and time found, and the search run that found it |
| `origin_usage_statement` | The origin's usage or license statement, verbatim |
| `origin_usage_captured_at` | When that statement was captured (statements change over time) |
| `origin_usage_snapshot_ref` | Stored copy or hash of the statement and page as captured |
| `lgfc_outcome` | `permitted` or `not_permitted` (default `not_permitted`) |
| `outcome_basis` | Why: `origin_statement`, `email_permission`, `email_denial`, `no_response`, `fee_required`, `public_domain`, `manual_lgfc_decision` |
| `outcome_set_at`, `outcome_set_by` | When and who (person or named automation) |
| `permission_request_status` | `not_needed`, `not_sent`, `sent`, `follow_up_sent`, `reply_received`, `closed` |
| `request_sent_at`, `reply_received_at` | Email dates |
| `permission_exchange_id` | Link to the archived exchange (messages, addresses, bodies, attachments) |

**Append-only decision history.** Each evaluation step is a new event and is
never overwritten: event time, actor, from-outcome, to-outcome, basis, notes,
and references to the evidence used (origin statement snapshot, email message,
manual decision note). A correction adds a new event. The outcome as of any past
date can be rebuilt from the history.

**Content and communications.** The content record, every evaluation, every
permission request, and every reply are all retained, including the full email
body, date, sender and replier. The D1 build is tracked on #4523 and #4526.

## Rights layers and final status (Product Authority, 2026-10-10)

Permission from the origin covers only the origin's work, for example the
photographer's photo. A picture of Gehrig also needs the people and brands in it
to clear. Each record therefore carries one status per layer and one final
status.

| Column | Who decides | Notes |
| --- | --- | --- |
| `origin_permission` | The origin (photographer, archive, publisher) | Free use, credit cited, or permission given by email |
| `cmg_permission` | CMG (Gehrig name and likeness) | Applies when the content shows or names Gehrig |
| `mlb_permission` | MLB | Applies to MLB marks, logos and MLB-sourced media |
| `yankees_permission` | The Yankees | Applies to Yankees marks, logos and Yankees-sourced media |
| `final_status` | Computed | `permitted` only when every applicable layer is `permitted` |

Each layer value is `permitted`, `not_permitted`, `not_applicable` or
`for_admin_review`. `not_applicable` never blocks. Any other term, including
`for_admin_review`, counts as not permitted. The LGFC website uses `permitted`
content only. Further layers (for example privacy for living people) follow the
same pattern.

**Party standing.** CMG, MLB and the Yankees each have a standing record (granted,
denied, scope, date). A denial by one of them blocks all content that layer
applies to. A denial by a source blocks that source's content only. A change in
standing re-evaluates every affected record and creates new dated records (see
Records and dates). Outreach to CMG is the first priority.

## Records and dates

- The record date is the date LGFC found the content and created the D1 record.
  It is the date used to order records. Email dates are stored as part of the
  communications about the record and do not order records.
- A permission change creates a new record with the new date. The older record
  moves to the archive table. The active table holds one current record per
  origin URL, so it is also the deduplicated table. The archive is kept forever.
- Retention of all records and communications is permanent.
- Finding the same URL again with no change in permission creates no record.
  Finding it with a changed origin statement or a changed party standing triggers
  re-evaluation and, if the outcome changes, a new record.
- Only `permitted` content is stored in B2. If a later record is not permitted,
  the B2 copy is removed and D1 keeps the history.
- The origin URL is cleaned of unneeded characters (tracking parameters, fragments)
  but must still re-retrieve the origin content. Only https URLs are tracked and
  http is ignored.

## Ambiguity and admin review

- An evaluation that lands ambiguous is treated as `not_permitted` and flagged
  with the reason, so a person can review why. The cause is either the code or an
  external variable that needs a better definition.
- An evaluation that cannot proceed is set to `for_admin_review` and an Issue is
  created assigned to team:Operations and the Product Authority, who sets the
  final state. The decision is recorded in D1.

## Fair use and challenges (Product Authority, 2026-10-10)

The short-quote path stays: a short quote with attribution under editorial
fair-use judgment, within the limits of the excerpt table. Rules:

- Only a person makes a fair-use decision. Automation never does; an automated
  evaluation that would depend on fair use is ambiguous and not permitted.
- A fair-use decision is recorded as `permitted` with basis `manual_lgfc_decision`
  and a written rationale, dated like any other record.
- It covers short quotes only, not photos, full articles or video.
- LGFC accepts that any owner may challenge a permission, including in error. When
  an owner contacts LGFC, the content is set to `not_permitted` in a new dated
  record, taken off the site, and the contact is recorded.

## Citation

LGFC cites the source for all content used. The default format is:
"Title, by Creator, via Source (License)", with the word "origin" linking to the
origin URL. If the source defines a citation format, that format overrides the
default.

## Publishing control

- Automation selects content only from records whose `final_status` is
  `permitted`, filtering in the D1 query and checking again at selection.
- A scheduled action compares published content with D1. If a published record is
  not permitted, or became not permitted after publication, it triggers a recycle
  so automation selects replacement content.
- Manual changes to site content go through a PR, which may also trigger the
  action.

## Usage categories

| Category | Clearance state | Credit |
| --- | --- | --- |
| Free use (public domain, CC0, US government work) | `public-domain-candidate`, then confirmed | Courtesy |
| Free use with credit cited (CC BY, CC BY-SA, stated use-with-credit) | `permission-granted` (license is the grant) | Required |
| Free use with permission given (owner's written grant) | `permission-granted` (reply stored as evidence) | As the owner specified |
| Fee required | `fee-required` | None: never published |

LGFC pays for no content. A fee-required item is still recorded in full, flagged
`FEE REQUIRED: DO NOT USE ON LGFC WEBSITE`, and excluded from publication prep.
Permission requests use `docs/how-to/website/lou-gehrig-permission-request-form-letter.md`.

### Permission scope and archive

Permission is requested once per source and may cover "Gehrig and Gehrig-related
content" the source holds, so one exchange can settle many assets. A grant or
denial covers only the scope its reply states. Every library asset must resolve
to the archived exchange that covers it: the full messages, addresses, message
IDs, attachments, URLs listed, scope, credit wording and conditions. The D1
archive is tracked on #4526; until it exists, originals are kept in the admin
mailbox and referenced from `rights_evidence`.

## Public-domain review process

1. Identify work type (text, photo, government document, etc.).
2. Determine publication date and jurisdiction considerations.
3. Document assessment in notes; do not assume PD from age alone.
4. Set `public-domain-candidate` until Bill/ChatGPT or qualified review confirms.
5. Confirmed public domain may proceed to `approved-for-reference` or public-copy path.

## Privacy review process

| Privacy flag | Review action |
| --- | --- |
| `none` | Standard review |
| `living-person` | Verify consent or public-interest editorial justification |
| `donor/member` | Apply Fan Club privacy rules; no unauthorized disclosure |
| `minors` | Escalate to Bill/ChatGPT; default reject for public use |
| `sensitive` | Redact or defer; document mitigation |
| `other` | Document case-specific review in notes |

Do not publish private personal data about living people without explicit review.

## Excerpt and summary treatment

| Treatment | When allowed | Requirements |
| --- | --- | --- |
| Short quote with attribution | Fair use editorial judgment + rights review | Credit line, source citation |
| Summary in operator words | Rights allow reference | No wholesale copying |
| Photo thumbnail | Rare; high bar | Explicit permission or PD confirmation |

When uncertain, hold the item (`unknown` or `permission-needed`) and defer public-copy approval. Do not substitute a link.

## No-publish conditions

Block publication (public routes, `content_inventory`, Fan Club surfaces) when:

- `review_status` is not `approved-for-public-copy`;
- `rights_status` is `unknown`, `permission-needed`, `fee-required`, or `rejected`;
- `privacy_flag` requires unresolved consent or redaction;
- `factual_confidence` is `low` without approved uncertainty language;
- `rejection_reason` is present;
- source is disallowed per category inventory;
- human editorial approval has not been recorded.

## Publication approval path

Publication requires sequential gates:

1. Provenance review complete.
2. Rights and privacy review complete.
3. Editorial conversion complete (Task 005).
4. Human editor approval recorded (`reviewer`, `reviewed_at`).
5. Placement decision per unified content workflow.

No automated publication is authorized by Program #1738.

## Acceptance checklist

- [x] Review states documented
- [x] No-publish conditions documented
- [x] Privacy review rules documented
- [x] Copyright/public-domain review documented as operator workflow
