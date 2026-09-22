'use client';

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

function formatPct(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}

function formatGb(value: number): string {
  if (value === 0) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function ClubHomeAlStandings({ load }: { load: GehrigGameLoadState }) {
  return (
    <section aria-label="American League standings" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>AL standings</h2>
      {load.status === 'loading' ? null : load.game && load.game.standings.length > 0 ? (
        <>
          <p style={{ ...clubHomeMutedText, marginBottom: 8 }}>As of {formatDate(load.game.game_date)}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#4a4238' }}>
                <th style={{ textAlign: 'left', fontWeight: 600 }}>Team</th>
                <th style={cell}>W</th>
                <th style={cell}>L</th>
                <th style={cell}>Pct</th>
                <th style={cell}>GB</th>
              </tr>
            </thead>
            <tbody>
              {load.game.standings.map((row) => (
                <tr key={row.team} style={row.is_yankees ? { fontWeight: 700 } : undefined}>
                  <td style={{ textAlign: 'left' }}>{row.team_label}</td>
                  <td style={cell}>{row.wins}</td>
                  <td style={cell}>{row.losses}</td>
                  <td style={cell}>{formatPct(row.win_pct)}</td>
                  <td style={cell}>{formatGb(row.games_back)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...clubHomeMutedText, fontSize: 11, marginTop: 8 }}>{load.game.source_credit}</p>
        </>
      ) : (
        <p style={clubHomeMutedText}>
          American League standings as of a random Gehrig game date will appear here after ingest.
        </p>
      )}
    </section>
  );
}
