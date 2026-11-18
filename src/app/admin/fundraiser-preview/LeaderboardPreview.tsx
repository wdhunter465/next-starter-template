'use client';

import React from 'react';
import {
  buildFundraiserLeaderboardSnapshot,
  formatFundraiserDollars,
  type FundraiserBoardEntry,
  type FundraiserLeaderboardSnapshot,
} from '@/lib/fundraiser-leaderboard';

const cardStyle: React.CSSProperties = {
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 16,
  padding: 18,
  background: 'var(--lgfc-bg-card)',
};

function ProgressBar({ snapshot }: { snapshot: FundraiserLeaderboardSnapshot }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>{formatFundraiserDollars(snapshot.overall.raised)} raised</span>
        <span>Goal {formatFundraiserDollars(snapshot.goal)}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Campaign progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={snapshot.overall.progressPercent}
        style={{ height: 14, borderRadius: 999, background: 'rgba(0,0,0,0.1)', overflow: 'hidden', marginTop: 8 }}
      >
        <div
          style={{
            width: `${snapshot.overall.progressPercent}%`,
            height: '100%',
            background: 'var(--lgfc-blue, #0033cc)',
          }}
        />
      </div>
      <div style={{ marginTop: 6 }}>{snapshot.overall.progressPercent}% of goal</div>
    </div>
  );
}

function Board({
  title,
  description,
  entries,
  metric,
}: {
  title: string;
  description: string;
  entries: FundraiserBoardEntry[];
  metric: (entry: FundraiserBoardEntry) => string;
}) {
  return (
    <section style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: 14 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ marginTop: 0, opacity: 0.85 }}>{description}</p>
      <ol aria-label={title} style={{ paddingLeft: 22 }}>
        {entries.map((entry) => (
          <li key={entry.participantId} style={{ marginBottom: 6 }}>
            <strong>{entry.displayName}</strong> — {metric(entry)}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function LeaderboardPreview() {
  const snapshot = buildFundraiserLeaderboardSnapshot();

  return (
    <section style={cardStyle} aria-labelledby="leaderboard-preview-heading">
      <h2 id="leaderboard-preview-heading" style={{ marginTop: 0 }}>
        2027 Leaderboard Dry Run
      </h2>

      <p style={{ marginTop: 0 }}>
        <strong>Sample data only</strong> · Admin only, not shown on any public or member page. Aggregate participant
        totals only; no donor personal information is stored, logged, or displayed.
      </p>
      <p role="status" style={{ marginTop: 0 }}>
        Givebutter live reads remain held. This preview computes the approved three boards from synthetic aggregate
        sample data for {snapshot.window.startDate} through {snapshot.window.endDate} ({snapshot.window.timeZone}).
      </p>

      <h3>Overall progress</h3>
      <ProgressBar snapshot={snapshot} />
      <p>
        {snapshot.overall.donors} donors · {snapshot.participants.length} participants · Dry-run snapshot{' '}
        {new Date(snapshot.capturedAt).toUTCString()}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Board
          title="Funding the Fight"
          description="Most funds raised."
          entries={snapshot.boards.fundingTheFight}
          metric={(entry) => `${formatFundraiserDollars(entry.raised)} raised`}
        />
        <Board
          title="Raising Awareness"
          description="Most donors."
          entries={snapshot.boards.raisingAwareness}
          metric={(entry) => `${entry.donors} donors`}
        />
        <Board
          title="Champion"
          description="Points = dollars raised + donors."
          entries={snapshot.boards.champion}
          metric={(entry) => `${entry.championPoints} points`}
        />
      </div>
    </section>
  );
}
