'use client';

import React, { useCallback, useState } from 'react';
import { adminJson } from '@/lib/adminClient';
import {
  LEADERBOARD_ADMIN_DISPLAY_COUNT,
  SAMPLE_LEADERBOARD_SNAPSHOT,
  formatDollars,
  progressPercent,
  rankParticipants,
  rankTeams,
  type LeaderboardSnapshot,
} from '@/lib/givebutterSnapshot';

type SnapshotResponse =
  | { ok: true; configured: false }
  | { ok: true; configured: true; snapshot: LeaderboardSnapshot };

type Source = 'sample' | 'live';

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 16,
  padding: 18,
  background: 'var(--lgfc-bg-card)',
};

function ProgressBar({ raised, goal }: { raised: number; goal: number | null }) {
  const percent = progressPercent(raised, goal);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>{formatDollars(raised)} raised</span>
        <span>{goal === null ? 'No goal set' : `Goal ${formatDollars(goal)}`}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Campaign progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? 0}
        style={{ height: 14, borderRadius: 999, background: 'rgba(0,0,0,0.1)', overflow: 'hidden', marginTop: 8 }}
      >
        <div style={{ width: `${percent ?? 0}%`, height: '100%', background: 'var(--lgfc-blue, #0033cc)' }} />
      </div>
      {percent !== null ? <div style={{ marginTop: 6 }}>{percent}% of goal</div> : null}
    </div>
  );
}

export default function LeaderboardPreview() {
  const [snapshot, setSnapshot] = useState<LeaderboardSnapshot>(SAMPLE_LEADERBOARD_SNAPSHOT);
  const [source, setSource] = useState<Source>('sample');
  const [message, setMessage] = useState(
    'Showing synthetic sample data. Check the Givebutter connection to load live totals.',
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('Checking the Givebutter connection…');
    const result = await adminJson<SnapshotResponse>('/api/admin/givebutter-snapshot');
    setLoading(false);

    if (!result.ok || !result.data) {
      // Fail closed: keep whatever is already shown and say what went wrong.
      setError(`Error: ${result.error || 'Connection check failed.'}`);
      setMessage(
        source === 'live'
          ? 'Refresh failed. The last good live snapshot stays on screen.'
          : 'Connection failed. Still showing synthetic sample data.',
      );
      return;
    }

    if (!result.data.configured) {
      setSnapshot(SAMPLE_LEADERBOARD_SNAPSHOT);
      setSource('sample');
      setMessage(
        'Not configured: GIVEBUTTER_API_KEY and GIVEBUTTER_CAMPAIGN_ID are not set. Showing synthetic sample data.',
      );
      return;
    }

    setSnapshot(result.data.snapshot);
    setSource('live');
    setMessage('Connected to Givebutter. Showing live aggregate totals.');
  }, [source]);

  const participants = rankParticipants(snapshot.participants).slice(0, LEADERBOARD_ADMIN_DISPLAY_COUNT);
  const teams = rankTeams(snapshot.teams);

  return (
    <section style={cardStyle} aria-labelledby="leaderboard-preview-heading">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 id="leaderboard-preview-heading" style={{ marginTop: 0 }}>
          Leaderboard Preview
        </h2>
        <button
          type="button"
          onClick={checkConnection}
          disabled={loading}
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.18)',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Checking…' : 'Check Givebutter connection'}
        </button>
      </div>

      <p style={{ marginTop: 0 }}>
        <strong>{source === 'live' ? 'Live data' : 'Sample data'}</strong> · Admin only, not shown on any public or
        member page. Aggregate totals only; no donor information is stored or shown.
      </p>
      <p role="status" style={{ marginTop: 0 }}>
        {message}
      </p>
      {error ? (
        <p role="alert" style={{ color: 'var(--lgfc-error, #b00020)', fontWeight: 700 }}>
          {error}
        </p>
      ) : null}

      <h3>{snapshot.campaign.title}</h3>
      <ProgressBar raised={snapshot.campaign.raised} goal={snapshot.campaign.goal} />
      <p>
        {snapshot.campaign.supporters} supporters · Status: {snapshot.campaign.status} · Last updated{' '}
        {new Date(snapshot.capturedAt).toUTCString()}
      </p>

      <h3>Top participants</h3>
      {participants.length === 0 ? (
        <p>No participants have registered yet. The public leaderboard stays hidden until there are entries.</p>
      ) : (
        <ol aria-label="Top participants" style={{ paddingLeft: 22 }}>
          {participants.map((p) => (
            <li key={p.id} style={{ marginBottom: 6 }}>
              <strong>{p.displayName}</strong> — {formatDollars(p.raised)} · {p.supporters} supporters
            </li>
          ))}
        </ol>
      )}

      {teams.length > 0 ? (
        <>
          <h3>Teams</h3>
          <ol aria-label="Teams" style={{ paddingLeft: 22 }}>
            {teams.map((t) => (
              <li key={t.id} style={{ marginBottom: 6 }}>
                <strong>{t.name}</strong> — {formatDollars(t.raised)} · {t.supporters} supporters · {t.members} members
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
