import { requireD1, requireTables } from "../../_lib/d1";
import {
  clientAuditHints,
  logMatchupRepairAudit,
  normalizeSourceIssue,
} from "../../_lib/matchup-repair-audit";

/** Monday-inclusive week anchor for weekly_matchups.week_start (YYYY-MM-DD). */
export const MATCHUP_WEEK_START_SQL =
  "SELECT date('now','-6 days','weekday 1') AS week_start;";

type PhotoItem = {
  id: number;
  url: string;
  description?: string;
  title?: string;
};

type EligiblePhoto = {
  id: number;
  url: string;
  is_memorabilia: number;
  is_matchup_eligible: number;
  description?: string;
  title?: string;
};

export const MATCHUP_EXCLUDED_ELIGIBILITY = -1;

/** ChatGPT curation model — see Backblaze_B2.md § B2 inventory vs club-use curation */
export const MATCHUP_ELIGIBILITY = {
  UNREVIEWED: 0,
  APPROVED: 1,
  EXCLUDED: -1,
} as const;

type MatchupRow = {
  id: number;
  week_start: string;
  photo_a_id: number;
  photo_b_id: number;
  status: string;
};

function isUsablePhoto(item: any): item is PhotoItem {
  return !!item && typeof item.id === "number" && typeof item.url === "string" && item.url.trim().length > 0;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function computeWeekStart(db: any): Promise<string | null> {
  const wsRow = await db.prepare(MATCHUP_WEEK_START_SQL).first();
  return wsRow?.week_start ? String(wsRow.week_start) : null;
}

async function readPhotoById(request: Request, id: number): Promise<PhotoItem | null> {
  const endpoint = new URL(`/api/photos/get?id=${id}`, request.url);
  const resp = await fetch(endpoint.toString(), { method: "GET" });
  if (!resp.ok) return null;
  const json = await resp.json().catch(() => null);
  const item = json?.item;
  return isUsablePhoto(item) ? item : null;
}

async function resolveMatchupPhotos(request: Request, photoAId: number, photoBId: number): Promise<PhotoItem[]> {
  const [a, b] = await Promise.all([
    readPhotoById(request, photoAId),
    readPhotoById(request, photoBId),
  ]);
  return [a, b].filter(isUsablePhoto);
}

async function getRecentMatchupPhotoIds(db: any, limit = 8): Promise<Set<number>> {
  const rows = await db
    .prepare(
      "SELECT photo_a_id, photo_b_id FROM weekly_matchups ORDER BY week_start DESC LIMIT ?;",
    )
    .bind(limit)
    .all();

  const ids = new Set<number>();
  for (const row of rows?.results ?? []) {
    ids.add(Number(row.photo_a_id));
    ids.add(Number(row.photo_b_id));
  }
  return ids;
}

async function fetchEligiblePhotos(db: any): Promise<EligiblePhoto[]> {
  // Interim: allow 0 (unreviewed) until admin curation marks club photos as 1.
  // Target: MATCHUP_ELIGIBILITY.APPROVED only — see docs/reference/platform/Backblaze_B2.md
  const rows = await db
    .prepare(
      "SELECT id, url, is_memorabilia, is_matchup_eligible, description, title FROM photos WHERE url IS NOT NULL AND TRIM(url) != '' AND is_matchup_eligible >= 0;",
    )
    .all();

  return (rows?.results ?? []).filter(
    (row: any) =>
      row &&
      Number(row.id) > 0 &&
      typeof row.url === "string" &&
      row.url.trim().length > 0 &&
      Number(row.is_matchup_eligible) >= 0,
  );
}

async function isPhotoMatchupEligible(db: any, photoId: number): Promise<boolean> {
  const row = await db.prepare("SELECT is_matchup_eligible FROM photos WHERE id = ? LIMIT 1;").bind(photoId).first();
  if (!row) return false;
  return Number(row.is_matchup_eligible) >= 0;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function pickOneId(photos: EligiblePhoto[], excludeIds: Set<number>): number | null {
  const candidates = photos.filter((photo) => !excludeIds.has(Number(photo.id)));
  if (candidates.length < 1) return null;
  const shuffled = shuffleInPlace([...candidates]);
  return Number(shuffled[0].id);
}

function pickTwoDistinctIds(photos: EligiblePhoto[], excludeIds: Set<number>): [number, number] | null {
  const candidates = photos.filter((photo) => !excludeIds.has(Number(photo.id)));
  if (candidates.length < 2) return null;

  const shuffled = shuffleInPlace([...candidates]);
  const first = Number(shuffled[0].id);
  const second = Number(shuffled[1].id);
  if (first === second) return null;
  return [first, second];
}

export function selectTwoPhotoIds(photos: EligiblePhoto[], recentIds: Set<number>): [number, number] | null {
  const nonMemorabilia = photos.filter((photo) => Number(photo.is_memorabilia) === 0);

  const attempts: Array<[EligiblePhoto[], Set<number>]> = [
    [nonMemorabilia, recentIds],
    [nonMemorabilia, new Set<number>()],
    [photos, recentIds],
    [photos, new Set<number>()],
  ];

  for (const [pool, excludeIds] of attempts) {
    const picked = pickTwoDistinctIds(pool, excludeIds);
    if (picked) return picked;
  }

  return null;
}

async function findActiveCurrentWeekMatchup(db: any, weekStart: string): Promise<MatchupRow | null> {
  const row = await db
    .prepare(
      "SELECT id, week_start, photo_a_id, photo_b_id, status FROM weekly_matchups WHERE week_start = ? AND status = 'active' LIMIT 1;",
    )
    .bind(weekStart)
    .first();

  if (!row) return null;
  return {
    id: Number(row.id),
    week_start: String(row.week_start),
    photo_a_id: Number(row.photo_a_id),
    photo_b_id: Number(row.photo_b_id),
    status: String(row.status),
  };
}

async function findCurrentWeekMatchup(db: any, weekStart: string): Promise<MatchupRow | null> {
  const row = await db
    .prepare(
      "SELECT id, week_start, photo_a_id, photo_b_id, status FROM weekly_matchups WHERE week_start = ? LIMIT 1;",
    )
    .bind(weekStart)
    .first();

  if (!row) return null;
  return {
    id: Number(row.id),
    week_start: String(row.week_start),
    photo_a_id: Number(row.photo_a_id),
    photo_b_id: Number(row.photo_b_id),
    status: String(row.status),
  };
}

async function closeStaleActiveMatchups(db: any, weekStart: string): Promise<void> {
  await db
    .prepare("UPDATE weekly_matchups SET status='closed' WHERE status='active' AND week_start != ?;")
    .bind(weekStart)
    .run();
}

async function clearVotesForWeek(db: any, weekStart: string): Promise<void> {
  // Mid-week pair replacement must not transfer A/B votes onto replacement photos.
  await db.prepare("DELETE FROM weekly_votes WHERE week_start = ?;").bind(weekStart).run();
}

async function upsertCurrentWeekMatchup(
  db: any,
  weekStart: string,
  photoAId: number,
  photoBId: number,
): Promise<number> {
  const existing = await findCurrentWeekMatchup(db, weekStart);
  if (existing) {
    const pairChanged =
      Number(existing.photo_a_id) !== Number(photoAId) ||
      Number(existing.photo_b_id) !== Number(photoBId);

    await db
      .prepare(
        "UPDATE weekly_matchups SET photo_a_id = ?, photo_b_id = ?, status = 'active' WHERE id = ?;",
      )
      .bind(photoAId, photoBId, existing.id)
      .run();

    if (pairChanged) {
      await clearVotesForWeek(db, weekStart);
    }

    return existing.id;
  }

  try {
    const out = await db
      .prepare(
        "INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'active');",
      )
      .bind(weekStart, photoAId, photoBId)
      .run();
    return Number(out?.meta?.last_row_id || 0);
  } catch (err: any) {
    const message = String(err?.message || err);
    if (!message.includes("UNIQUE")) throw err;

    const raced = await findCurrentWeekMatchup(db, weekStart);
    if (!raced) throw err;
    return raced.id;
  }
}

async function buildSuccessResponse(
  request: Request,
  weekStart: string,
  matchupId: number,
  photoAId: number,
  photoBId: number,
): Promise<Response> {
  const items = await resolveMatchupPhotos(request, photoAId, photoBId);
  if (items.length < 2) {
    return jsonResponse({ ok: true, week_start: weekStart, matchup_id: null, items: [] });
  }

  return jsonResponse({
    ok: true,
    week_start: weekStart,
    matchup_id: matchupId,
    items: items.slice(0, 2),
  });
}

/** HEAD/GET probe used by browser-driven broken-image repair (#2519). */
export async function probePhotoObjectAvailable(url: string): Promise<{ available: boolean; status: number | null }> {
  if (!url || !url.trim()) return { available: false, status: null };

  for (const method of ["HEAD", "GET"] as const) {
    try {
      const resp = await fetch(url, {
        method,
        redirect: "follow",
        headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
      });
      if (resp.status === 404 || resp.status === 410) {
        return { available: false, status: resp.status };
      }
      if (resp.ok || resp.status === 206) {
        return { available: true, status: resp.status };
      }
    } catch {
      // try next method / fail closed below
    }
  }

  return { available: false, status: null };
}

/**
 * Broken-image / probe repair path (#2519), lockdown (#3028).
 *
 * Public callers must pass allowMutation=false → audit log only; no D1 writes.
 * Authorized callers (admin + source Issue) may mutate; pair change clears votes (0–0).
 * Vote restore is not possible with current schema.
 */
export async function repairBrokenActiveMatchupPhoto(options: {
  db: any;
  request: Request;
  brokenPhotoId: number;
  allowMutation?: boolean;
  sourceIssue?: unknown;
  trigger?: 'public_repair_post' | 'current_get_probe' | 'admin_authorized';
}): Promise<Response> {
  const {
    db,
    request,
    brokenPhotoId,
    allowMutation = false,
    sourceIssue = null,
    trigger = 'public_repair_post',
  } = options;
  const client = clientAuditHints(request);
  const issueRef = normalizeSourceIssue(sourceIssue);

  if (!Number.isFinite(brokenPhotoId) || brokenPhotoId <= 0) {
    return jsonResponse({ ok: false, error: "invalid_broken_photo_id" }, 400);
  }

  const weekStart = await computeWeekStart(db);
  if (!weekStart) {
    logMatchupRepairAudit({
      event: 'matchup_repair_audit',
      at: new Date().toISOString(),
      trigger,
      week_start: null,
      broken_photo_id: brokenPhotoId,
      slot: null,
      probe_available: null,
      probe_status: null,
      before_photo_a_id: null,
      before_photo_b_id: null,
      after_photo_a_id: null,
      after_photo_b_id: null,
      mutated: false,
      votes_cleared: false,
      source_issue: issueRef,
      mutation_blocked_reason: 'no_week_start',
      ...client,
    });
    return jsonResponse({ ok: true, week_start: null, matchup_id: null, items: [], repaired: false, mutated: false });
  }

  const active = await findActiveCurrentWeekMatchup(db, weekStart);
  if (!active) {
    logMatchupRepairAudit({
      event: 'matchup_repair_audit',
      at: new Date().toISOString(),
      trigger,
      week_start: weekStart,
      broken_photo_id: brokenPhotoId,
      slot: null,
      probe_available: null,
      probe_status: null,
      before_photo_a_id: null,
      before_photo_b_id: null,
      after_photo_a_id: null,
      after_photo_b_id: null,
      mutated: false,
      votes_cleared: false,
      source_issue: issueRef,
      mutation_blocked_reason: 'no_active_matchup',
      ...client,
    });
    return jsonResponse({ ok: true, week_start: weekStart, matchup_id: null, items: [], repaired: false, mutated: false });
  }

  const beforeA = Number(active.photo_a_id);
  const beforeB = Number(active.photo_b_id);
  const brokenIsA = beforeA === brokenPhotoId;
  const brokenIsB = beforeB === brokenPhotoId;
  if (!brokenIsA && !brokenIsB) {
    logMatchupRepairAudit({
      event: 'matchup_repair_audit',
      at: new Date().toISOString(),
      trigger,
      week_start: weekStart,
      broken_photo_id: brokenPhotoId,
      slot: 'unknown',
      probe_available: null,
      probe_status: null,
      before_photo_a_id: beforeA,
      before_photo_b_id: beforeB,
      after_photo_a_id: beforeA,
      after_photo_b_id: beforeB,
      mutated: false,
      votes_cleared: false,
      source_issue: issueRef,
      mutation_blocked_reason: 'stale_broken_id_not_in_active_pair',
      ...client,
    });
    // Stale client report after another repair already replaced the pair.
    return buildSuccessResponse(request, weekStart, active.id, active.photo_a_id, active.photo_b_id);
  }

  const slot: 'a' | 'b' = brokenIsA ? 'a' : 'b';
  const brokenItem = await readPhotoById(request, brokenPhotoId);
  const probe = brokenItem?.url
    ? await probePhotoObjectAvailable(brokenItem.url)
    : { available: false, status: null };

  if (!allowMutation) {
    logMatchupRepairAudit({
      event: 'matchup_repair_audit',
      at: new Date().toISOString(),
      trigger,
      week_start: weekStart,
      broken_photo_id: brokenPhotoId,
      slot,
      probe_available: probe.available,
      probe_status: probe.status,
      before_photo_a_id: beforeA,
      before_photo_b_id: beforeB,
      after_photo_a_id: beforeA,
      after_photo_b_id: beforeB,
      mutated: false,
      votes_cleared: false,
      source_issue: issueRef,
      mutation_blocked_reason: 'public_midweek_mutation_locked_requires_issue_pr',
      ...client,
    });
    const response = await buildSuccessResponse(
      request,
      weekStart,
      active.id,
      active.photo_a_id,
      active.photo_b_id,
    );
    const body = await response.json();
    return jsonResponse({
      ...body,
      repaired: false,
      mutated: false,
      mutation_blocked: true,
      mutation_blocked_reason: 'public_midweek_mutation_locked_requires_issue_pr',
      probe_available: probe.available,
      probe_status: probe.status,
    });
  }

  if (!issueRef) {
    logMatchupRepairAudit({
      event: 'matchup_repair_audit',
      at: new Date().toISOString(),
      trigger,
      week_start: weekStart,
      broken_photo_id: brokenPhotoId,
      slot,
      probe_available: probe.available,
      probe_status: probe.status,
      before_photo_a_id: beforeA,
      before_photo_b_id: beforeB,
      after_photo_a_id: beforeA,
      after_photo_b_id: beforeB,
      mutated: false,
      votes_cleared: false,
      source_issue: null,
      mutation_blocked_reason: 'missing_source_issue',
      ...client,
    });
    return jsonResponse({
      ok: false,
      error: 'source_issue_required',
      detail: 'Authorized mid-week pair change requires source_issue (GitHub Issue number). Votes cannot be restored; pair change resets to 0-0.',
    }, 400);
  }

  const keepId = brokenIsA ? beforeB : beforeA;
  const eligiblePhotos = await fetchEligiblePhotos(db);
  const recentIds = await getRecentMatchupPhotoIds(db);

  let nextA = brokenIsA ? 0 : keepId;
  let nextB = brokenIsB ? 0 : keepId;

  let replacement =
    pickOneId(eligiblePhotos, new Set<number>([brokenPhotoId, keepId, ...recentIds])) ??
    pickOneId(eligiblePhotos, new Set<number>([brokenPhotoId, keepId]));

  if (replacement) {
    if (brokenIsA) nextA = replacement;
    else nextB = replacement;
  } else {
    const selected =
      selectTwoPhotoIds(eligiblePhotos, new Set<number>([brokenPhotoId, ...recentIds])) ??
      selectTwoPhotoIds(eligiblePhotos, new Set<number>([brokenPhotoId]));
    if (!selected) {
      logMatchupRepairAudit({
        event: 'matchup_repair_audit',
        at: new Date().toISOString(),
        trigger,
        week_start: weekStart,
        broken_photo_id: brokenPhotoId,
        slot,
        probe_available: probe.available,
        probe_status: probe.status,
        before_photo_a_id: beforeA,
        before_photo_b_id: beforeB,
        after_photo_a_id: beforeA,
        after_photo_b_id: beforeB,
        mutated: false,
        votes_cleared: false,
        source_issue: issueRef,
        mutation_blocked_reason: 'no_replacement_candidates',
        ...client,
      });
      return jsonResponse({ ok: true, week_start: weekStart, matchup_id: null, items: [], repaired: false, mutated: false });
    }
    [nextA, nextB] = selected;
  }

  if (!nextA || !nextB || nextA === nextB) {
    return jsonResponse({ ok: true, week_start: weekStart, matchup_id: null, items: [], repaired: false, mutated: false });
  }

  // #3030: the photo-exclude write, pair-replace write, and vote-clear write
  // must commit atomically. A partial failure must never leave the pair
  // changed with the broken photo still eligible, or leave votes from before
  // a pair change intact.
  const pairWillChange = nextA !== beforeA || nextB !== beforeB;
  const statements: any[] = [];
  if (!probe.available) {
    const note = `PURGE_ELIGIBLE: missing/unreachable B2 object after client image failure; OK to remove (#2519, status=${probe.status ?? "unreachable"}; issue=${issueRef})`;
    statements.push(
      db
        .prepare(
          `UPDATE photos
           SET is_matchup_eligible = ?,
               rights_notes = CASE
                 WHEN rights_notes IS NULL OR TRIM(rights_notes) = '' THEN ?
                 ELSE rights_notes || ' | ' || ?
               END
           WHERE id = ?;`,
        )
        .bind(MATCHUP_EXCLUDED_ELIGIBILITY, note, note, brokenPhotoId),
    );
  }
  statements.push(
    db
      .prepare("UPDATE weekly_matchups SET photo_a_id = ?, photo_b_id = ?, status = 'active' WHERE id = ?;")
      .bind(nextA, nextB, active.id),
  );
  if (pairWillChange) {
    statements.push(db.prepare("DELETE FROM weekly_votes WHERE week_start = ?;").bind(weekStart));
  }
  await db.batch(statements);

  const matchupId = active.id;
  const resolved = await findCurrentWeekMatchup(db, weekStart);
  if (!resolved) {
    return jsonResponse({ ok: true, week_start: weekStart, matchup_id: null, items: [], repaired: false, mutated: false });
  }

  const afterA = Number(resolved.photo_a_id);
  const afterB = Number(resolved.photo_b_id);
  const pairChanged = afterA !== beforeA || afterB !== beforeB;

  logMatchupRepairAudit({
    event: 'matchup_repair_audit',
    at: new Date().toISOString(),
    trigger,
    week_start: weekStart,
    broken_photo_id: brokenPhotoId,
    slot,
    probe_available: probe.available,
    probe_status: probe.status,
    before_photo_a_id: beforeA,
    before_photo_b_id: beforeB,
    after_photo_a_id: afterA,
    after_photo_b_id: afterB,
    mutated: pairChanged,
    votes_cleared: pairChanged,
    source_issue: issueRef,
    mutation_blocked_reason: null,
    ...client,
  });

  const response = await buildSuccessResponse(
    request,
    weekStart,
    matchupId || resolved.id,
    resolved.photo_a_id,
    resolved.photo_b_id,
  );
  const body = await response.json();
  return jsonResponse({
    ...body,
    repaired: pairChanged,
    mutated: pairChanged,
    votes_reset_to_zero: pairChanged,
    vote_restore_possible: false,
    source_issue: issueRef,
    excluded_broken_photo_id: brokenPhotoId,
  });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { env, request } = context;

  try {
    const d1Check = requireD1(env);
    if (!d1Check.ok) {
      return jsonResponse(d1Check.body, d1Check.status);
    }

    const tablesCheck = await requireTables(d1Check.db, ["weekly_matchups", "weekly_votes", "photos"]);
    if (!tablesCheck.ok) {
      return jsonResponse(tablesCheck.body, tablesCheck.status);
    }

    const db = d1Check.db;

    const weekStart = await computeWeekStart(db);
    if (!weekStart) {
      return jsonResponse({ ok: true, week_start: null, matchup_id: null, items: [] });
    }

    const activeCurrentWeek = await findActiveCurrentWeekMatchup(db, weekStart);
    let eligibilityIssue: { brokenId: number | null; slot: 'a' | 'b' | 'both' | null } | null = null;
    if (activeCurrentWeek) {
      const photoAEligible = await isPhotoMatchupEligible(db, activeCurrentWeek.photo_a_id);
      const photoBEligible = await isPhotoMatchupEligible(db, activeCurrentWeek.photo_b_id);
      const items = await resolveMatchupPhotos(
        request,
        activeCurrentWeek.photo_a_id,
        activeCurrentWeek.photo_b_id,
      );
      if (items.length >= 2 && photoAEligible && photoBEligible) {
        // Proactive existence check before returning usable public photos (#2519).
        const [probeA, probeB] = await Promise.all([
          probePhotoObjectAvailable(items[0].url),
          probePhotoObjectAvailable(items[1].url),
        ]);

        if (probeA.available && probeB.available) {
          return jsonResponse({
            ok: true,
            week_start: weekStart,
            matchup_id: activeCurrentWeek.id,
            items: items.slice(0, 2),
          });
        }

        // #3028: probe failure must not mutate the weekly pair. Audit only, keep pair.
        const brokenId = !probeA.available ? Number(items[0].id) : Number(items[1].id);
        const slot = !probeA.available ? 'a' : 'b';
        const failedProbe = !probeA.available ? probeA : probeB;
        logMatchupRepairAudit({
          event: 'matchup_repair_audit',
          at: new Date().toISOString(),
          trigger: 'current_get_probe',
          week_start: weekStart,
          broken_photo_id: brokenId,
          slot,
          probe_available: failedProbe.available,
          probe_status: failedProbe.status,
          before_photo_a_id: Number(activeCurrentWeek.photo_a_id),
          before_photo_b_id: Number(activeCurrentWeek.photo_b_id),
          after_photo_a_id: Number(activeCurrentWeek.photo_a_id),
          after_photo_b_id: Number(activeCurrentWeek.photo_b_id),
          mutated: false,
          votes_cleared: false,
          source_issue: null,
          mutation_blocked_reason: 'public_midweek_mutation_locked_requires_issue_pr',
          ...clientAuditHints(request),
        });
        return jsonResponse({
          ok: true,
          week_start: weekStart,
          matchup_id: activeCurrentWeek.id,
          items: items.slice(0, 2),
          probe_warning: true,
          probe_failed_photo_id: brokenId,
          mutated: false,
          mutation_blocked: true,
          mutation_blocked_reason: 'public_midweek_mutation_locked_requires_issue_pr',
        });
      }

      // An active row whose photo(s) are unresolvable or permanently
      // ineligible (e.g. retired by the daily B2 deletion-reconcile job)
      // falls through and is self-healed by the pair-replacement below —
      // that is existing, intentionally tested behavior. #3030: it was
      // happening with **no audit trail at all**; record which slot forced
      // the replacement so this mutation is no longer invisible.
      eligibilityIssue = {
        brokenId: !photoAEligible
          ? Number(activeCurrentWeek.photo_a_id)
          : !photoBEligible
            ? Number(activeCurrentWeek.photo_b_id)
            : null,
        slot: !photoAEligible && !photoBEligible
          ? 'both'
          : !photoAEligible
            ? 'a'
            : !photoBEligible
              ? 'b'
              : items.length < 2
                ? 'both'
                : null,
      };
    }

    await closeStaleActiveMatchups(db, weekStart);

    const eligiblePhotos = await fetchEligiblePhotos(db);
    const recentIds = await getRecentMatchupPhotoIds(db);
    const selected = selectTwoPhotoIds(eligiblePhotos, recentIds);

    if (!selected) {
      if (eligibilityIssue) {
        logMatchupRepairAudit({
          event: 'matchup_repair_audit',
          at: new Date().toISOString(),
          trigger: 'current_get_eligibility',
          week_start: weekStart,
          broken_photo_id: eligibilityIssue.brokenId,
          slot: eligibilityIssue.slot,
          probe_available: null,
          probe_status: null,
          before_photo_a_id: Number(activeCurrentWeek!.photo_a_id),
          before_photo_b_id: Number(activeCurrentWeek!.photo_b_id),
          after_photo_a_id: Number(activeCurrentWeek!.photo_a_id),
          after_photo_b_id: Number(activeCurrentWeek!.photo_b_id),
          mutated: false,
          votes_cleared: false,
          source_issue: null,
          mutation_blocked_reason: 'no_replacement_candidates',
          ...clientAuditHints(request),
        });
      }
      return jsonResponse({ ok: true, week_start: weekStart, matchup_id: null, items: [] });
    }

    const [photoAId, photoBId] = selected;
    const matchupId = await upsertCurrentWeekMatchup(db, weekStart, photoAId, photoBId);

    const resolved = await findCurrentWeekMatchup(db, weekStart);
    if (!resolved) {
      return jsonResponse({ ok: true, week_start: weekStart, matchup_id: null, items: [] });
    }

    if (eligibilityIssue) {
      const afterA = Number(resolved.photo_a_id);
      const afterB = Number(resolved.photo_b_id);
      const pairChanged =
        afterA !== Number(activeCurrentWeek!.photo_a_id) || afterB !== Number(activeCurrentWeek!.photo_b_id);
      logMatchupRepairAudit({
        event: 'matchup_repair_audit',
        at: new Date().toISOString(),
        trigger: 'current_get_eligibility',
        week_start: weekStart,
        broken_photo_id: eligibilityIssue.brokenId,
        slot: eligibilityIssue.slot,
        probe_available: null,
        probe_status: null,
        before_photo_a_id: Number(activeCurrentWeek!.photo_a_id),
        before_photo_b_id: Number(activeCurrentWeek!.photo_b_id),
        after_photo_a_id: afterA,
        after_photo_b_id: afterB,
        mutated: pairChanged,
        votes_cleared: pairChanged,
        source_issue: null,
        mutation_blocked_reason: null,
        ...clientAuditHints(request),
      });
    }

    return buildSuccessResponse(request, weekStart, matchupId || resolved.id, resolved.photo_a_id, resolved.photo_b_id);
  } catch (err: any) {
    return jsonResponse({ ok: false, error: String(err?.message ?? err) }, 500);
  }
};
