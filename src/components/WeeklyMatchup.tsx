'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { WEEKLY_MATCHUP_HOLD } from '@/lib/matchup-hold';

type Photo = {
  id: number;
  url: string;
  description?: string;
  title?: string;
};

type CurrentResp = {
  ok: boolean;
  week_start?: string;
  matchup_id?: number;
  items: Photo[];
};

type VoteResp = {
  ok: boolean;
  week_start: string;
  choice: 'a' | 'b';
  already_voted: boolean;
  totals: { a: number; b: number };
};

type ResultsResp = {
  ok: boolean;
  week_start: string | null;
  totals: { a: number; b: number };
  last_week: null | {
    week_start: string;
    totals: { a: number; b: number };
    winner: 'a' | 'b' | 'tie';
    winner_photo?: { id: number; url: string; alt?: string } | null;
  };
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
  alignItems: 'start',
};

const photoFrameStyle: CSSProperties = {
  width: '100%',
  height: 440,
  borderRadius: 12,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f3f4f6',
};

const photoStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'center',
  display: 'block',
};

/** Vote lock is pair-scoped so mid-week photo replacement unlocks voting for the new pair. */
export function weeklyVoteStorageKey(weekStart: string, photoAId: number, photoBId: number): string {
  return `lgfc_weekly_vote_${weekStart}_${photoAId}_${photoBId}`;
}

/** Legacy week-only lock from before pair-scoped keys; must not block a replaced pair. */
export function legacyWeeklyVoteStorageKey(weekStart: string): string {
  return `lgfc_weekly_vote_${weekStart}`;
}

/**
 * Keep only the lock for the current photo pair.
 * Drops the legacy week-only key and any prior-pair keys for this week.
 * Returns the current lock state after cleanup.
 */
export function syncWeeklyVoteLock(
  weekStart: string,
  photoAId: number,
  photoBId: number,
): { voteKey: string; voted: boolean } {
  const voteKey = weeklyVoteStorageKey(weekStart, photoAId, photoBId);
  const prefix = `lgfc_weekly_vote_${weekStart}`;

  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    if (key !== voteKey) {
      window.localStorage.removeItem(key);
    }
  }

  return { voteKey, voted: window.localStorage.getItem(voteKey) === '1' };
}

type RepairResp = CurrentResp & {
  repaired?: boolean;
  mutated?: boolean;
  mutation_blocked?: boolean;
  mutation_blocked_reason?: string;
  excluded_broken_photo_id?: number;
};

export default function WeeklyMatchup() {
  const [items, setItems] = useState<Photo[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  // Static export must not bake "Loading matchup…" into HTML (#3305).
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [hasVoted, setHasVoted] = useState(false);
  const [totals, setTotals] = useState<{ a: number; b: number } | null>(null);
  const [lastWeek, setLastWeek] = useState<ResultsResp['last_week']>(null);
  const repairAttemptsRef = useRef(0);
  const matchupPaused = WEEKLY_MATCHUP_HOLD.active;

  async function applyCurrentMatchup(data: CurrentResp) {
    const gotWeek = data.week_start ?? null;
    const nextItems = (data.items ?? []).slice(0, 2);

    setWeekStart(gotWeek);
    setItems(nextItems);

    if (gotWeek && nextItems.length >= 2) {
      const synced = syncWeeklyVoteLock(gotWeek, nextItems[0].id, nextItems[1].id);
      const voteKey = synced.voteKey;
      let voted = synced.voted;

      if (voted) {
        const r = await apiGet<ResultsResp>(`/api/matchup/results?week_start=${encodeURIComponent(gotWeek)}`);
        const totalVotes = Number(r.totals?.a || 0) + Number(r.totals?.b || 0);
        if (totalVotes === 0) {
          window.localStorage.removeItem(voteKey);
          voted = false;
          setHasVoted(false);
          setTotals(null);
          setLastWeek(null);
        } else {
          setHasVoted(true);
          setTotals(r.totals);
          setLastWeek(r.last_week);
        }
      } else {
        setHasVoted(false);
        setTotals(null);
        setLastWeek(null);
      }
    } else {
      setHasVoted(false);
      setTotals(null);
      setLastWeek(null);
    }
  }

  useEffect(() => {
    if (matchupPaused) return;
    async function load() {
      try {
        setErr(null);
        setLoading(true);

        const data = await apiGet<CurrentResp>('/api/matchup/current');
        await applyCurrentMatchup(data);
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setErr(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        setLoading(false);
      }
    }, 10000);

    load().finally(() => {
      completed = true;
      clearTimeout(timer);
    });

    return () => {
      clearTimeout(timer);
    };
  }, [matchupPaused]);

  async function repairBrokenPhoto(brokenPhotoId: number) {
    if (repairing || repairAttemptsRef.current >= 2) return;
    repairAttemptsRef.current += 1;
    try {
      setRepairing(true);
      setErr(null);
      const data = await apiPost<RepairResp>('/api/matchup/repair', {
        broken_photo_id: brokenPhotoId,
      });
      await applyCurrentMatchup(data);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setErr(errorMsg);
    } finally {
      setRepairing(false);
    }
  }

  async function submit(choice: 'a' | 'b') {
    if (!weekStart) return;
    try {
      setSubmitting(true);
      setErr(null);

      if (items.length < 2) return;
      const r = await apiPost<VoteResp>('/api/matchup/vote', { week_start: weekStart, choice });
      window.localStorage.setItem(weeklyVoteStorageKey(weekStart, items[0].id, items[1].id), '1');
      setHasVoted(true);
      setTotals(r.totals);

      const rr = await apiGet<ResultsResp>(`/api/matchup/results?week_start=${encodeURIComponent(weekStart)}`);
      setLastWeek(rr.last_week);
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setErr(errorMsg);
    } finally {
      setSubmitting(false);
    }
  }

  const hasMatchup = !loading && !err && items.length >= 2;

  return (
    <div className="card">
      <h2 className="title-lgfc" style={{ marginTop: 24 }}>Weekly Photo Matchup</h2>

      {matchupPaused && <div style={{ paddingTop: 12 }}>Weekly Matchup is temporarily paused.</div>}

      {!matchupPaused && loading && <div style={{ paddingTop: 12 }}>Loading matchup…</div>}
      {!matchupPaused && repairing && <div style={{ paddingTop: 12 }}>Refreshing photos…</div>}
      {!matchupPaused && !loading && err && <div style={{ paddingTop: 12 }}>{err}</div>}
      {!matchupPaused && !loading && !err && items.length < 2 && <div style={{ paddingTop: 12 }}>No matchup available this week.</div>}

      {!matchupPaused && hasMatchup &&
        renderMatchupBody(items, hasVoted, submitting || repairing, totals, lastWeek, submit, repairBrokenPhoto)}
    </div>
  );
}

function LastWeekWinnerThumbnail({ photo }: { photo: { url: string; alt?: string } }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <img
      src={photo.url}
      alt={photo.alt || 'Last week winning photo'}
      onError={() => setHidden(true)}
      style={{
        marginTop: 8,
        width: 96,
        height: 96,
        objectFit: 'cover',
        objectPosition: 'center',
        borderRadius: 8,
        display: 'block',
      }}
    />
  );
}

function renderMatchupBody(
  items: { id: number; url: string; description?: string; title?: string }[],
  hasVoted: boolean,
  submitting: boolean,
  totals: { a: number; b: number } | null,
  lastWeek: {
    week_start: string;
    totals: { a: number; b: number };
    winner: 'a' | 'b' | 'tie';
    winner_photo?: { id: number; url: string; alt?: string } | null;
  } | null,
  submit: (choice: 'a' | 'b') => void,
  onBrokenPhoto: (photoId: number) => void,
) {
  const a = items[0];
  const b = items[1];
  const resultsAnchorId = 'weekly-matchup-results';

  return (
    <>
      <div style={gridStyle}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={photoFrameStyle}>
            <img
              src={a.url}
              alt={a.description || 'Lou Gehrig'}
              style={photoStyle}
              onError={() => onBrokenPhoto(a.id)}
            />
          </div>

          <div className="sub" style={{ marginTop: 10 }}>{a.title || a.description || 'Photo A'}</div>

          {!hasVoted && (
            <button
              disabled={submitting}
              onClick={() => submit('a')}
              className="btn"
              style={{ marginTop: 12, width: '100%' }}
            >
              {submitting ? 'Submitting…' : 'Vote A'}
            </button>
          )}
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <div style={photoFrameStyle}>
            <img
              src={b.url}
              alt={b.description || 'Lou Gehrig'}
              style={photoStyle}
              onError={() => onBrokenPhoto(b.id)}
            />
          </div>

          <div className="sub" style={{ marginTop: 10 }}>{b.title || b.description || 'Photo B'}</div>

          {!hasVoted && (
            <button
              disabled={submitting}
              onClick={() => submit('b')}
              className="btn"
              style={{ marginTop: 12, width: '100%' }}
            >
              {submitting ? 'Submitting…' : 'Vote B'}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {hasVoted ? (
          <a href={`#${resultsAnchorId}`}>Current Voting</a>
        ) : (
          <span>Current Voting</span>
        )}
      </div>

      {hasVoted && totals && (
        <div id={resultsAnchorId} style={{ marginTop: 16, scrollMarginTop: 96 }}>
          <div style={{ fontWeight: 800, color: 'var(--lgfc-blue)' }}>Results (revealed)</div>
          <div className="sub" style={{ marginTop: 6 }}>A: {totals.a} · B: {totals.b}</div>

          {lastWeek && (
            <div className="sub" style={{ marginTop: 10, opacity: 0.85 }}>
              Last closed week ({lastWeek.week_start}): A {lastWeek.totals.a} · B {lastWeek.totals.b} · Winner: {lastWeek.winner.toUpperCase()}
              {lastWeek.winner_photo?.url && (
                <LastWeekWinnerThumbnail photo={lastWeek.winner_photo} />
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
