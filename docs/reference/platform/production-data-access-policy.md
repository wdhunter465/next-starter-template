---
Doc Type: Reference
Audience: Product Authority, Operations, Engineering, and AI agents
Authority Level: Controlled
Owns: Who may read Production D1 data, which data is in each access tier, how reads are recorded, which network hosts agent sessions need, and the test-account approach for sign-in checks
Does Not Own: Production writes and migrations (DELIVERY-AND-RELEASE and PLATFORM-AND-ENVIRONMENT), authentication design, member data retention, or the rights and privacy disposition of published content
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #4443, #4414, #4657, #4682
Last Reviewed: 2026-10-19
---

# Production data access policy

## Purpose

The governance documents cover Production writes and migrations. They did not say what an agent may read from Production D1. This policy does, and it follows the access model Product Authority set on 2026-10-19 on #4443.

## The model

Product Authority's direction, 2026-10-19:

- D1 can be read by GitHub and LGFC agents at all times.
- All website visitors can see the website's homepage.
- Only logged-in club members can see the fan club page.
- D1 follows the same model as an extra layer of security.

This policy reads that as: data in D1 is open to an agent to the same degree that the website opens it to a viewer. A table is classed by who can see its content on the website, and an agent's read access follows the class. Agents read at any time and need no per-read approval for the classes below that allow it.

## Who may read

- **Agents:** GitHub Actions workflows and LGFC agents (Claude Code and Cursor) using an approved path, read-only. An agent never writes to Production through a read path.
- **Approved read paths:** the public site and its public APIs; the Cloudflare connector's read-only D1 query; a workflow that already holds the D1 credentials.
- **Everyone else:** no direct access. Visitors and members reach data only through the site.

## Access tiers

| Tier | Who sees it on the website | Agent access to D1 |
| --- | --- | --- |
| A. Public content | Every visitor, on the homepage and public pages | Read at any time, rows included |
| B. Member content | Logged-in club members, on the fan club pages | Read at any time, rows included |
| C. Private and operational | Nobody on the website except the person it belongs to, or an administrator | Schema and aggregate counts at any time; row contents only with Product Authority's approval on the working Issue |

A table that has not been classed is Tier C until it is.

### Initial classification

This is a proposal from table names and the D1 design guide. I did not check every table against the pages that use it. Product Authority confirms or changes it.

| Tier | Tables |
| --- | --- |
| A. Public content | `events`, `milestones`, `friends`, `faq_entries`, `footer_quotes`, `content_blocks`, `page_content` (live rows), `weekly_matchups`, `photos`, `library_entries`, `media_assets` |
| B. Member content | `content_inventory` and its `content_inventory_*` tables, `content_items`, `content_item_tags`, `tags`, `archive_items`, `membership_card_content`, `discussions`, `retrosheet_*` |
| C. Private and operational | `members`, `member_sessions`, `login_attempts`, `join_requests`, `join_verifications`, `join_email_log`, `ask_inbox`, `submitters`, `submission_queue`, `member_submissions`, `weekly_votes`, `reports`, `moderation_events`, `permission_exchanges`, `permission_messages`, `rights_evidence`, `publication_candidates`, `content_search_runs`, `content_revisions`, `page_content_history`, `editorial_audit_events`, `admin_team_worklist`, `archive_item_custody_events`, `chatterbox_*`, `welcome_email_content`, `d1_migrations` |

## Rules for reading

1. **Read-only.** A read uses `SELECT` or the equivalent. Any statement that can change data is a write and follows the write rules below.
2. **Tier C: counts, not contents.** Aggregate counts and column names are always allowed. Reading row contents needs Product Authority's approval on the working Issue, naming the table and the reason.
3. **No exports.** An agent does not dump a table, download a backup, or copy rows into a file, an Issue, a pull request, a log or a chat message. A short sample of Tier A or B rows may be quoted when it is needed to show a defect.
4. **Record each Production read on the working Issue:** what was read, why, and the result in aggregate. Reads of Tier A and B need no approval but are still recorded.
5. **Never read secrets.** Session tokens, password material, API keys and the credentials themselves are never read, even by count of their contents.
6. **Backups carry Tier C data.** A backup file is handled as Tier C regardless of how it was made.

## Writes

Unchanged. A write to Production always goes through a source Issue, a pull request and the migrations workflow, and needs Product Authority's explicit Go. A read never authorizes a write.

## Exceptions

Product Authority is the only approver of an exception to these tiers. The approval is a comment on the working Issue naming the table, the reason and the scope.

## Network hosts for agent sessions

An agent session needs these hosts reachable. They were reachable from a cloud session on 2026-10-18 after the environment's network access was changed; keep them allowed through the review period. The environment's network setting is Product Authority's.

- `www.lougehrigfanclub.com`
- `*.pages.dev`, for Cloudflare Pages previews (`next-starter-template-6yr.pages.dev` and the branch previews)
- `github.com` and `api.github.com`
- `s3.us-east-005.backblazeb2.com`, for checking the public photo addresses

## Test accounts for sign-in checks (P-09)

Recommended approach, for Product Authority to confirm: two accounts, one test member and one test admin, named so they cannot be mistaken for real people, with the least access each role needs. Their credentials live in GitHub Actions secrets and nowhere else. Neither account appears in any public list. Creating them in Production is a write and needs an explicit Go and the confirmed storage location (decision 4 on #4657, and #4682).

## Open questions for Product Authority

1. Does "at all times" include row contents of Tier C tables, or only schema and counts as written here? The default is counts only.
2. Confirm or change the initial classification above.
3. Where are the test-account credentials stored?

## Rollback

Revert the pull request that changed this file. The policy creates no system state.
