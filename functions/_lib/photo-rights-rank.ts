// One shared preference order for every surface that picks a photo (#5497).
//
// Product Authority, 2026-11-23: favour images that are public domain, owned by the club, or
// explicitly permitted. After #5467 every photo that is not blocked is eligible, so a surface that
// chooses one photo needs an order. This module is that order and nothing else: it is pure (no D1,
// no network, no randomness), it never changes what is public, and it never lifts a block.
//
// How a surface uses it: build the candidate list as before (the surface's own filters, fit and
// recency), pass it through `preferHighestRank`, then run the surface's own selection (rotation,
// randomness, recency) on what is left. A lower rank is used only when no higher-ranked photo fits.

export type PhotoRightsRank = 1 | 2 | 3;

/** Statuses that are never chosen by any surface. Unchanged by this module (#5467). */
export const NEVER_CHOSEN_RIGHTS_STATUSES: ReadonlySet<string> = new Set(['blocked', 'copyright_restricted']);

/** Rank 1: permitted, including club-owned. */
const RANK_1: ReadonlySet<string> = new Set(['permission_granted', 'lgfc_owned_confirmed']);

/** Rank 2: public domain (a candidate finding, not a legal clearance). */
const RANK_2: ReadonlySet<string> = new Set(['public_domain_candidate']);

/** The status a photo has when none is recorded (the daily reconcile and #5467 call it `unreviewed`). */
export const DEFAULT_PHOTO_RIGHTS_STATUS = 'unreviewed';

export function normalizeRightsStatus(status: string | null | undefined): string {
	const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
	return value === '' ? DEFAULT_PHOTO_RIGHTS_STATUS : value;
}

/** True when a surface may choose a photo with this status at all. */
export function isRightsStatusChoosable(status: string | null | undefined): boolean {
	return !NEVER_CHOSEN_RIGHTS_STATUSES.has(normalizeRightsStatus(status));
}

/**
 * Rank of a photo's rights status, best first: 1 permitted or club-owned, 2 public domain,
 * 3 everything else that is not blocked (unreviewed, unknown, permission needed or requested,
 * and any status this module does not know, which is served under #5467). `null` means never chosen.
 */
export function photoRightsRank(status: string | null | undefined): PhotoRightsRank | null {
	const value = normalizeRightsStatus(status);
	if (NEVER_CHOSEN_RIGHTS_STATUSES.has(value)) return null;
	if (RANK_1.has(value)) return 1;
	if (RANK_2.has(value)) return 2;
	return 3;
}

/**
 * Narrow a surface's candidates to the best rank present, dropping any that may never be chosen.
 * The order of the survivors is the order they came in, so the surface's own selection (rotation,
 * randomness, recency) is unchanged within the rank. Returns `[]` only when nothing is choosable.
 */
export function preferHighestRank<T>(candidates: readonly T[], getStatus: (candidate: T) => string | null | undefined): T[] {
	let best: PhotoRightsRank | null = null;
	const ranked: Array<{ candidate: T; rank: PhotoRightsRank }> = [];
	for (const candidate of candidates) {
		const rank = photoRightsRank(getStatus(candidate));
		if (rank === null) continue;
		ranked.push({ candidate, rank });
		if (best === null || rank < best) best = rank;
	}
	if (best === null) return [];
	return ranked.filter((entry) => entry.rank === best).map((entry) => entry.candidate);
}
