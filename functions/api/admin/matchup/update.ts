// POST /api/admin/matchup/update
// Admin-only. Updates matchup photos or status.
//
// Body: { id, photo_a_id?, photo_b_id?, status?, source_issue? }
// Pair changes require source_issue (#3028). Clears votes to 0–0; vote restore impossible.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";
import {
  clientAuditHints,
  logMatchupRepairAudit,
  normalizeSourceIssue,
} from "../../../_lib/matchup-repair-audit";

const STATUS_VALUES = new Set(["active", "closed"]);

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["weekly_matchups", "weekly_votes"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    const photo_a_id = body?.photo_a_id === undefined ? null : Number(body.photo_a_id);
    const photo_b_id = body?.photo_b_id === undefined ? null : Number(body.photo_b_id);
    const statusRaw = body?.status === undefined ? null : String(body.status).trim().toLowerCase();

    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, error: "invalid_id" }, 400);
    }

    const existing = await d1.db
      .prepare("SELECT id, week_start, photo_a_id, photo_b_id, status FROM weekly_matchups WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) {
      return jsonResponse({ ok: false, error: "matchup_not_found" }, 404);
    }

    const weekStart = String((existing as any).week_start || "");
    const nextPhotoA = photo_a_id === null ? Number((existing as any).photo_a_id) : photo_a_id;
    const nextPhotoB = photo_b_id === null ? Number((existing as any).photo_b_id) : photo_b_id;
    const nextStatus =
      statusRaw === null
        ? String((existing as any).status || "closed")
        : STATUS_VALUES.has(statusRaw)
          ? statusRaw
          : null;

    if (nextStatus === null) {
      return jsonResponse({ ok: false, error: "invalid_status" }, 400);
    }
    if (!Number.isFinite(nextPhotoA) || nextPhotoA <= 0 || !Number.isFinite(nextPhotoB) || nextPhotoB <= 0) {
      return jsonResponse({ ok: false, error: "invalid_photo_ids" }, 400);
    }
    if (nextPhotoA === nextPhotoB) {
      return jsonResponse({ ok: false, error: "photo_ids_must_differ" }, 400);
    }

    const changedA = nextPhotoA !== Number((existing as any).photo_a_id);
    const changedB = nextPhotoB !== Number((existing as any).photo_b_id);
    const pairChanged = changedA || changedB;
    // #3030: record which slot(s) actually changed instead of always "both".
    const slot: "a" | "b" | "both" | null = changedA && changedB ? "both" : changedA ? "a" : changedB ? "b" : null;

    const sourceIssue = normalizeSourceIssue(body?.source_issue);
    if (pairChanged && !sourceIssue) {
      logMatchupRepairAudit({
        event: "matchup_repair_audit",
        at: new Date().toISOString(),
        trigger: "admin_update",
        week_start: weekStart || null,
        broken_photo_id: null,
        slot,
        probe_available: null,
        probe_status: null,
        before_photo_a_id: Number((existing as any).photo_a_id),
        before_photo_b_id: Number((existing as any).photo_b_id),
        after_photo_a_id: Number((existing as any).photo_a_id),
        after_photo_b_id: Number((existing as any).photo_b_id),
        mutated: false,
        votes_cleared: false,
        source_issue: null,
        mutation_blocked_reason: "missing_source_issue",
        ...clientAuditHints(request),
      });
      return jsonResponse(
        {
          ok: false,
          error: "source_issue_required",
          detail:
            "Changing photo A and/or B requires source_issue (GitHub Issue). Votes cannot be restored; pair change resets voting to 0-0.",
        },
        400,
      );
    }

    if (nextStatus === "active") {
      // #3030: pair-replace and vote-clear must commit atomically — a failure
      // between the two writes must never leave a changed pair with stale votes.
      const activeStatements = [
        d1.db
          .prepare("UPDATE weekly_matchups SET status='closed' WHERE status='active' AND id != ?")
          .bind(id),
        d1.db
          .prepare(
            `UPDATE weekly_matchups
             SET photo_a_id=?, photo_b_id=?, status=?
             WHERE id=?`,
          )
          .bind(nextPhotoA, nextPhotoB, nextStatus, id),
      ];
      if (pairChanged && weekStart) {
        activeStatements.push(d1.db.prepare("DELETE FROM weekly_votes WHERE week_start = ?;").bind(weekStart));
      }
      const batchResults = await d1.db.batch(activeStatements);

      const changed = batchResults?.[1]?.meta?.changes || 0;
      if (pairChanged) {
        logMatchupRepairAudit({
          event: "matchup_repair_audit",
          at: new Date().toISOString(),
          trigger: "admin_update",
          week_start: weekStart || null,
          broken_photo_id: null,
          slot,
          probe_available: null,
          probe_status: null,
          before_photo_a_id: Number((existing as any).photo_a_id),
          before_photo_b_id: Number((existing as any).photo_b_id),
          after_photo_a_id: nextPhotoA,
          after_photo_b_id: nextPhotoB,
          mutated: true,
          votes_cleared: true,
          source_issue: sourceIssue,
          mutation_blocked_reason: null,
          ...clientAuditHints(request),
        });
      }
      return jsonResponse({
        ok: true,
        changed,
        mutated: pairChanged,
        votes_reset_to_zero: pairChanged,
        vote_restore_possible: false,
        source_issue: sourceIssue,
      }, 200);
    }

    // #3030: pair-replace and vote-clear must commit atomically here too.
    const updateStatements = [
      d1.db
        .prepare(
          `UPDATE weekly_matchups
           SET photo_a_id=?, photo_b_id=?, status=?
           WHERE id=?`,
        )
        .bind(nextPhotoA, nextPhotoB, nextStatus, id),
    ];
    if (pairChanged && weekStart) {
      updateStatements.push(d1.db.prepare("DELETE FROM weekly_votes WHERE week_start = ?;").bind(weekStart));
    }
    const results = await d1.db.batch(updateStatements);
    const out = results?.[0];

    if (pairChanged) {
      logMatchupRepairAudit({
        event: "matchup_repair_audit",
        at: new Date().toISOString(),
        trigger: "admin_update",
        week_start: weekStart || null,
        broken_photo_id: null,
        slot,
        probe_available: null,
        probe_status: null,
        before_photo_a_id: Number((existing as any).photo_a_id),
        before_photo_b_id: Number((existing as any).photo_b_id),
        after_photo_a_id: nextPhotoA,
        after_photo_b_id: nextPhotoB,
        mutated: true,
        votes_cleared: true,
        source_issue: sourceIssue,
        mutation_blocked_reason: null,
        ...clientAuditHints(request),
      });
    }

    return jsonResponse({
      ok: true,
      changed: out?.meta?.changes || 0,
      mutated: pairChanged,
      votes_reset_to_zero: pairChanged,
      vote_restore_possible: false,
      source_issue: sourceIssue,
    }, 200);
  } catch (err: any) {
    console.error("admin matchup update error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message || err) }, 500);
  }
};
