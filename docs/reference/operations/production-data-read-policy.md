---
Doc Type: Reference
Audience: Human + AI
Authority Level: Proposed policy (takes effect when Product Authority accepts it on #4443)
Owns: What agents and operators may read from Production data, which tables are off limits, how reads are logged, who approves exceptions, the network hosts allowed for live-site review, and the P-09 test-account approach
Does Not Own: Production writes, migrations and releases (see PLATFORM-AND-ENVIRONMENT and DELIVERY-AND-RELEASE), credentials, or the content of any member record
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #4443, #4414, #4422, #4433, #4409
Last Reviewed: 2026-10-08
---

# Production data read policy

## Purpose

The governance documents control Production writes and migrations. They do not say what an agent may read from the Production database or the live site. The Production database holds member, authentication, moderation and personal data, and its backups hold the same. This policy fills that gap with a default that is safe for the launch window.

## Status

Proposed by the Operations role for Product Authority. It becomes the rule when Product Authority accepts it on #4443. Linking it from the governance platform document is a separate protected-path change that needs the protected-change review.

## Read tiers

| Tier | What may be read | Tables and surfaces |
| --- | --- | --- |
| 1. Public content, row level | Row contents, read-only | `events`, `milestones`, `friends`, `faq_entries`, `content_blocks`, `footer_quotes`, `weekly_matchups`, `page_content`; the public pages and public API responses on the live site |
| 2. Aggregate only | Counts, existence checks, column names and date ranges. No row contents | Member-gated and operations content: `photos`, `library_entries`, `media_assets`, `archive_items`, `content_items`, `content_inventory*`, `discussions`, `weekly_votes`, `publication_candidates`, `rights_evidence`, `sources`, `tags`, `reports`, `editorial_audit_events`, `welcome_email_content`, `membership_card_content`, `chatterbox_*` |
| 3. Never read | No rows, no counts that identify a person, no export | `members`, `member_sessions`, `login_attempts`, `join_requests`, `join_requests_new`, `join_email_log`, `ask_inbox`, `member_submissions`, `member_submissions_next`, `submitters`, `submission_queue`, `submission_queue_next`, `moderation_events`, `moderation_events_next`; any backup or export file; any secret, token or environment variable value |

A table that is not listed is Tier 3 until Product Authority classifies it. Tier 1 content that turns out to hold personal data (for example a quote with a private name) is reported on the working Issue and not copied elsewhere.

## Rules for every read

1. Read-only. No insert, update, delete, schema or migration statement, and no admin or member mutation endpoint.
2. Every read has a working Issue that names the purpose.
3. Log each read on that Issue as a comment: date, the table or endpoint, the purpose, and what came back (row count or the fields used). Never paste Tier 2 or Tier 3 rows into an Issue, PR, log or report.
4. Use the smallest read that answers the question: public API or page first, then a Tier 1 table, then an aggregate.
5. Reading the live site by its public pages is always allowed, including during the freeze.
6. The automatic safety check that sometimes allows or denies a database read is a backstop. This policy is the control, and a read the check allowed can still be out of policy.

## Exceptions

Only Product Authority approves a read outside these tiers. The request names the table, the fields, the reason, the time limit and who will see the result. The approval is a written comment on the working Issue, and the read is logged as above. An exception never covers an export, a backup file or a credential.

## Writes

Production writes always go through a source Issue, a pull request, the required checks and the migrations workflow, with an explicit Go from Product Authority. Nothing in this policy permits a write.

## Network hosts for live-site review

Agent sessions need outbound access to these hosts while the website is under review (through launch):

| Host | Use |
| --- | --- |
| `www.lougehrigfanclub.com` | The live site, sitemap, robots and public APIs |
| `*.next-starter-template-6yr.pages.dev` | Pull request and branch preview deployments |

These are recorded here. The environment network setting is changed by the person who owns the environment, and keeping these hosts allowed through the review period is an Operations check in P-26.

## Test accounts for P-09 (member and admin flow checks)

Recommended approach, for Product Authority to accept or change:

1. Use test accounts only. No real member's data is read, exported or shown in a screenshot.
2. Create one test member through the normal join flow on Production, using an address that Product Authority controls and names (an alias on a club-controlled mailbox, not a personal address). Label the account so it is recognizable as a test.
3. Product Authority creates or approves any admin test credential. Agents never create admin credentials.
4. Credentials are shared outside the repository and never written to an Issue, PR, comment, log or report.
5. After P-09, the test accounts are removed or disabled through the documented path, and the Issue records that this was done.
6. Any test post, vote or submission is removed afterward, and the removal is recorded.

## Validation

Valid when Product Authority records acceptance or changes on #4443, the three tiers match the tables in the database migrations, and each item in Rules for every read can be followed by an agent without asking.

## Rollback

Revert the documentation commit. No system state is created.
