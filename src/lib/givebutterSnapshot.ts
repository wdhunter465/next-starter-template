// Client-side shape, ranking and sample data for the admin leaderboard preview (#4993, #4432).
// Aggregate fields only (#4139). Ranking is plain amount raised (#4415), no points formula.

export type SnapshotParticipant = {
  id: string;
  displayName: string;
  raised: number;
  goal: number | null;
  supporters: number;
  pageUrl: string | null;
};

export type SnapshotTeam = {
  id: string;
  name: string;
  raised: number;
  goal: number | null;
  supporters: number;
  members: number;
};

export type LeaderboardSnapshot = {
  capturedAt: string;
  campaign: {
    title: string;
    status: string;
    raised: number;
    goal: number | null;
    supporters: number;
  };
  participants: SnapshotParticipant[];
  teams: SnapshotTeam[];
};

export const LEADERBOARD_ADMIN_DISPLAY_COUNT = 10;

/** Higher raised first, then more supporters, then name; stable and deterministic. */
export function rankParticipants(participants: SnapshotParticipant[]): SnapshotParticipant[] {
  return [...participants].sort(
    (a, b) =>
      b.raised - a.raised ||
      b.supporters - a.supporters ||
      a.displayName.localeCompare(b.displayName) ||
      a.id.localeCompare(b.id),
  );
}

export function rankTeams(teams: SnapshotTeam[]): SnapshotTeam[] {
  return [...teams].sort(
    (a, b) => b.raised - a.raised || b.supporters - a.supporters || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

export function progressPercent(raised: number, goal: number | null): number | null {
  if (goal === null || goal <= 0) return null;
  return Math.min(100, Math.round((raised / goal) * 100));
}

export function formatDollars(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/** Invented names and amounts. Shown only when the live connection is not configured. */
export const SAMPLE_LEADERBOARD_SNAPSHOT: LeaderboardSnapshot = {
  capturedAt: '2027-04-15T14:00:00.000Z',
  campaign: { title: '2027 ALS Fundraiser (sample)', status: 'active', raised: 4120, goal: 10000, supporters: 96 },
  participants: [
    { id: 's1', displayName: 'Sample Fundraiser A', raised: 1250, goal: 1500, supporters: 28, pageUrl: null },
    { id: 's2', displayName: 'Sample Fundraiser B', raised: 980, goal: 1000, supporters: 22, pageUrl: null },
    { id: 's3', displayName: 'Sample Fundraiser C', raised: 610, goal: 1000, supporters: 15, pageUrl: null },
    { id: 's4', displayName: 'Sample Fundraiser D', raised: 450, goal: 750, supporters: 12, pageUrl: null },
    { id: 's5', displayName: 'Sample Fundraiser E', raised: 300, goal: 500, supporters: 9, pageUrl: null },
    { id: 's6', displayName: 'Sample Fundraiser F', raised: 210, goal: 500, supporters: 6, pageUrl: null },
    { id: 's7', displayName: 'Sample Fundraiser G', raised: 120, goal: 250, supporters: 4, pageUrl: null },
  ],
  teams: [
    { id: 't1', name: 'Sample Team One', raised: 1860, goal: 3000, supporters: 43, members: 3 },
    { id: 't2', name: 'Sample Team Two', raised: 750, goal: 2000, supporters: 18, members: 2 },
  ],
};
