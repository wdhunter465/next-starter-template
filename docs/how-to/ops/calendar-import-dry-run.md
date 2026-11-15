---
Doc Type: How-to
Audience: Human + AI
Authority Level: Supporting
Owns: How to dry-run the calendar import for the public events list and read what it would import or skip
Does Not Own: The scheduled import job, the calendar credential, or any Production write (those need Product Authority's Go)
Canonical Reference: /docs/reference/design/home-calendar.md
Related Issues: #4889, #4414
Last Reviewed: 2026-11-14
---

# Dry-run the calendar import

The website calendar reads the `events` table. #4889 adds an importer so club events on an approved calendar appear without manual entry. This page covers the part that is built: a dry run that writes nothing.

## Rules the importer applies (Product Authority, 2026-11-14)

- Website entries have no invitees. Admin entries have a title that starts with `LGFCADMIN - ` and invite the owner.
- An event is imported only if it has no attendees and its title does not start with `LGFCADMIN - ` (any letter case).
- Private or confidential events, events with no UID, title or start date, and recurring events are skipped, and the dry run says why. A cancelled event is imported as hidden, never deleted.
- A manual admin edit is kept: an event with `locked = 1` is never changed by the import. Events with no `source` are never touched.

## Steps

1. Get the calendar's ICS feed as a file (the calendar's secret ICS address is a secret; do not paste it into an Issue or the repository).
2. Run `node scripts/calendar/ics-import-dry-run.mjs feed.ics lgfc-calendar`.
3. Read the output: `would_import` lists the rows, `skipped` lists every other event with the reason, `counts` totals both.
4. Check that no admin entry is under `would_import`. If one is, stop and report it on #4889.

## Not built yet

The scheduled job, the apply step and the migration run in Production are protected: they need the credential decision, workflow approval and an explicit Go on #4889. Applying uses `buildUpsertSql` after migration `0100`.
