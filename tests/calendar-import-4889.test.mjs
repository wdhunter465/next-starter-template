import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { ADMIN_PREFIX, buildUpsertSql, classifyEvent, parseIcs, planImport } from '../scripts/calendar/ics-import-lib.mjs';
import { dryRun } from '../scripts/calendar/ics-import-dry-run.mjs';

const ics = readFileSync(resolve(process.cwd(), 'tests/fixtures/calendar-mixed-4889.ics'), 'utf8');

describe('calendar import: what may reach the website (#4889)', () => {
  const { rows, skipped } = planImport(ics, 'lgfc-calendar');
  const titles = rows.map((r) => r.title);

  it('imports only the public entries, including the cancelled one as hidden', () => {
    expect(rows.map((r) => r.source_uid).sort()).toEqual(['cancelled@example', 'long-line@example', 'public-launch@example', 'public-multi@example']);
    expect(rows.find((r) => r.source_uid === 'cancelled@example').status).toBe('hidden');
  });

  it('never imports an LGFCADMIN entry, with or without invitees, in any letter case', () => {
    expect(titles.join('|')).not.toMatch(/PMO Meeting|Prep day/);
    expect(skipped.find((s) => s.uid === 'admin-pmo@example').reason).toMatch(/invitees|LGFCADMIN/);
    expect(skipped.find((s) => s.uid === 'admin-no-attendee@example').reason).toBe('LGFCADMIN entry');
    expect(ADMIN_PREFIX.test('LGFCADMIN - Anything')).toBe(true);
    expect(ADMIN_PREFIX.test('  lgfcadmin-Anything')).toBe(true);
    expect(ADMIN_PREFIX.test('The LGFCADMIN - not a prefix')).toBe(false);
  });

  it('never imports an event with any invitee, a private event, or a recurring one, and says why', () => {
    const why = Object.fromEntries(skipped.map((s) => [s.uid, s.reason]));
    expect(why['meeting-with-invitee@example']).toMatch(/invitees/);
    expect(why['private-item@example']).toMatch(/PRIVATE/);
    expect(why['yearly@example']).toMatch(/recurring/);
  });

  it('is default-deny: no UID, no title or no start date is skipped', () => {
    expect(classifyEvent({ attendees: [], summary: 'x', dtstart: '20270101' }).include).toBe(false);
    expect(classifyEvent({ attendees: [], uid: 'u', summary: '  ', dtstart: '20270101' }).include).toBe(false);
    expect(classifyEvent({ attendees: [], uid: 'u', summary: 'x' }).include).toBe(false);
    expect(classifyEvent({ attendees: [], uid: 'u', summary: 'x', dtstart: '20270101' }).include).toBe(true);
  });

  it('maps all-day dates (end exclusive in ICS), text escapes and folded lines', () => {
    const launch = rows.find((r) => r.source_uid === 'public-launch@example');
    expect(launch).toMatchObject({ title: 'LGFC website production launch', start_date: '2027-01-01', end_date: null, location: 'Online', external_url: 'https://www.lougehrigfanclub.com/' });
    expect(launch.description).toBe('The website goes live.\nJoin us, free.');
    expect(rows.find((r) => r.source_uid === 'public-multi@example')).toMatchObject({ start_date: '2027-06-01', end_date: '2027-06-03' });
    expect(rows.find((r) => r.source_uid === 'long-line@example').title).toBe('A very long title that is folded across two lines');
  });

  it('parses attendees and dry run reports counts without writing', () => {
    expect(parseIcs(ics).find((e) => e.uid === 'admin-pmo@example').attendees).toHaveLength(1);
    const report = dryRun(ics);
    expect(report.counts).toEqual({ import: 4, skipped: 5 });
  });
});

describe('calendar import: database behaviour (#4889)', () => {
  function db() {
    const d = new DatabaseSync(':memory:');
    d.exec(readFileSync(resolve(process.cwd(), 'migrations/0014_events.sql'), 'utf8'));
    d.exec(readFileSync(resolve(process.cwd(), 'migrations/0100_events_calendar_import_4889.sql'), 'utf8'));
    return d;
  }
  const run = (d, rows) => buildUpsertSql(rows).forEach((s) => d.exec(s));

  it('is idempotent: running the same feed twice leaves one row per event', () => {
    const d = db();
    const { rows } = planImport(ics, 's');
    run(d, rows);
    run(d, rows);
    expect(d.prepare('SELECT COUNT(*) AS n FROM events').get().n).toBe(4);
  });

  it('updates a changed source event, and hides a cancelled one', () => {
    const d = db();
    run(d, planImport(ics, 's').rows);
    run(d, planImport(ics.replace('LGFC website production launch', 'LGFC website launch day'), 's').rows);
    expect(d.prepare("SELECT title FROM events WHERE source_uid = 'public-launch@example'").get().title).toBe('LGFC website launch day');
    expect(d.prepare("SELECT status FROM events WHERE source_uid = 'cancelled@example'").get().status).toBe('hidden');
  });

  it('never overwrites an event an admin has locked', () => {
    const d = db();
    run(d, planImport(ics, 's').rows);
    d.exec("UPDATE events SET title = 'Edited by admin', locked = 1 WHERE source_uid = 'public-launch@example'");
    run(d, planImport(ics.replace('LGFC website production launch', 'Source changed it'), 's').rows);
    expect(d.prepare("SELECT title FROM events WHERE source_uid = 'public-launch@example'").get().title).toBe('Edited by admin');
  });

  it('leaves manually entered events (no source) alone', () => {
    const d = db();
    d.exec("INSERT INTO events (title, start_date) VALUES ('Manual', '2027-02-02')");
    run(d, planImport(ics, 's').rows);
    expect(d.prepare("SELECT COUNT(*) AS n FROM events WHERE source IS NULL").get().n).toBe(1);
  });
});
