'use client';

import { teamLabel, type GehrigBattingLine, type GehrigRandomGame } from '@/lib/gehrigBoxScoreApi';
import type { GehrigGameLoadState } from './useGehrigRandomGame';
import { clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';

const cell = {
  textAlign: 'right' as const,
  fontVariantNumeric: 'tabular-nums' as const,
  paddingLeft: 6,
  fontSize: 12,
};

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
}

function scoreLine(game: GehrigRandomGame): string {
  const vis = `${teamLabel(game.vis_team)} ${game.vis_score ?? '—'}`;
  const home = `${teamLabel(game.home_team)} ${game.home_score ?? '—'}`;
  return `${vis} at ${home}`;
}

function TeamBatting({ team, lines }: { team: string; lines: GehrigBattingLine[] }) {
  const rows = lines.filter((line) => line.team === team);
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{teamLabel(team)}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: '#4a4238' }}>
            <th style={{ textAlign: 'left', fontWeight: 600 }}>Batter</th>
            <th style={cell}>AB</th>
            <th style={cell}>R</th>
            <th style={cell}>H</th>
            <th style={cell}>HR</th>
            <th style={cell}>RBI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => (
            <tr key={`${line.team}-${line.player_id}`} style={line.is_gehrig ? { fontWeight: 700 } : undefined}>
              <td style={{ textAlign: 'left' }}>{line.player_label}</td>
              <td style={cell}>{line.ab ?? '—'}</td>
              <td style={cell}>{line.r ?? '—'}</td>
              <td style={cell}>{line.h ?? '—'}</td>
              <td style={cell}>{line.hr ?? '—'}</td>
              <td style={cell}>{line.rbi ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClubHomeGehrigBoxScore({ load }: { load: GehrigGameLoadState }) {
  return (
    <section aria-label="Lou Gehrig box score" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Lou Gehrig box score</h2>
      {load.status === 'loading' ? null : load.game ? (
        <>
          <p style={{ ...clubHomeMutedText, marginBottom: 8 }}>{formatDate(load.game.game_date)}</p>
          <p style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: 14 }}>{scoreLine(load.game)}</p>
          <TeamBatting team={load.game.vis_team} lines={load.game.batting} />
          <TeamBatting team={load.game.home_team} lines={load.game.batting} />
          <p style={{ ...clubHomeMutedText, fontSize: 11, marginTop: 8 }}>{load.game.source_credit}</p>
        </>
      ) : (
        <p style={clubHomeMutedText}>
          A random Lou Gehrig box score will appear here after Retrosheet game logs are ingested.
        </p>
      )}
    </section>
  );
}
