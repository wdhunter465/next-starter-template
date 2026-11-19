import {
	FUNDRAISER_LEADERBOARD_TIME_ZONE,
	FUNDRAISER_LEADERBOARD_WINDOW_END,
	FUNDRAISER_LEADERBOARD_WINDOW_START,
	SAMPLE_FUNDRAISER_PARTICIPANTS,
	type FundraiserDailyAggregate,
	type FundraiserParticipantSample,
	type FundraiserParticipantStanding,
} from '@/lib/fundraiser-leaderboard';

export const FUNDRAISER_CLOSEOUT_CUTOFF_LABEL = `${FUNDRAISER_LEADERBOARD_WINDOW_END} 11:59 PM ${FUNDRAISER_LEADERBOARD_TIME_ZONE}`;

export type FundraiserCloseoutAwardKey = 'fundingTheFight' | 'raisingAwareness' | 'champion';

export type FundraiserCloseoutAwardWinner = {
	award: FundraiserCloseoutAwardKey;
	awardName: string;
	participant: FundraiserParticipantStanding;
};

export type FundraiserCloseoutMultipleAwardWinner = {
	participantId: string;
	displayName: string;
	awards: FundraiserCloseoutAwardKey[];
};

export type FundraiserCloseoutResult = {
	window: {
		startDate: string;
		endDate: string;
		cutoffLabel: string;
		timeZone: string;
	};
	awards: Record<FundraiserCloseoutAwardKey, FundraiserCloseoutAwardWinner>;
	multipleAwardWinners: FundraiserCloseoutMultipleAwardWinner[];
};

export type FundraiserCloseoutRegistrationTimes = Record<string, string | undefined>;

const AWARD_NAMES: Record<FundraiserCloseoutAwardKey, string> = {
	fundingTheFight: 'Funding the Fight',
	raisingAwareness: 'Raising Awareness',
	champion: 'Champion',
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME_WITH_ZONE_PATTERN = /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/;
const NEW_YORK_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
	timeZone: FUNDRAISER_LEADERBOARD_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

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

function normalizeDonationDate(value: unknown, label: string): string {
	const date = normalizeRequiredString(value, 'date', label);

	if (!ISO_DATE_PATTERN.test(date) && !ISO_DATE_TIME_WITH_ZONE_PATTERN.test(date)) {
		throw new Error(`${label}.date must be an ISO date or ISO date-time with an explicit time zone.`);
	}

	if (!ISO_DATE_PATTERN.test(date) && Number.isNaN(Date.parse(date))) {
		throw new Error(`${label}.date must be a valid ISO date-time.`);
	}

	return date;
}

function normalizeParticipants(records: unknown): FundraiserParticipantSample[] {
	if (!Array.isArray(records)) {
		throw new Error('Fundraiser closeout sample data must be an array.');
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
			aggregates: aggregates.map((aggregate, aggregateIndex): FundraiserDailyAggregate => {
				const aggregateLabel = `${participantLabel}.aggregates[${aggregateIndex}]`;
				assertRecord(aggregate, aggregateLabel);
				assertAllowedKeys(aggregate, AGGREGATE_ALLOWED_FIELDS, aggregateLabel);

				return {
					date: normalizeDonationDate(aggregate.date, aggregateLabel),
					raised: normalizeNonNegativeNumber(aggregate.raised, 'raised', aggregateLabel),
					donors: normalizeDonors(aggregate.donors, aggregateLabel),
				};
			}),
		};
	});
}

function isInCloseoutWindow(date: string): boolean {
	const fundraiserDate = toFundraiserCalendarDate(date);

	return fundraiserDate >= FUNDRAISER_LEADERBOARD_WINDOW_START && fundraiserDate <= FUNDRAISER_LEADERBOARD_WINDOW_END;
}

function toFundraiserCalendarDate(date: string): string {
	if (ISO_DATE_PATTERN.test(date)) {
		return date;
	}

	const parts = NEW_YORK_DATE_FORMATTER.formatToParts(new Date(date));
	const year = parts.find((part) => part.type === 'year')?.value;
	const month = parts.find((part) => part.type === 'month')?.value;
	const day = parts.find((part) => part.type === 'day')?.value;

	if (!year || !month || !day) {
		throw new Error('Donation date could not be converted to the fundraiser time zone.');
	}

	return `${year}-${month}-${day}`;
}

export function aggregateFundraiserCloseoutParticipants(
	records: unknown = SAMPLE_FUNDRAISER_PARTICIPANTS,
): FundraiserParticipantStanding[] {
	return normalizeParticipants(records).map((participant) => {
		const totals = participant.aggregates
			.filter((aggregate) => isInCloseoutWindow(aggregate.date))
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

function parseRegistrationTime(participant: FundraiserParticipantStanding, registrationTimes: FundraiserCloseoutRegistrationTimes): number {
	const registeredAt = registrationTimes[participant.participantId];

	if (!registeredAt) {
		throw new Error(`Registration time is required to break the tie for ${participant.displayName}.`);
	}

	const timestamp = Date.parse(registeredAt);
	if (Number.isNaN(timestamp)) {
		throw new Error(`Registration time for ${participant.displayName} must be a valid date-time.`);
	}

	return timestamp;
}

function compareByRegistrationTime(
	left: FundraiserParticipantStanding,
	right: FundraiserParticipantStanding,
	registrationTimes: FundraiserCloseoutRegistrationTimes,
): number {
	const difference = parseRegistrationTime(left, registrationTimes) - parseRegistrationTime(right, registrationTimes);

	if (difference === 0) {
		throw new Error(`The provisional tie rule does not resolve ${left.displayName} and ${right.displayName}.`);
	}

	return difference;
}

function winnerFor(
	award: FundraiserCloseoutAwardKey,
	participants: FundraiserParticipantStanding[],
	compare: (left: FundraiserParticipantStanding, right: FundraiserParticipantStanding) => number,
): FundraiserCloseoutAwardWinner {
	if (participants.length === 0) {
		throw new Error(`Cannot determine ${AWARD_NAMES[award]} without participant standings.`);
	}

	return {
		award,
		awardName: AWARD_NAMES[award],
		participant: [...participants].sort(compare)[0],
	};
}

function findMultipleAwardWinners(
	awards: Record<FundraiserCloseoutAwardKey, FundraiserCloseoutAwardWinner>,
): FundraiserCloseoutMultipleAwardWinner[] {
	const awardsByParticipant = new Map<string, FundraiserCloseoutMultipleAwardWinner>();

	for (const [award, winner] of Object.entries(awards) as [FundraiserCloseoutAwardKey, FundraiserCloseoutAwardWinner][]) {
		const existing = awardsByParticipant.get(winner.participant.participantId);

		if (existing) {
			existing.awards.push(award);
			continue;
		}

		awardsByParticipant.set(winner.participant.participantId, {
			participantId: winner.participant.participantId,
			displayName: winner.participant.displayName,
			awards: [award],
		});
	}

	return [...awardsByParticipant.values()].filter((winner) => winner.awards.length > 1);
}

export function computeFundraiserCloseout(
	participants: FundraiserParticipantStanding[],
	registrationTimes: FundraiserCloseoutRegistrationTimes = {},
): FundraiserCloseoutResult {
	// Provisional #4415 Product Authority draft, 2026-11-12: do not add extra tie refinements here.
	const awards: Record<FundraiserCloseoutAwardKey, FundraiserCloseoutAwardWinner> = {
		fundingTheFight: winnerFor('fundingTheFight', participants, (left, right) => {
			return right.raised - left.raised || right.donors - left.donors || compareByRegistrationTime(left, right, registrationTimes);
		}),
		raisingAwareness: winnerFor('raisingAwareness', participants, (left, right) => {
			return right.donors - left.donors || right.raised - left.raised || compareByRegistrationTime(left, right, registrationTimes);
		}),
		champion: winnerFor('champion', participants, (left, right) => {
			return right.championPoints - left.championPoints || compareByRegistrationTime(left, right, registrationTimes);
		}),
	};

	return {
		window: {
			startDate: FUNDRAISER_LEADERBOARD_WINDOW_START,
			endDate: FUNDRAISER_LEADERBOARD_WINDOW_END,
			cutoffLabel: FUNDRAISER_CLOSEOUT_CUTOFF_LABEL,
			timeZone: FUNDRAISER_LEADERBOARD_TIME_ZONE,
		},
		awards,
		multipleAwardWinners: findMultipleAwardWinners(awards),
	};
}

export function buildSampleFundraiserCloseout(): FundraiserCloseoutResult {
	return computeFundraiserCloseout(aggregateFundraiserCloseoutParticipants(SAMPLE_FUNDRAISER_PARTICIPANTS));
}
