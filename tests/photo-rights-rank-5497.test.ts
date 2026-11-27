import { describe, expect, it } from 'vitest';

import {
	isRightsStatusChoosable,
	normalizeRightsStatus,
	photoRightsRank,
	preferHighestRank,
} from '../functions/_lib/photo-rights-rank';

type Photo = { id: number; rights_status: string | null };
const status = (p: Photo) => p.rights_status;

describe('photo rights rank (#5497)', () => {
	it('ranks permitted and club-owned first, public domain second, everything else third', () => {
		expect(photoRightsRank('permission_granted')).toBe(1);
		expect(photoRightsRank('lgfc_owned_confirmed')).toBe(1);
		expect(photoRightsRank('public_domain_candidate')).toBe(2);
		for (const s of ['unreviewed', 'unknown', 'permission_needed', 'permission_requested']) {
			expect(photoRightsRank(s)).toBe(3);
		}
	});

	it('treats a missing or blank status as unreviewed (rank 3), as the daily reconcile does', () => {
		expect(photoRightsRank(null)).toBe(3);
		expect(photoRightsRank(undefined)).toBe(3);
		expect(photoRightsRank('')).toBe(3);
		expect(photoRightsRank('   ')).toBe(3);
		expect(normalizeRightsStatus(null)).toBe('unreviewed');
	});

	it('serves a status it does not know at rank 3 (public display is "not blocked", #5467), never above a known one', () => {
		expect(photoRightsRank('some_future_status')).toBe(3);
	});

	it('never chooses blocked or copyright_restricted, whatever the case or spacing', () => {
		expect(photoRightsRank('blocked')).toBeNull();
		expect(photoRightsRank('copyright_restricted')).toBeNull();
		expect(photoRightsRank(' Blocked ')).toBeNull();
		expect(photoRightsRank('COPYRIGHT_RESTRICTED')).toBeNull();
		expect(isRightsStatusChoosable('blocked')).toBe(false);
		expect(isRightsStatusChoosable('copyright_restricted')).toBe(false);
		expect(isRightsStatusChoosable('unreviewed')).toBe(true);
		expect(isRightsStatusChoosable(null)).toBe(true);
	});

	it('narrows to the best rank present: a higher-ranked photo beats an unreviewed one when both fit', () => {
		const photos: Photo[] = [
			{ id: 1, rights_status: 'unreviewed' },
			{ id: 2, rights_status: 'permission_granted' },
			{ id: 3, rights_status: 'public_domain_candidate' },
			{ id: 4, rights_status: 'lgfc_owned_confirmed' },
		];
		expect(preferHighestRank(photos, status).map((p) => p.id)).toEqual([2, 4]);
	});

	it('falls back to the next rank when no higher-ranked photo fits, so nothing runs dry', () => {
		const onlyDomain: Photo[] = [
			{ id: 1, rights_status: 'unreviewed' },
			{ id: 2, rights_status: 'public_domain_candidate' },
		];
		expect(preferHighestRank(onlyDomain, status).map((p) => p.id)).toEqual([2]);

		const onlyUnreviewed: Photo[] = [
			{ id: 5, rights_status: null },
			{ id: 6, rights_status: 'permission_needed' },
		];
		expect(preferHighestRank(onlyUnreviewed, status).map((p) => p.id)).toEqual([5, 6]);
	});

	it('never returns a blocked or restricted photo, even when it is the only candidate', () => {
		const blocked: Photo[] = [
			{ id: 1, rights_status: 'blocked' },
			{ id: 2, rights_status: 'copyright_restricted' },
		];
		expect(preferHighestRank(blocked, status)).toEqual([]);

		const mixed: Photo[] = [
			{ id: 1, rights_status: 'blocked' },
			{ id: 2, rights_status: 'unreviewed' },
		];
		expect(preferHighestRank(mixed, status).map((p) => p.id)).toEqual([2]);
	});

	it('keeps the incoming order within a rank, so the surface rotation and recency are unchanged', () => {
		const photos: Photo[] = [
			{ id: 9, rights_status: 'permission_granted' },
			{ id: 3, rights_status: 'unreviewed' },
			{ id: 7, rights_status: 'lgfc_owned_confirmed' },
			{ id: 1, rights_status: 'permission_granted' },
		];
		expect(preferHighestRank(photos, status).map((p) => p.id)).toEqual([9, 7, 1]);
	});

	it('is pure: it does not change its input and an empty list gives an empty list', () => {
		const photos: Photo[] = [
			{ id: 1, rights_status: 'unreviewed' },
			{ id: 2, rights_status: 'permission_granted' },
		];
		const before = JSON.stringify(photos);
		preferHighestRank(photos, status);
		expect(JSON.stringify(photos)).toBe(before);
		expect(preferHighestRank([], status)).toEqual([]);
	});
});
