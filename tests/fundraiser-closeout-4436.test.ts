import { describe, expect, it } from 'vitest';

import {
	aggregateFundraiserCloseoutParticipants,
	buildSampleFundraiserCloseout,
	computeFundraiserCloseout,
} from '@/lib/fundraiser-closeout';
import { SAMPLE_FUNDRAISER_PARTICIPANTS, type FundraiserParticipantStanding } from '@/lib/fundraiser-leaderboard';

function standing(participantId: string, displayName: string, raised: number, donors: number): FundraiserParticipantStanding {
	return {
		participantId,
		displayName,
		raised,
		donors,
		championPoints: raised + donors,
	};
}

describe('fundraiser closeout computation (#4436)', () => {
	it('computes the three award winners from sample data', () => {
		const closeout = buildSampleFundraiserCloseout();

		expect(closeout.awards.fundingTheFight.participant.displayName).toBe('Jordan Lee');
		expect(closeout.awards.raisingAwareness.participant.displayName).toBe('Morgan Patel');
		expect(closeout.awards.champion.participant.displayName).toBe('Jordan Lee');
	});

	it('uses donor count to break a Funding the Fight funds tie', () => {
		const closeout = computeFundraiserCloseout([standing('north', 'North Team', 100, 4), standing('south', 'South Team', 100, 6)]);

		expect(closeout.awards.fundingTheFight.participant.participantId).toBe('south');
	});

	it('uses earliest registration to break a Funding the Fight tie after funds and donors tie', () => {
		const closeout = computeFundraiserCloseout([standing('north', 'North Team', 100, 5), standing('south', 'South Team', 100, 5)], {
			north: '2027-03-02T09:00:00-05:00',
			south: '2027-03-01T09:00:00-05:00',
		});

		expect(closeout.awards.fundingTheFight.participant.participantId).toBe('south');
	});

	it('uses funds raised to break a Raising Awareness donor tie', () => {
		const closeout = computeFundraiserCloseout([standing('north', 'North Team', 50, 10), standing('south', 'South Team', 70, 10)]);

		expect(closeout.awards.raisingAwareness.participant.participantId).toBe('south');
	});

	it('uses earliest registration to break a Raising Awareness tie after donors and funds tie', () => {
		const closeout = computeFundraiserCloseout([standing('north', 'North Team', 50, 10), standing('south', 'South Team', 50, 10)], {
			north: '2027-03-02T09:00:00-05:00',
			south: '2027-03-01T09:00:00-05:00',
		});

		expect(closeout.awards.raisingAwareness.participant.participantId).toBe('south');
	});

	it('uses earliest registration to break a Champion points tie', () => {
		const closeout = computeFundraiserCloseout([standing('north', 'North Team', 100, 2), standing('south', 'South Team', 99, 3)], {
			north: '2027-03-02T09:00:00-05:00',
			south: '2027-03-01T09:00:00-05:00',
		});

		expect(closeout.awards.champion.participant.participantId).toBe('south');
	});

	it('counts donations at the fundraiser window boundaries and excludes records on both outer sides', () => {
		const [participant] = aggregateFundraiserCloseoutParticipants([
			{
				participantId: 'boundary',
				displayName: 'Boundary Team',
				aggregates: [
					{ date: '2027-03-24', raised: 900, donors: 9 },
					{ date: '2027-03-25', raised: 25, donors: 1 },
					{ date: '2027-06-07T23:59:00-04:00', raised: 59, donors: 2 },
					{ date: '2027-06-08T00:00:00-04:00', raised: 800, donors: 8 },
				],
			},
		]);

		expect(participant).toMatchObject({
			raised: 84,
			donors: 3,
			championPoints: 87,
		});
	});

	it('returns participants who independently win more than one award for human decision', () => {
		const closeout = buildSampleFundraiserCloseout();

		expect(closeout.multipleAwardWinners).toEqual([
			{
				participantId: 'jordan-lee',
				displayName: 'Jordan Lee',
				awards: ['fundingTheFight', 'champion'],
			},
		]);
	});

	it('rejects sample records that contain donor email or phone fields', () => {
		expect(() =>
			aggregateFundraiserCloseoutParticipants([
				{
					participantId: 'email-sample',
					displayName: 'Email Sample',
					email: 'donor@example.com',
					aggregates: [{ date: '2027-04-01', raised: 10, donors: 1 }],
				},
			]),
		).toThrow(/unsupported field "email"/i);

		expect(() =>
			aggregateFundraiserCloseoutParticipants([
				{
					participantId: 'phone-sample',
					displayName: 'Phone Sample',
					aggregates: [{ date: '2027-04-01', raised: 10, donors: 1, phone: '555-0100' }],
				},
			]),
		).toThrow(/unsupported field "phone"/i);
	});

	it('keeps the closeout data shape free of donor personal fields', () => {
		const closeout = computeFundraiserCloseout(aggregateFundraiserCloseoutParticipants(SAMPLE_FUNDRAISER_PARTICIPANTS));

		expect(JSON.stringify(closeout)).not.toMatch(/donorEmail|donorPhone|email|phone/i);
	});
});
