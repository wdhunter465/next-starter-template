---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Design brief for a two-level admin navigation (#4769)
Does Not Own: Admin route implementation, authentication changes, or Production writes
Canonical Reference: /docs/governance/PRODUCT-AND-DESIGN.md
Related Issues: #4769, #2085
Last Reviewed: 2026-10-26
---

# Admin focus-area design brief (#4769)

## Purpose

Record the as-built `/admin` surface and a design-only proposal for fewer top-level buttons. This file changes no route, component, or authentication rule. Product Authority still has to choose the grouping and the timing.

The 2026-09-21 brief (`docs/ops/reports/admin-page-tools-design-readiness-brief.md`, #2085) recommended keeping the flat `AdminNav` and adding `/admin/review/**` later. This brief asks Product Authority to supersede that flat-nav recommendation. It does not do so by itself.

## As-built inventory

Counted on `main` at `27205626` from `src/components/admin/AdminNav.tsx` and `src/app/admin/**/page.tsx`. The layout at `src/app/admin/layout.tsx` requires an authenticated member whose role is `admin`, then renders the page. Every route below uses that same gate.

| Route | Nav label | What the page states |
| --- | --- | --- |
| `/admin` | Dashboard | Site operations, content, and system tools |
| `/admin/moderation` | Moderation | Page exists; this brief does not restate its data store |
| `/admin/audit` | Audit & Reporting | Loads D1 counts, including a reports total |
| `/admin/faq` | FAQ Queue | Page exists; this brief does not restate its data store |
| `/admin/content` | Page Content | Edits site sections backed by D1 when configured |
| `/admin/cms` | CMS Blocks | Manages published `content_blocks` in D1 |
| `/admin/editorial` | Editorial Archive | Page exists; this brief does not restate its data store |
| `/admin/events` | Events | Page exists; this brief does not restate its data store |
| `/admin/matchup` | Matchup | Reads `/api/matchup/current` and matchup results; can show that no active matchup is in D1 |
| `/admin/fundraiser-preview` | Fundraiser Preview | Page exists; this brief does not restate its data store |
| `/admin/clubstaging` | Club Staging | Visual preview for staged club content. Not published to public routes |
| `/admin/join-requests` | Join Requests | Recent join requests captured from `/join` |
| `/admin/worklist` | Worklist | Operational admin tasks, owners, due dates, and status |
| `/admin/member-operations` | Member Operations | Page exists; this brief does not restate its data store |
| `/admin/media-assets` | Media Assets | D1 inventory of ingested media (B2 keys, size, etag) |
| `/admin/rights-review` | Rights Review | Page exists; this brief does not restate its data store |
| `/admin/archive-items` | Archive Items | Page exists; this brief does not restate its data store |
| `/admin/d1-test` | D1 Inspect | Read-only inspection of D1 tables, schema, and sample rows |

`src/app/ai-review/admin/page.tsx` is not in `AdminNav` and is not under `/admin`. It is outside this grouping.

## Options

### Option A — focus-area tiles (recommended)

Keep every current URL. Add one index page per focus area. The dashboard shows five tiles. Each tile opens a page that links to the existing tools. No tool moves to a new URL.

| Focus area | Existing tools |
| --- | --- |
| Members | Join Requests, Member Operations, Club Staging |
| Site content | Page Content, CMS Blocks, FAQ Queue, Events, Matchup, Fundraiser Preview |
| Community moderation | Moderation, Audit & Reporting |
| Media and rights | Media Assets, Rights Review, Archive Items, Editorial Archive |
| Operations and data | Worklist, D1 Inspect |

Click path: `/admin` tile "Members" → `/admin/members` (new index only) → existing `/admin/join-requests`. The old URL still opens the tool directly. A breadcrumb on the tool can read Dashboard / Members / Join Requests. On a narrow screen the tiles stack in one column. The current 18-button bar is removed from the top level and replaced by the five tiles plus Dashboard.

### Option B — leave the flat bar

Keep `AdminNav` as it is. This is the #2085 recommendation. It avoids a navigation change before the freeze. It leaves the mix of tasks, pages, and page sections that Product Authority flagged on 2026-10-22.

## Access

All eighteen routes require `role === 'admin'`. This brief does not propose a second role. D1 Inspect is the tool that should stay narrow if access is ever split: it lists tables and sample rows. Splitting access is a protected authentication change and is not part of this design.

## Test and route impact

Option A adds index pages and changes the top-level nav. It does not rename the existing tool URLs, so specs and exclusions that call `/admin/faq`, `/admin/matchup`, and the other current paths keep those paths. A nav-label assertion, a sitemap exclusion, or the nightly qualification (#4467) will need a follow-up child if it asserts the current 18-button bar. That child is not opened here.

## Timing

Recommend recording the grouping decision before the 2026-12-31 freeze, and implementing Option A after 2027-06-02. Implementing new index pages and removing the 18-button bar during the freeze window would touch the admin surface the nightly qualification and admin specs already describe.

## Decision still required

Product Authority records on #4769:

1. Option A, Option B, or a different grouping.
2. Whether implementation waits until after 2027-06-02.

Child issues with allowlists come after that decision. This pull request does not open them.
