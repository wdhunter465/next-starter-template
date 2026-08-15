// POST /api/admin/editorial/publish
// Updates content_inventory publication state. Protected by ADMIN_TOKEN.
// Fail-closed: A1–A7 plus S4/S9. Schedule writes are first_publish only. No Production D1 writes.

import { requireAdmin } from "../../../_lib/auth";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";
import { preparePublicationEvent } from "../../../_lib/publication-audit";
import {
  evaluatePublicationTransition,
  inferPublicationAction,
  isInventoryStatus,
  isPublicationAction,
  resolveOperationalState,
  type InventoryStatus,
  type OperationalState,
  type PublicationAction,
} from "../../../_lib/publication-transition-gate";

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAction(body: Record<string, unknown>, status: string): PublicationAction | null {
  const rawAction = asText(body.action);
  if (rawAction) {
    return isPublicationAction(rawAction) ? rawAction : null;
  }
  if (isInventoryStatus(status)) {
    return inferPublicationAction(status);
  }
  return null;
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["content_inventory", "content_inventory_events"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const id = asInt(body?.id);
    const status = asText(body?.status);
    const action = body ? resolveAction(body, status) : null;

    if (!id || !action) {
      return jsonResponse({ ok: false, error: "id and a valid action or status are required." }, 400);
    }

    const existing = await d1.db
      .prepare(
        `SELECT id, status, source_name, credit_line, operational_state, approved_by, approved_at,
                publication_reason, published_at, scheduled_at, schedule_paused, pause_reason,
                rights_status, privacy_flag, reviewer, reviewed_at, rejection_reason
           FROM content_inventory
          WHERE id = ?`,
      )
      .bind(id)
      .first();

    if (!existing) {
      return jsonResponse({ ok: false, error: "Content record not found." }, 404);
    }

    const currentInventoryStatus = String((existing as any).status || "") as InventoryStatus;
    if (!isInventoryStatus(currentInventoryStatus)) {
      return jsonResponse({ ok: false, error: "Content record has an invalid inventory status." }, 500);
    }

    const nowRow = await d1.db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());
    const requestedApprovedBy = asText(body?.approved_by);
    const requestedApprovedAt = asText(body?.approved_at) || (action === "approve" ? now : "");
    const requestedReviewer = asText(body?.reviewer);
    const reason = asText(body?.reason);
    const requestedScheduledAt = asText(body?.scheduled_at);
    const scheduledAt =
      action === "schedule"
        ? requestedScheduledAt
        : requestedScheduledAt || asText((existing as any).scheduled_at) || "";
    const paused = Number((existing as any).schedule_paused) === 1;

    const fromOperational = resolveOperationalState(
      currentInventoryStatus,
      (existing as any).operational_state,
    );

    const gate = evaluatePublicationTransition({
      action,
      currentInventoryStatus,
      operationalState: fromOperational,
      approvedBy: (existing as any).approved_by,
      approvedAt: (existing as any).approved_at,
      requestedApprovedBy,
      requestedApprovedAt,
      sourceName: (existing as any).source_name,
      creditLine: (existing as any).credit_line,
      reason,
      scheduledAt,
      paused,
      nowIso: now,
      approvalSnapshot: {
        approvedBy: asText((existing as any).approved_by),
        approvedAt: asText((existing as any).approved_at),
      },
      rightsStatus: (existing as any).rights_status,
      privacyFlag: (existing as any).privacy_flag,
      requestedReviewer,
    });

    if (!gate.ok) {
      return jsonResponse({ ok: false, error: gate.error, check_id: gate.checkId }, 400);
    }

    const auditEvent = (toState: OperationalState) =>
      preparePublicationEvent(d1.db, {
        inventoryId: id,
        action,
        actor:
          requestedReviewer ||
          requestedApprovedBy ||
          asText((existing as any).reviewer) ||
          asText((existing as any).approved_by),
        fromState: fromOperational,
        toState,
        reason,
        eventAt: now,
        approvedBy: requestedApprovedBy || asText((existing as any).approved_by),
        approvedAt: requestedApprovedAt || asText((existing as any).approved_at),
        sourceName: asText((existing as any).source_name),
        creditLine: asText((existing as any).credit_line),
        scheduleId: scheduledAt || null,
      });

    if (action === "rollback") {
      const nextStatus: InventoryStatus = "published";
      const approvedBy = requestedApprovedBy || asText((existing as any).approved_by);
      const approvedAt = requestedApprovedAt || asText((existing as any).approved_at);
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET status = ?, operational_state = ?, approved_by = ?, approved_at = ?,
                    publication_reason = NULL, updated_at = ?, published_at = ?
              WHERE id = ?`,
          )
          .bind(nextStatus, "published", approvedBy, approvedAt, now, now, id),
        auditEvent("published"),
      ]);

      return jsonResponse(
        { ok: true, id, status: nextStatus, operational_state: "published", published_at: now },
        200,
      );
    }

    if (action === "stage") {
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET operational_state = ?, rejection_reason = NULL, updated_at = ?
              WHERE id = ?`,
          )
          .bind("staged", now, id),
        auditEvent("staged"),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: currentInventoryStatus,
          operational_state: "staged",
        },
        200,
      );
    }

    if (action === "review") {
      const reviewer = requestedReviewer || asText((existing as any).reviewer);
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET operational_state = ?, reviewer = ?, reviewed_at = ?, updated_at = ?
              WHERE id = ?`,
          )
          .bind("reviewed", reviewer || null, now, now, id),
        auditEvent("reviewed"),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: currentInventoryStatus,
          operational_state: "reviewed",
          reviewer: reviewer || null,
          reviewed_at: now,
        },
        200,
      );
    }

    if (action === "reject") {
      const reviewer = requestedReviewer || asText((existing as any).reviewer);
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET operational_state = ?, rejection_reason = ?, reviewer = ?, updated_at = ?
              WHERE id = ?`,
          )
          .bind("rejected", reason, reviewer || null, now, id),
        auditEvent("rejected"),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: currentInventoryStatus,
          operational_state: "rejected",
          rejection_reason: reason,
        },
        200,
      );
    }

    if (action === "schedule") {
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET operational_state = ?, scheduled_at = ?, schedule_paused = ?, pause_reason = NULL, updated_at = ?
              WHERE id = ?`,
          )
          .bind("scheduled", scheduledAt, 0, now, id),
        auditEvent("scheduled"),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: currentInventoryStatus,
          operational_state: "scheduled",
          scheduled_at: scheduledAt,
          schedule_paused: 0,
        },
        200,
      );
    }

    if (action === "pause_schedule") {
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET schedule_paused = ?, pause_reason = ?, updated_at = ?
              WHERE id = ?`,
          )
          .bind(1, reason, now, id),
        auditEvent("scheduled"),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: currentInventoryStatus,
          operational_state: "scheduled",
          scheduled_at: scheduledAt,
          schedule_paused: 1,
          pause_reason: reason,
        },
        200,
      );
    }

    if (action === "cancel_schedule") {
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET operational_state = ?, schedule_paused = ?, pause_reason = NULL, updated_at = ?
              WHERE id = ?`,
          )
          .bind("approved", 0, now, id),
        auditEvent("approved"),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: currentInventoryStatus,
          operational_state: "approved",
          scheduled_at: asText((existing as any).scheduled_at),
          schedule_paused: 0,
        },
        200,
      );
    }

    if (action === "approve") {
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET operational_state = ?, approved_by = ?, approved_at = ?, updated_at = ?
              WHERE id = ?`,
          )
          .bind("approved", requestedApprovedBy, requestedApprovedAt, now, id),
        auditEvent("approved"),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: currentInventoryStatus,
          operational_state: "approved",
          approved_by: requestedApprovedBy,
          approved_at: requestedApprovedAt,
        },
        200,
      );
    }

    if (action === "publish") {
      if (currentInventoryStatus === "published") {
        return jsonResponse(
          {
            ok: true,
            id,
            status: "published",
            operational_state: "published",
            published_at: (existing as any).published_at || now,
          },
          200,
        );
      }

      const nextStatus: InventoryStatus = "published";
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET status = ?, operational_state = ?, updated_at = ?, published_at = ?
              WHERE id = ?`,
          )
          .bind(nextStatus, "published", now, now, id),
        auditEvent("published"),
      ]);

      return jsonResponse(
        { ok: true, id, status: nextStatus, operational_state: "published", published_at: now },
        200,
      );
    }

    if (action === "unpublish" || action === "archive") {
      const nextStatus: InventoryStatus = "archived";
      const nextOperational = action === "unpublish" ? "unpublished" : "archived";
      await d1.db.batch([
        d1.db
          .prepare(
            `UPDATE content_inventory
                SET status = ?, operational_state = ?, publication_reason = ?, updated_at = ?, published_at = NULL
              WHERE id = ?`,
          )
          .bind(nextStatus, nextOperational, reason, now, id),
        auditEvent(nextOperational),
      ]);

      return jsonResponse(
        {
          ok: true,
          id,
          status: nextStatus,
          operational_state: nextOperational,
          published_at: null,
        },
        200,
      );
    }

    await d1.db.batch([
      d1.db
        .prepare(
          `UPDATE content_inventory
              SET status = ?, operational_state = ?, updated_at = ?, published_at = NULL
            WHERE id = ?`,
        )
        .bind("draft", "draft", now, id),
      auditEvent("draft"),
    ]);

    return jsonResponse({ ok: true, id, status: "draft", operational_state: "draft", published_at: null }, 200);
  } catch (err: any) {
    console.error("admin editorial publish error:", err);
    return jsonResponse({ ok: false, error: "Publication update failed." }, 500);
  }
};
