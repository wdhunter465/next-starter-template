---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Audit snapshot, protected CSV export, and report closeout procedures
Does Not Own: CI reporting, secret rotation, or bulk PII export policy
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1127
Last Reviewed: 2026-08-22
---

# Admin Audit and Reporting

## Purpose

Operate `/admin/audit` for operational evidence, D1 counts, protected CSV export,
and report queue closeout (`#1127` / T49).

## Scope

Route: `/admin/audit`

APIs: `/api/admin/stats`, `/api/admin/export`, `/api/admin/reports/list`,
`/api/admin/reports/close`.

## Steps

1. Sign in as an admin member.
2. Click **Refresh** to load stats and the open report queue.
3. Review operational snapshot and unavailable-table warnings.
4. Export allowlisted tables or close reviewed reports with admin notes.
5. Switch **open** / **closed** filters to audit historical report queues.

## Procedure

### Load audit surfaces

1. Open **Audit & Reporting**; the snapshot loads automatically for a signed-in admin member.
2. Click **Refresh** (disabled while other actions are busy).
3. Confirm status moves from loading to the loaded snapshot.

### Operational snapshot

- Review D1 count rows and **Unavailable tables** warnings.
- **Reports in queue** reflects the active filter (`open` or `closed`).
- Full Ask/FAQ moderation remains on **Admin Moderation**.

### Protected CSV export

1. Choose an allowlisted table (join requests, join email log, library entries,
   photos, page content).
2. Click **Download CSV** (disabled while busy).
3. Confirm browser download and success status.
4. Reporter emails are not included in report exports from this lane.

### Report closeout

1. Ensure filter is **open**.
2. Review masked reporter email (`r***@domain` pattern).
3. Enter **Admin note for closeout** when closing.
4. Click **Close report**; wait for success status.
5. Refresh reports and stats to confirm queue count changes.

### Filter changes

- Click **open** or **closed** to switch queues (active filter button is disabled).
- Only the report list reloads on filter change; stats are not re-fetched.

### Access

The page loads reports and stats automatically for a signed-in admin member — no token step. Session expiry or sign-out surfaces as `401`/`403` `Error:` status text on the next action.

## Verification

- `tests/admin-audit-reporting.test.tsx` — admin session load, non-admin/unauthenticated rejection, stats error alerts.
- Manual: export and close require an admin session; `Error:` prefixes on API failures.

## Closeout Criteria

Audit action is complete when exports download successfully or reports close with
admin notes recorded, and refreshed counts match expectations.
