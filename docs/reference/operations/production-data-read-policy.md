---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled (accepted by Product Authority 2026-10-19 on #4443, with the access model below)
Owns: What agents and operators may read from Production data, which tables are off limits, how reads are logged, who approves exceptions, the network hosts allowed for live-site review, and the P-09 test-account approach
Does Not Own: Production writes, migrations and releases (see PLATFORM-AND-ENVIRONMENT and DELIVERY-AND-RELEASE), credentials, or the content of any member record
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #4443, #4414, #4422, #4433, #4409, #4657, #4682
Last Reviewed: 2026-10-19
---

# Production data read policy

## Purpose

The governance documents control Production writes and migrations. They do not say what an agent may read from the Production database or the live site. The Production database holds member, authentication, moderation and personal data, and its backups hold the same. This policy fills that gap with a default that is safe for the launch window.

## Status

Accepted by Product Authority on 2026-10-19 on #4443, with this access model:

- D1 can be read by GitHub and LGFC agents at all times.
- All website visitors can see the website's homepage.
- Only logged-in club members can see the fan club page.
- D1 follows the same model as an extra layer of security.

The tiers below apply that model: an agent's access to a table follows who can see its content on the website. The first version of this policy (2026-10-08) was proposed by the Operations role with narrower access; this version replaces it. Linking it from the governance platform document is a separate protected-path change that needs the protected-change review.

## Read tiers

| Tier | Who sees it on the website | What an agent may read at any time | Tables and surfaces |
| --- | --- | --- | --- |
| 1. Public content | Every visitor, on the homepage and the public pages | Row contents, read-only | `events`, `milestones`, `friends`, `faq_entries`, `content_blocks`, `footer_quotes`, `weekly_matchups`, `page_content`, `photos`, `media_assets`; the public pages and public API responses on the live site |
| 2. Member content | Logged-in club members, on the fan club pages | Row contents, read-only | `library_entries`, `archive_items`, `content_items`, `content_inventory*`, `discussions`, `membership_card_content`, `tags`, `retrosheet_*` |
| 3. Private and operational | Nobody on the website except the person it belongs to or an administrator | Schema, column names and aggregate counts that identify no person. Row contents only with Product Authority's approval on the working Issue | `weekly_votes`, `publication_candidates`, `rights_evidence`, `sources`, `reports`, `editorial_audit_events`, `welcome_email_content`, `chatterbox_*`, `permission_exchanges`, `permission_messages`, `content_revisions`, `page_content_history`, `content_search_runs`, `admin_team_worklist`, `archive_item_custody_events`; and the person-level tables `members`, `member_sessions`, `login_attempts`, `join_requests`, `join_requests_new`, `join_email_log`, `ask_inbox`, `member_submissions`, `member_submissions_next`, `submitters`, `submission_queue`, `submission_queue_next`, `moderation_events`, `moderation_events_next` |
| Never | Not applicable | Nothing | Any backup or export file; any secret, token or environment variable value; password or session material |

A table that is not listed is Tier 3 until Product Authority classifies it. The classification of the tables above is the Operations role's proposal from the 2026-10-08 version, adjusted to the model: `photos` and `media_assets` moved to Tier 1 because the homepage's Weekly Matchup shows them, and the content and archive tables moved to Tier 2. It was made from table names and the D1 design guide, not checked page by page; Product Authority confirms or changes it. Tier 1 content that turns out to hold personal data (for example a quote with a private name) is reported on the working Issue and not copied elsewhere.

## Rules for every read

1. Read-only. No insert, update, delete, schema or migration statement, and no admin or member mutation endpoint.
2. Every read has a working Issue that names the purpose.
3. Log each read on that Issue as a comment: date, the table or endpoint, the purpose, and what came back (row count or the fields used). Never paste Tier 3 rows into an Issue, PR, log or report. A short sample of Tier 1 or Tier 2 rows may be quoted when it is needed to show a defect.
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
| `github.com`, `api.github.com` | Issues, pull requests and workflow runs |
| `s3.us-east-005.backblazeb2.com` | Checking the public photo addresses |

These are recorded here. The environment network setting is changed by the person who owns the environment, and keeping these hosts allowed through the review period is an Operations check in P-26.

## Test accounts for P-09 (member and admin flow checks)

Recommended approach, for Product Authority to accept or change:

1. Use test accounts only. No real member's data is read, exported or shown in a screenshot.
2. Create one test member through the normal join flow on Production, using an address that Product Authority controls and names (an alias on a club-controlled mailbox, not a personal address). Label the account so it is recognizable as a test.
3. Product Authority creates or approves any admin test credential. Agents never create admin credentials.
4. Credentials are never written to an Issue, PR, comment, log or report. A scheduled sign-in check (#4682) needs them in GitHub Actions secrets; where they are stored is a decision Product Authority still has to confirm (decision 4 on #4657), and no account is created in Production until it does.
5. After P-09, the test accounts are removed or disabled through the documented path, and the Issue records that this was done.
6. Any test post, vote or submission is removed afterward, and the removal is recorded.

## Validation

Valid when Product Authority confirms the table classification on #4443, the tiers match the tables in the database migrations, and each item in Rules for every read can be followed by an agent without asking.

## Rollback

Revert the documentation commit. No system state is created.
