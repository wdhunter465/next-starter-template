export const FUNDRAISER_LEADERBOARD_GOAL = 10000;
export const FUNDRAISER_LEADERBOARD_TIME_ZONE = 'America/New_York';
export const FUNDRAISER_LEADERBOARD_WINDOW_START = '2027-03-25';
export const FUNDRAISER_LEADERBOARD_WINDOW_END = '2027-06-07';

export type FundraiserDailyAggregate = {
  date: string;
  raised: number;
  donors: number;
};

export type FundraiserParticipantSample = {
  participantId: string;
  displayName: string;
  aggregates: FundraiserDailyAggregate[];
};

export type FundraiserParticipantStanding = {
  participantId: string;
  displayName: string;
  raised: number;
  donors: number;
  championPoints: number;
};

export type FundraiserBoardEntry = FundraiserParticipantStanding & {
  rank: number;
};

export type FundraiserLeaderboardSnapshot = {
  capturedAt: string;
  window: {
    startDate: string;
    endDate: string;
    timeZone: string;
  };
  goal: number;
  overall: {
    raised: number;
    donors: number;
    progressPercent: number;
  };
  participants: FundraiserParticipantStanding[];
  boards: {
    fundingTheFight: FundraiserBoardEntry[];
    raisingAwareness: FundraiserBoardEntry[];
    champion: FundraiserBoardEntry[];
  };
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const FORBIDDEN_DONOR_FIELDS = new Set([
  'address',
  'donorEmail',
  'donorName',
  'donorPhone',
  'email',
  'firstName',
  'lastName',
  'message',
  'phone',
]);

const PARTICIPANT_ALLOWED_FIELDS = new Set(['participantId', 'displayName', 'aggregates']);
const AGGREGATE_ALLOWED_FIELDS = new Set(['date', 'raised', 'donors']);

export const SAMPLE_FUNDRAISER_PARTICIPANTS: FundraiserParticipantSample[] = [
  {
    participantId: 'jordan-lee',
    displayName: 'Jordan Lee',
    aggregates: [
      { date: '2027-03-25', raised: 450, donors: 2 },
      { date: '2027-04-02', raised: 650, donors: 4 },
    ],
  },
  {
    participantId: 'avery-rivera',
    displayName: 'Avery Rivera',
    aggregates: [
      { date: '2027-04-10', raised: 500, donors: 18 },
      { date: '2027-05-04', raised: 350, donors: 12 },
    ],
  },
  {
    participantId: 'casey-nguyen',
    displayName: 'Casey Nguyen',
    aggregates: [
      { date: '2027-03-24', raised: 9999, donors: 99 },
      { date: '2027-04-12', raised: 850, donors: 12 },
    ],
  },
  {
    participantId: 'morgan-patel',
    displayName: 'Morgan Patel',
    aggregates: [
      { date: '2027-06-07', raised: 820, donors: 40 },
      { date: '2027-06-08', raised: 500, donors: 8 },
    ],
  },
];

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertAllowedKeys(record: Record<string, unknown>, allowedKeys: Set<string>, label: string) {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_DONOR_FIELDS.has(key) || !allowedKeys.has(key)) {
      throw new Error(`${label} contains unsupported field "${key}".`);
    }
  }
}

function normalizeRequiredString(value: unknown, field: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}.${field} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeDate(value: unknown, label: string): string {
  const date = normalizeRequiredString(value, 'date', label);

  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error(`${label}.date must be an ISO calendar date.`);
  }

  return date;
}

function normalizeNonNegativeNumber(value: unknown, field: string, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label}.${field} must be a non-negative number.`);
  }

  return value;
}

function normalizeDonors(value: unknown, label: string): number {
  const donors = normalizeNonNegativeNumber(value, 'donors', label);

  if (!Number.isInteger(donors)) {
    throw new Error(`${label}.donors must be a non-negative integer.`);
  }

  return donors;
}

function normalizeParticipants(records: unknown): FundraiserParticipantSample[] {
  if (!Array.isArray(records)) {
    throw new Error('Fundraiser leaderboard sample data must be an array.');
  }

  return records.map((record, participantIndex) => {
    const participantLabel = `participant[${participantIndex}]`;
    assertRecord(record, participantLabel);
    assertAllowedKeys(record, PARTICIPANT_ALLOWED_FIELDS, participantLabel);

    const aggregates = record.aggregates;
    if (!Array.isArray(aggregates)) {
      throw new Error(`${participantLabel}.aggregates must be an array.`);
    }

    return {
      participantId: normalizeRequiredString(record.participantId, 'participantId', participantLabel),
      displayName: normalizeRequiredString(record.displayName, 'displayName', participantLabel),
      aggregates: aggregates.map((aggregate, aggregateIndex) => {
        const aggregateLabel = `${participantLabel}.aggregates[${aggregateIndex}]`;
        assertRecord(aggregate, aggregateLabel);
        assertAllowedKeys(aggregate, AGGREGATE_ALLOWED_FIELDS, aggregateLabel);

        return {
          date: normalizeDate(aggregate.date, aggregateLabel),
          raised: normalizeNonNegativeNumber(aggregate.raised, 'raised', aggregateLabel),
          donors: normalizeDonors(aggregate.donors, aggregateLabel),
        };
      }),
    };
  });
}

function isInFundraiserWindow(date: string): boolean {
  return date >= FUNDRAISER_LEADERBOARD_WINDOW_START && date <= FUNDRAISER_LEADERBOARD_WINDOW_END;
}

function compareByName(left: FundraiserParticipantStanding, right: FundraiserParticipantStanding): number {
  // Placeholder pending final #4415 tie rules: sort ties deterministically by participant display name.
  return left.displayName.localeCompare(right.displayName) || left.participantId.localeCompare(right.participantId);
}

function withRanks(entries: FundraiserParticipantStanding[]): FundraiserBoardEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function aggregateFundraiserParticipants(records: unknown): FundraiserParticipantStanding[] {
  return normalizeParticipants(records).map((participant) => {
    const totals = participant.aggregates
      .filter((aggregate) => isInFundraiserWindow(aggregate.date))
      .reduce(
        (current, aggregate) => ({
          raised: current.raised + aggregate.raised,
          donors: current.donors + aggregate.donors,
        }),
        { raised: 0, donors: 0 },
      );

    return {
      participantId: participant.participantId,
      displayName: participant.displayName,
      raised: totals.raised,
      donors: totals.donors,
      championPoints: totals.raised + totals.donors,
    };
  });
}

export function rankFundingTheFight(participants: FundraiserParticipantStanding[]): FundraiserBoardEntry[] {
  return withRanks([...participants].sort((left, right) => right.raised - left.raised || compareByName(left, right)));
}

export function rankRaisingAwareness(participants: FundraiserParticipantStanding[]): FundraiserBoardEntry[] {
  return withRanks([...participants].sort((left, right) => right.donors - left.donors || compareByName(left, right)));
}

export function rankChampion(participants: FundraiserParticipantStanding[]): FundraiserBoardEntry[] {
  return withRanks(
    [...participants].sort((left, right) => right.championPoints - left.championPoints || compareByName(left, right)),
  );
}

export function buildFundraiserLeaderboardSnapshot(
  records: unknown = SAMPLE_FUNDRAISER_PARTICIPANTS,
  capturedAt = '2027-05-15T14:00:00.000Z',
): FundraiserLeaderboardSnapshot {
  const participants = aggregateFundraiserParticipants(records);
  const overallRaised = participants.reduce((total, participant) => total + participant.raised, 0);
  const overallDonors = participants.reduce((total, participant) => total + participant.donors, 0);

  return {
    capturedAt,
    window: {
      startDate: FUNDRAISER_LEADERBOARD_WINDOW_START,
      endDate: FUNDRAISER_LEADERBOARD_WINDOW_END,
      timeZone: FUNDRAISER_LEADERBOARD_TIME_ZONE,
    },
    goal: FUNDRAISER_LEADERBOARD_GOAL,
    overall: {
      raised: overallRaised,
      donors: overallDonors,
      progressPercent: Math.round((overallRaised / FUNDRAISER_LEADERBOARD_GOAL) * 1000) / 10,
    },
    participants,
    boards: {
      fundingTheFight: rankFundingTheFight(participants),
      raisingAwareness: rankRaisingAwareness(participants),
      champion: rankChampion(participants),
    },
  };
}

export function formatFundraiserDollars(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
