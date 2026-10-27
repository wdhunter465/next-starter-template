---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Header contract, controlled vocabularies, document versioning, formatting and naming rules, the staleness rule, the standards rollout, tutorial document format, and the enforcement table
Does Not Own: Folder purpose; document types and locations; project documentation lifecycle and the as-built obligation; archive and retirement process
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #4856, #4640, #4780
Last Reviewed: 2026-10-27
Status: Active
Version: 1.0
Header Standard: 1.1
---

# Document management

## Scope and ownership

This file owns the header contract, the controlled vocabularies, document versioning, formatting and naming, the staleness rule, the effective-date rollout, the tutorial document format, and the enforcement table.

It does not own folder purpose (`docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md`), document types and locations (`docs/governance/DOCUMENT-ARCHITECTURE.md`), the project documentation lifecycle and the as-built obligation (`docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md`), or the archive and retirement process (`docs/ops/pmo/diataxis-legacy-retirement-policy.md`).

`docs/governance/standards/document-status-and-naming_MASTER.md` is a superseded pointer to this file.

## Standards versions and effective dates

Header Standard is the version of this standard that a header follows. Version is the document's own revision. They are different fields.

| Standard | Effective | Applies to | Change |
| --- | --- | --- | --- |
| 1.0 | retroactive | all existing documents | the seven fields in the current header template. A document with no Header Standard field is 1.0 |
| 1.1 | the calendar day after the pull request that introduces this file merges | every document created or revised on or after that date | adds Status, Version, and Header Standard, and uses the normalized vocabularies |

The 1.1 date is not backdated. Untouched documents stay on 1.0. A document created or revised on or after an effective date carries Header Standard at that version or higher.

The machine-readable table is `docs/governance/document-standards-versions.json`. A later standard change is one pull request that adds a row with an effective date at least 7 days out, announced on an Issue.

## Header contract

Field order:

1. Doc Type
2. Audience
3. Authority Level
4. Owns
5. Does Not Own
6. Canonical Reference
7. Last Reviewed
8. Status
9. Version
10. Header Standard

Related Issues stays where a document already uses it. Covers is optional until the change-impact check in decision D8 is in force, and is required for `docs/ops/as-built/**` records and for reference contracts that describe code.

Header fields do not contain sentences. A qualifier goes in the body.

Last Reviewed changes only when a person or agent verified the content. A header-only edit does not change it. Git history is the change log.

## Controlled vocabularies

Doc Type matches the folder. The values already enforced by the folder audit are Tutorial, How-To, Reference, and Explanation. This file uses Governance, which is the type the approved specification assigns to a domain-policy document in `docs/governance/`.

Authority Level follows the path rules Product Authority approved on 2026-10-27 for #4780. The old header text is not used to choose the value.

| Location | Authority Level |
| --- | --- |
| `docs/governance/REPOSITORY-AUTHORITY.md` | Constitutional |
| `docs/governance/*.md` in that directory only | Domain Policy |
| `docs/reference/**` | Reference |
| `docs/how-to/**` and `docs/tutorials/**` | Procedure |
| `docs/ops/ai/**`, `docs/templates/**`, `.claude/**`, `.cursor/**`, `.agents/**`, `CLAUDE.md`, `.github/pull_request_template.md` | Pointer / Template |
| `.github/workflows/**` and `scripts/**` | Implementation |

Locations not in that table stay with #4765. They are not guessed here.

Status is one of Active, Draft, Superseded, Historical, or Record. Record is point-in-time evidence kept in place. It is exempt from the staleness clock and it is not authority.

Audience names the reader. The value in current use is Human + AI. A narrower audience names a role from `docs/governance/AGENT-TEAM.md`.

## Version control

Version is MAJOR.MINOR. MAJOR changes when a rule, contract, or requirement changes meaning. MINOR is a clarification, a wording repair, or a link repair. Any body change requires a Version change. A review that finds the document still accurate changes Last Reviewed and does not change Version.

## Minimum content

A document includes Purpose, Scope, and Current known truth. A document that is still changing also includes Intended final state. A list-only, title-only, or placeholder-only document is not permitted. The older filename suffixes `_MASTER`, `_INCOMPLETE`, and `_DRAFT` are not used on new files.

## Formatting and naming

One H1, and it matches the title. Heading levels do not skip. Links use repo-root-relative paths. Dates are ISO 8601. Fenced code names its language. Enumerations are tables. New file names are kebab-case. New files do not use a `_MASTER` suffix.

## Staleness

The clock is Last Reviewed. It applies to Status Active and Status Draft. It does not apply to `docs/archive/**`, Status Historical, Status Superseded, Status Record, or `docs/templates/**`.

| Age | State | What happens |
| --- | --- | --- |
| 75 days | Due soon | Listed in the weekly report |
| 90 days | Stale | Must be reviewed. Listed with its area owner |
| Touched while stale | Pull request gate | The pull request sets Last Reviewed to the pull request date and includes a Reviewed against line. The check fails otherwise |

A review does one of these: the document is still accurate, and only Last Reviewed changes; the document needs a change, and Version and Last Reviewed both change; the document is obsolete, and it is archived under the retirement policy; or the reviewer cannot decide, and an Issue is opened.

While a document is stale, it is not the sole authority cited in a new Go packet or closeout. That limit is a reviewer convention until the weekly report workflow exists.

The weekly report, the touch gate, and the burn-down waves (the files older than 180 days by 2026-11-30, and the files between 91 and 180 days by 2026-12-31) are the script and workflow package. They are not implemented in this file.

## Change-triggered updates

A change to deployed behavior, a workflow, a scheduled job, a runbook-relevant script, a D1 migration, a Cloudflare binding, or an operator procedure updates the affected as-built record, reference contract, how-to, and tutorial in the same pull request, or in the closeout pull request before the source Issue closes. The obligation itself stays in `docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md`.

The pull request body lists each document updated or re-reviewed, or `none` with a reason. Re-review means the document was checked against the new behavior. The record of that check is the Last Reviewed change and the pull request line.

## Tutorial format

A tutorial lives at `docs/tutorials/<area>/<verb-noun>.md`, uses Doc Type Tutorial, and uses a kebab-case name. Sections, in order: Audience and outcome; Prerequisites; Steps, numbered, each with one action and its expected result; How you know it worked; Next steps. It is learning-oriented. It does not write to Production. Commands are copy-paste-ready. It carries `Verified: <date> by <role> against <commit SHA>` after the steps have been executed. A Verified date older than 90 days is re-run. Covers lists the capability's code paths. The tutorial obligation and the three N/A reasons are binding through `docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md`, not restated here as a second owner.

## Archive

Archive destination, banner, and manifest rules stay in `docs/ops/pmo/diataxis-legacy-retirement-policy.md` and in section 8 of #4856. This file does not own that procedure.

## Enforcement

| Requirement | How it is checked |
| --- | --- |
| Header Standard by effective date, on changed files | named gate, not built in this pull request |
| Version changes when the body changes | named gate, not built in this pull request |
| Staleness on touch | named gate, not built in this pull request |
| Weekly staleness report | named gate, not built in this pull request |
| Documentation impact and Covers | named gate, not built in this pull request |
| Tutorial line in the closeout validator | named gate, not built in this pull request |
| Archive manifest row | named gate, not built in this pull request |
| Tutorial was executed | reviewer convention |
| N/A reason | reviewer convention |
| Review quality | reviewer convention |
| A stale document is not the sole citation | reviewer convention |

## How to change this standard

A change that adds a header requirement is a new standards row in `docs/governance/document-standards-versions.json` with an effective date at least 7 days out, announced on an Issue, in the same pull request that changes this file. Version on this file increments in that pull request. The constitution, `Agent.md`, and workflow files are not amended here.
