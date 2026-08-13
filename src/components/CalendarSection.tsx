'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './CalendarSection.module.css';

type EventRow = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  host?: string | null;
  fees?: string | null;
  description?: string | null;
  external_url?: string | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

function ymdKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function keyFromParsed(p: { y: number; m: number; d: number }): string {
  return ymdKey(p.y, p.m, p.d);
}

function uniqueEventMonths(items: EventRow[]): Array<{ y: number; m: number }> {
  const seen = new Set<string>();
  const out: Array<{ y: number; m: number }> = [];
  for (const e of items) {
    const p = parseYmd(e.start_date);
    if (!p) continue;
    const tag = `${p.y}-${p.m}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push({ y: p.y, m: p.m });
  }
  out.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.m - b.m));
  return out;
}


function calendarCells(year: number, month0: number): Array<{ key: string; dayNum: number; inMonth: boolean }> {
  const first = new Date(year, month0, 1);
  const startPad = first.getDay();
  const lastDate = new Date(year, month0 + 1, 0).getDate();
  const cells: Array<{ key: string; dayNum: number; inMonth: boolean }> = [];

  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month0, -startPad + i + 1);
    cells.push({
      key: ymdKey(d.getFullYear(), d.getMonth(), d.getDate()),
      dayNum: d.getDate(),
      inMonth: false,
    });
  }
  for (let day = 1; day <= lastDate; day++) {
    cells.push({ key: ymdKey(year, month0, day), dayNum: day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const lastKey = cells[cells.length - 1].key;
    const [yy, mm, dd] = lastKey.split('-').map(Number);
    const dt = new Date(yy, mm - 1, dd);
    dt.setDate(dt.getDate() + 1);
    cells.push({
      key: ymdKey(dt.getFullYear(), dt.getMonth(), dt.getDate()),
      dayNum: dt.getDate(),
      inMonth: false,
    });
  }
  return cells;
}

function firstDayKeyInMonth(byDay: Map<string, EventRow[]>, y: number, m: number): string | null {
  const keys = [...byDay.keys()]
    .filter((k) => {
      const p = parseYmd(k);
      return p && p.y === y && p.m === m;
    })
    .sort();
  return keys[0] ?? null;
}

export default function CalendarSection() {
  const [items, setItems] = useState<EventRow[]>([]);
  // Static export must not bake "Loading calendar…" into HTML (#3305).
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [eventMonths, setEventMonths] = useState<Array<{ y: number; m: number }>>([]);
  const [monthIndex, setMonthIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const e of items) {
      const p = parseYmd(e.start_date);
      if (!p) continue;
      const k = keyFromParsed(p);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
    }
    return map;
  }, [items]);

  const viewSlot = eventMonths[monthIndex] ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth(),
  };

  const cells = useMemo(() => calendarCells(viewSlot.y, viewSlot.m), [viewSlot.y, viewSlot.m]);

  const selectedEvents = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  const monthLabel = new Date(viewSlot.y, viewSlot.m, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const canPrevMonth = monthIndex > 0;
  const canNextMonth = monthIndex < eventMonths.length - 1;

  const applyMonthIndex = useCallback((nextIdx: number, by: Map<string, EventRow[]>) => {
    const slot = eventMonths[nextIdx];
    if (!slot) return;
    setMonthIndex(nextIdx);
    const k = firstDayKeyInMonth(by, slot.y, slot.m);
    setSelectedKey(k);
  }, [eventMonths]);

  const goPrev = () => {
    if (!canPrevMonth) return;
    applyMonthIndex(monthIndex - 1, byDay);
  };

  const goNext = () => {
    if (!canNextMonth) return;
    applyMonthIndex(monthIndex + 1, byDay);
  };

  const formatDetailDate = (k: string) => {
    const p = parseYmd(k);
    if (!p) return k;
    return new Date(p.y, p.m, p.d).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  useEffect(() => {
    let alive = true;

    const finishEmpty = (message: string) => {
      const now = new Date();
      setItems([]);
      setNotice(message);
      setEventMonths([{ y: now.getFullYear(), m: now.getMonth() }]);
      setMonthIndex(0);
      setSelectedKey(null);
      setLoading(false);
    };

    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/events/next?limit=10', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!alive) return;

        if (!res.ok || !data?.ok) {
          finishEmpty('Live schedule is temporarily unavailable. Check back soon.');
          return;
        }

        const rows: EventRow[] = Array.isArray(data.items) ? data.items : [];
        if (rows.length === 0) {
          finishEmpty('No posted events yet for the weeks ahead. Check back soon.');
          return;
        }

        const months = uniqueEventMonths(rows);
        const head = parseYmd(rows[0].start_date);
        const initial = head
          ? { y: head.y, m: head.m }
          : months[0] ?? { y: new Date().getFullYear(), m: new Date().getMonth() };
        const idx = Math.max(
          0,
          months.findIndex((mm) => mm.y === initial.y && mm.m === initial.m)
        );
        const indexToUse = months.length ? idx : 0;
        const monthsToUse = months.length ? months : [initial];

        const map = new Map<string, EventRow[]>();
        for (const e of rows) {
          const p = parseYmd(e.start_date);
          if (!p) continue;
          const k = keyFromParsed(p);
          const arr = map.get(k) ?? [];
          arr.push(e);
          map.set(k, arr);
        }
        for (const [, arr] of map) {
          arr.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
        }

        const slot = monthsToUse[indexToUse] ?? initial;
        const firstSelected =
          (head && keyFromParsed(head)) ||
          firstDayKeyInMonth(map, slot.y, slot.m) ||
          null;

        setItems(rows);
        setNotice('');
        setEventMonths(monthsToUse);
        setMonthIndex(indexToUse);
        setSelectedKey(firstSelected);
      } catch {
        if (!alive) return;
        finishEmpty('Live schedule is temporarily unavailable. Check back soon.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className={styles.calendar} aria-label="Fan Club Events Calendar">
      <h2 className="section-title">Fan Club Events Calendar</h2>

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      <div className={styles.shell}>
        {loading ? (
          <p className={styles.loading}>Loading calendar…</p>
        ) : (
          <div className={styles.layout}>
            <div className={styles.monthCard}>
              <div className={styles.monthHeader}>
                <button
                  type="button"
                  className={styles.monthNav}
                  onClick={goPrev}
                  disabled={!canPrevMonth}
                  aria-label="Previous month with events"
                >
                  ‹
                </button>
                <h3 className={styles.monthTitle} id="calendar-month-label">
                  {monthLabel}
                </h3>
                <button
                  type="button"
                  className={styles.monthNav}
                  onClick={goNext}
                  disabled={!canNextMonth}
                  aria-label="Next month with events"
                >
                  ›
                </button>
              </div>

              <div className={styles.weekdayRow} aria-hidden="true">
                {WEEKDAYS.map((w) => (
                  <div key={w} className={styles.weekdayCell}>
                    {w}
                  </div>
                ))}
              </div>

              <div className={styles.dayGrid} aria-labelledby="calendar-month-label">
                {cells.map((c) => {
                  const hasEvents = c.inMonth && byDay.has(c.key);
                  const isSelected = selectedKey === c.key;
                  const count = byDay.get(c.key)?.length ?? 0;

                  if (!c.inMonth) {
                    return (
                      <div key={c.key} className={styles.dayCellMuted} aria-hidden="true">
                        <span className={styles.dayNumMuted}>{c.dayNum}</span>
                      </div>
                    );
                  }

                  if (hasEvents) {
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className={`${styles.dayCell} ${isSelected ? styles.dayCellSelected : ''}`}
                        onClick={() => setSelectedKey(c.key)}
                        aria-pressed={isSelected}
                        aria-label={`${c.dayNum} ${monthLabel}, ${count} event${count === 1 ? '' : 's'}`}
                      >
                        <span className={styles.dayNum}>{c.dayNum}</span>
                        <span className={styles.eventDot} aria-hidden="true" />
                      </button>
                    );
                  }

                  return (
                    <div key={c.key} className={styles.dayCellInactive}>
                      <span className={styles.dayNum}>{c.dayNum}</span>
                    </div>
                  );
                })}
              </div>

              <p className={styles.hint}>Days with a dot have posted events. Select a day for details.</p>
            </div>

            <aside className={styles.details} aria-live="polite">
              <h3 className={styles.detailsTitle}>
                {selectedKey ? formatDetailDate(selectedKey) : 'Select a day'}
              </h3>

              {!selectedKey || selectedEvents.length === 0 ? (
                <p className={styles.detailsEmpty}>
                  {selectedKey
                    ? 'No items on this day in the current view.'
                    : 'Choose a highlighted day on the calendar to see event details.'}
                </p>
              ) : (
                <ul className={styles.detailsList}>
                  {selectedEvents.map((e) => (
                    <li key={e.id} className={styles.detailsItem}>
                      <div className={styles.detailsItemTitle}>{e.title}</div>
                      <div className={styles.detailsMeta}>
                        {e.start_date}
                        {e.end_date && e.end_date !== e.start_date ? ` → ${e.end_date}` : ''}
                        {e.location ? ` • ${e.location}` : ''}
                        {e.host ? ` • Host: ${e.host}` : ''}
                        {e.fees ? ` • ${e.fees}` : ''}
                      </div>
                      {e.description ? <p className={styles.detailsDesc}>{e.description}</p> : null}
                      {e.external_url ? (
                        <a
                          className={styles.detailsLink}
                          href={e.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Details (opens new tab)
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
