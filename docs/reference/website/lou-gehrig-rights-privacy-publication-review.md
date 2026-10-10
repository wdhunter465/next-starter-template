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
