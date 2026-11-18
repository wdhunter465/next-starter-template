import { describe, expect, it } from 'vitest';

import {
  SAMPLE_FUNDRAISER_PARTICIPANTS,
  aggregateFundraiserParticipants,
  buildFundraiserLeaderboardSnapshot,
  rankChampion,
  rankFundingTheFight,
  rankRaisingAwareness,
} from '@/lib/fundraiser-leaderboard';

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }

  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }

  return keys;
}

describe('fundraiser leaderboard sample dry run (#4432)', () => {
  it('excludes aggregates outside the 2027 fundraiser window', () => {
    const casey = aggregateFundraiserParticipants(SAMPLE_FUNDRAISER_PARTICIPANTS).find(
      (participant) => participant.participantId === 'casey-nguyen',
    );
    const morgan = aggregateFundraiserParticipants(SAMPLE_FUNDRAISER_PARTICIPANTS).find(
      (participant) => participant.participantId === 'morgan-patel',
    );

    expect(casey).toMatchObject({ raised: 850, donors: 12, championPoints: 862 });
    expect(morgan).toMatchObject({ raised: 820, donors: 40, championPoints: 860 });
  });

  it('builds overall progress from aggregate participant totals only', () => {
    const snapshot = buildFundraiserLeaderboardSnapshot();

    expect(snapshot.window).toEqual({
      startDate: '2027-03-25',
      endDate: '2027-06-07',
      timeZone: 'America/New_York',
    });
    expect(snapshot.overall).toEqual({ raised: 3620, donors: 88, progressPercent: 36.2 });
  });

  it('ranks Funding the Fight by funds raised with name as the deterministic tie placeholder', () => {
    const board = rankFundingTheFight(aggregateFundraiserParticipants(SAMPLE_FUNDRAISER_PARTICIPANTS));

    expect(board.map((entry) => [entry.rank, entry.displayName, entry.raised])).toEqual([
      [1, 'Jordan Lee', 1100],
      [2, 'Avery Rivera', 850],
      [3, 'Casey Nguyen', 850],
      [4, 'Morgan Patel', 820],
    ]);
  });

  it('ranks Raising Awareness by donor count', () => {
    const board = rankRaisingAwareness(aggregateFundraiserParticipants(SAMPLE_FUNDRAISER_PARTICIPANTS));

    expect(board.map((entry) => [entry.rank, entry.displayName, entry.donors])).toEqual([
      [1, 'Morgan Patel', 40],
      [2, 'Avery Rivera', 30],
      [3, 'Casey Nguyen', 12],
      [4, 'Jordan Lee', 6],
    ]);
  });

  it('ranks Champion by dollars raised plus donors', () => {
    const board = rankChampion(aggregateFundraiserParticipants(SAMPLE_FUNDRAISER_PARTICIPANTS));

    expect(board.map((entry) => [entry.rank, entry.displayName, entry.championPoints])).toEqual([
      [1, 'Jordan Lee', 1106],
      [2, 'Avery Rivera', 880],
      [3, 'Casey Nguyen', 862],
      [4, 'Morgan Patel', 860],
    ]);
  });

  it('keeps sample data and dry-run snapshots free of donor personal fields', () => {
    const forbiddenKeys = ['address', 'donorEmail', 'donorName', 'donorPhone', 'email', 'firstName', 'lastName', 'phone'];
    const sampleKeys = collectKeys(SAMPLE_FUNDRAISER_PARTICIPANTS);
    const snapshotKeys = collectKeys(buildFundraiserLeaderboardSnapshot());

    for (const key of forbiddenKeys) {
      expect(sampleKeys.has(key)).toBe(false);
      expect(snapshotKeys.has(key)).toBe(false);
    }
  });

  it('rejects unsupported donor personal fields before aggregation', () => {
    expect(() =>
      aggregateFundraiserParticipants([
        {
          participantId: 'bad-sample',
          displayName: 'Bad Sample',
          email: 'donor@example.com',
          aggregates: [{ date: '2027-04-01', raised: 10, donors: 1 }],
        },
      ]),
    ).toThrow(/unsupported field "email"/i);
  });
});
