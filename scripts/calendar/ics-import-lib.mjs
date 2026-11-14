/**
 * Calendar import for the public events list (#4889). Pure functions: parse an ICS feed, decide which events may
 * appear on the website, map them to `events` rows, and build an idempotent upsert.
 *
 * Product Authority rules (2026-11-14):
 *  - Website entries have NO invitees. Admin entries (titles starting "LGFCADMIN - ") invite the owner.
 *  - So an event is imported only if it has no attendees and its title does not start with "LGFCADMIN - ".
 *  - Private or confidential events, cancelled events (they are hidden, not deleted), and events with no start
 *    date are never shown. Recurring events are skipped in this version and reported.
 * Default-deny: anything that is not clearly a public website event is skipped with a reason.
 */

export const ADMIN_PREFIX = /^\s*lgfcadmin\s*-/i;

/** Unfold RFC 5545 continuation lines and split into content lines. */
function unfold(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescapeText(v) {
  return String(v ?? '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\');
}

/** Parse the VEVENT blocks of an ICS feed. */
export function parseIcs(text) {
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = { attendees: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const head = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...params] = head.split(';');
    const key = name.toUpperCase();
    if (key === 'ATTENDEE') cur.attendees.push(value);
    else if (key === 'SUMMARY') cur.summary = unescapeText(value);
    else if (key === 'UID') cur.uid = value.trim();
    else if (key === 'DTSTART') { cur.dtstart = value.trim(); cur.allDay = params.some((p) => /VALUE=DATE$/i.test(p)) || /^\d{8}$/.test(value.trim()); }
    else if (key === 'DTEND') cur.dtend = value.trim();
    else if (key === 'LOCATION') cur.location = unescapeText(value);
    else if (key === 'DESCRIPTION') cur.description = unescapeText(value);
    else if (key === 'URL') cur.url = value.trim();
    else if (key === 'STATUS') cur.status = value.trim().toUpperCase();
    else if (key === 'CLASS') cur.class = value.trim().toUpperCase();
    else if (key === 'RRULE') cur.rrule = value.trim();
    else if (key === 'RECURRENCE-ID') cur.recurrenceId = value.trim();
  }
  return events;
}

const toDate = (v) => (v && /^\d{8}/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : null);

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Decide whether an event may appear on the website. Returns { include, hide, reason }. */
export function classifyEvent(e) {
  if (!e.uid) return { include: false, reason: 'no UID' };
  if (e.attendees.length > 0) return { include: false, reason: 'has invitees (admin or private meeting)' };
  if (ADMIN_PREFIX.test(e.summary ?? '')) return { include: false, reason: 'LGFCADMIN entry' };
  if (e.class === 'PRIVATE' || e.class === 'CONFIDENTIAL') return { include: false, reason: `class ${e.class}` };
  if (e.rrule || e.recurrenceId) return { include: false, reason: 'recurring event (not supported yet)' };
  if (!toDate(e.dtstart)) return { include: false, reason: 'no start date' };
  if (!String(e.summary ?? '').trim()) return { include: false, reason: 'no title' };
  return { include: true, hide: e.status === 'CANCELLED', reason: e.status === 'CANCELLED' ? 'cancelled: hide' : 'ok' };
}

/** Map an included event to an `events` row. All-day DTEND is exclusive in ICS, so the last day is one earlier. */
export function toEventRow(e, source) {
  const start = toDate(e.dtstart);
  let end = toDate(e.dtend);
  if (end && e.allDay) end = addDays(end, -1);
  if (end && end <= start) end = null;
  return {
    source,
    source_uid: e.uid,
    title: e.summary.trim(),
    start_date: start,
    end_date: end,
    location: e.location?.trim() || null,
    description: e.description?.trim() || null,
    external_url: e.url || null,
    status: e.status === 'CANCELLED' ? 'hidden' : 'posted',
  };
}

/** Plan an import: rows to write and every skipped event with its reason. Nothing is written. */
export function planImport(icsText, source) {
  const rows = [];
  const skipped = [];
  for (const e of parseIcs(icsText)) {
    const verdict = classifyEvent(e);
    if (!verdict.include) skipped.push({ uid: e.uid ?? null, title: e.summary ?? null, reason: verdict.reason });
    else rows.push(toEventRow(e, source));
  }
  return { rows, skipped };
}

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

/**
 * One idempotent upsert per row. A row an admin has locked (`locked = 1`) is never changed by the import.
 * Re-running the same feed changes nothing.
 */
export function buildUpsertSql(rows) {
  return rows.map((r) =>
    `INSERT INTO events (source, source_uid, title, start_date, end_date, location, description, external_url, status) ` +
    `VALUES (${q(r.source)}, ${q(r.source_uid)}, ${q(r.title)}, ${q(r.start_date)}, ${q(r.end_date)}, ${q(r.location)}, ${q(r.description)}, ${q(r.external_url)}, ${q(r.status)}) ` +
    `ON CONFLICT(source, source_uid) WHERE source IS NOT NULL DO UPDATE SET ` +
    `title = excluded.title, start_date = excluded.start_date, end_date = excluded.end_date, location = excluded.location, ` +
    `description = excluded.description, external_url = excluded.external_url, status = excluded.status, updated_at = datetime('now') ` +
    `WHERE events.locked = 0;`,
  );
}
