---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts
Does Not Own: How-to procedures; operational runbooks; governance policies
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #4825, #4822
Last Reviewed: 2026-10-23
---

> **STATUS:** AS-BUILT FOR SECTIONS 2, 3, 12 AND 14  
> Section 3 lists the 18 admin tools that are built and is the authority for what ships. Sections 4 to 11 record the original design. Where they describe a manager that is not in section 3 (Posts, Milestones, Users, System Health), that manager is not built and is not required for launch.

# LGFC — Admin Dashboard Specification  
## Lou Gehrig Fan Club — Admin & CMS UI  
**Version:** 2025-11-16

Canonical auth reference: /docs/reference/design/auth-model.md

---

## 1. Purpose and Scope

The **Admin Dashboard** is the primary interface for LGFC administrators and moderators to manage:

- Reported content (core moderation queue).
- Posts (news, Q&A).
- Media assets (B2-backed images).
- Milestones.
- Events (calendar).
- Weekly Matchup configuration.
- Basic user management.
- System health overview.

The dashboard runs **only** on the Cloudflare Pages-hosted site and provides the UI layer for the D1-backed CMS.

---

## 2. Location and Access

### URL

- Main entry: `/admin` (updated 2026-10-14 to the built route, Product Authority, #4409, D-078; `/admin/dashboard` is not a route)

### Access Control

- Only available on the Cloudflare Pages-hosted admin area.
- Access requires:
  1. Valid D1 member session (`member_sessions` table).
  2. Authenticated member session (`lgfc_session`) resolves to role-backed admin authorization in D1 `members`.
- All `/admin/**` routes are protected; Cloudflare public site **never** hosts admin functionality.

### Link from Public Site

- The public Cloudflare footer does **not** include an Admin link. Admin access is available only through direct navigation to `/admin` by authenticated admin users.
- Admin dashboard at `/admin` is part of the Cloudflare Pages deployment.

---

## 3. High-Level Dashboard Structure

The Admin Dashboard is organized into key areas:

The built admin has 18 tools (accepted 2026-10-14, Product Authority, #4409, D-080): Dashboard, Moderation (the reports queue lives here), Audit & Reporting, FAQ Queue, Page Content, CMS Blocks, Editorial Archive, Events, Matchup, Fundraiser Preview, Club Staging, Join Requests, Worklist, Member Operations, Media Assets, Rights Review, Archive Items, D1 Inspect.

The original design listed Reports, Posts, Media, Milestones, Events, Weekly Matchup, Users and System Health. There is no separate Posts, Milestones, Users or System Health manager, and none is required for launch. Where the sections below describe those areas, they record the original design, not the built admin.

### Layout

- Left sidebar navigation listing all sections.
- Main content area for tables, forms, and detail panels.
- Top bar with current admin's name/email and a logout action.

---

## 4. Reports (Core Moderation Queue)

The **Reports** view is the central moderation hub.

### Data Source

- D1 `reports` table, joined with:
  - `members` (reporting user)
  - `discussions`, `media_assets` (depending on target_type)

### List View

Columns:

- Type: `post`, `comment`, or `media`
- Snippet: small preview of the content
- Reporter: name/screen_name of reporting user
- Count: number of reports tied to this target
- Status: `open`, `reviewed`, `dismissed`
- Created: timestamp of earliest report
- Actions: review / open / resolve

### Actions

Admins can:

- Open full context (view post + surrounding thread, or full media context).
- Hide content (temporarily remove from member-facing views).
- Delete content (hard remove with cascading comment removal if required).
- Issue warnings (recorded in log; can be surfaced to user later).
- Dismiss report (mark as no-issue).
- Mark as reviewed (without full delete/hide).

All actions are stored in an `admin_actions` log or equivalent for audit.

---

## 5. Posts Manager

The **Posts** section manages both:

- `news` posts (public announcements)
- `qna` posts (member discussions)

### List View

Columns:

- Type: `news` / `qna`
- Title
- Author (profile link)
- Created date
- Status (published, hidden)
- Comment count

### Detail View

Displays:

- Full title and body.
- Associated media (thumbnails).
- Comments (threaded view).
- Controls for hide/delete/edit.

### Admin Actions

- Edit title/body.
- Hide/unhide post.
- Delete post (with cascade rules for comments defined carefully).
- Optionally pin/unpin posts (future enhancement).
- Convert a post from `qna` to `news` or vice versa (with constraints).

---

## 6. Media Manager

The **Media** section controls images and other media assets stored in B2.

### List View

Columns:

- Thumbnail preview
- Filename or key
- Primary tags (gallery/memorabilia/milestone/etc.)
- Owner (uploading user)
- Uploaded at
- Status (approved/pending)

### Filters

- Tag-based: gallery, memorabilia, milestone, event, matchup, quote, etc.
- Approval status.
- Uploader.

### Detail View

Shows:

- Larger preview.
- All tags and metadata.
- Related posts or milestones using the asset.

### Admin Actions

- Approve or reject images.
- Add/remove tags.
- Delete images (with warnings about breaking references).
- Bulk tag operations.

---

## 7. Milestones Manager

The **Milestones** section manages the historical timeline content.

### List View

Columns:

- Date or year
- Title
- Published status
- Has media? indicator

### Detail View

Fields:

- Title
- Date/Year
- Description (short to medium length)
- Optional media association
- Published toggle (draft vs live)

### Admin Actions

- Add new milestone.
- Edit milestone content.
- Attach/change image.
- Publish/unpublish.
- Reorder (where applicable) or rely on date ordering in queries.

---

## 8. Events / Calendar Manager

The **Events** section manages upcoming and past events that feed the calendar and member views.

### List View

Columns:

- Date
- Name
- Location
- Published status

### Detail View

Fields:

- Title
- Start date/time
- End date/time (optional)
- Location
- Description
- External link (e.g. livestream URL, partner site)
- Related media (optional)
- Published flag

### Admin Actions

- Add events.
- Edit event details.
- Publish/unpublish.
- Delete events.
- Control which events appear in the 30-day MemberPage snapshot.

---

## 9. Weekly Matchup Manager

The **Weekly Matchup** area controls matchup configuration.

### View

Shows:

- Current active matchup.
- Upcoming scheduled matchup(s).
- Historical results summary (optional in later phases).

### Fields for a Matchup

- Title
- Start date/time
- End date/time
- Image A (selected from media assets tagged appropriately)
- Image B
- Description
- Status (draft, scheduled, active, closed)

### Admin Actions

- Configure new matchup by selecting A/B images.
- Schedule start/end times.
- Activate/deactivate matchups.
- Reset votes for a matchup (if needed due to error).
- View high-level results (vote counts A vs B).

---

## 10. Users Manager (Minimal)

The **Users** section provides basic oversight of member accounts.

### List View

Columns:

- Name
- Screen name
- Email
- Joined date
- Status (active/suspended)

### Detail View

Shows:

- Profile fields.
- Recent posts/comments.
- Recent reports involving this user (either as reporter or as target).

### Admin Actions

- Suspend/unsuspend user (soft block: prevent posting).
- Reset screen name.
- Trigger an email re-verification flow (if email change requests are part of the flows).
- View moderation history related to the user.

No deep PII, no exporting of large personal datasets.

---

## 11. System Health

The **System Health** section provides a high-level operational summary.

### Contents

- D1 connection check (`lgfc_lite` database).
- Cloudflare Pages deployment status (version + last deployment time).
- Cloudflare Pages status (link to latest deployment).
- Backblaze B2 connectivity (basic check on bucket access).
- Elfsight widget status (basic connectivity indication).
- Warnings if critical environment variables are missing.

This is a **read-only diagnostic view** to guide admin troubleshooting and decision-making.

---

## 12. Permissions & Logging

### Access

- Only authenticated users with admin role resolved by canonical auth/session model can access `/admin/**`.
- RLS and backend policies must ensure that admin-only operations are not reachable by regular members.

### Logging

- All destructive or high-impact actions (delete, hide, warn, change roles) must be logged in an `admin_actions` log or equivalent.
- Logs should capture:
  - Admin user id.
  - Target type and id.
  - Action.
  - Timestamp.
  - Optional reason/comment.

---

## 13. Visual and UX Guidelines

- Use the same LGFC color palette and type scale defined in `/docs/reference/design/style-guide.md`.
- Maintain a clean, table-and-card-based layout.
- Ensure mobile-friendly layouts for quick moderation on smaller screens.
- Avoid visual overload; prioritize clarity and readability.
- Consistent button styles for primary actions (approve, save, publish, etc.).

---

## 14. Definition of Done

The Admin Dashboard is considered **functionally complete** when:

- All 18 tools listed in section 3 exist and are reachable from `/admin`.
- The reports queue (built as Moderation) is fully operational and drives the moderation workflow.
- The built admin tools listed in section 3 perform their intended operations end-to-end.
- All admin routes `/admin/**` are properly gated by canonical auth/session + admin role authorization.
- Core actions are logged.
- No 404s or dead links in the admin navigation.

Any further enhancements (filters, charts, advanced analytics) must be additive and **must not** break or replace the structure defined here.
