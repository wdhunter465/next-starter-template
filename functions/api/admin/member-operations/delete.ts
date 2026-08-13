// POST /api/admin/member-operations/delete
// Administrator-controlled soft deletion for a member (#2919, F6). No hard
// delete exists or is authorized. Reversible via action: "restore". Mirrors
// the deletion onto the matching join_requests row so both records stay
// consistent; neither row is ever removed.

import { requireAdmin } from "../../../_lib/auth";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

type DeleteBody = {
  email?: unknown;
  action?: unknown;
  deletion_reason?: unknown;
  deleted_by?: unknown;
};

const ACTIONS = new Set(["delete", "restore"]);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["members", "join_requests"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = (await request.json().catch(() => null)) as DeleteBody | null;
    const email = asString(body?.email).toLowerCase();
    const action = asString(body?.action) || "delete";
    const deletionReason = asString(body?.deletion_reason);
    const deletedBy = asString(body?.deleted_by);

    if (!email || !ACTIONS.has(action)) {
      return jsonResponse({ ok: false, error: "email and a valid action ('delete' or 'restore') are required." }, 400);
    }

    if (action === "delete" && (!deletionReason || !deletedBy)) {
      return jsonResponse(
        { ok: false, error: "deletion_reason and deleted_by are required to soft-delete a member." },
        400,
      );
    }

    const member = await d1.db
      .prepare("SELECT id, deleted_at FROM members WHERE lower(email) = ?")
      .bind(email)
      .first();

    if (!member) {
      return jsonResponse({ ok: false, error: "Member not found." }, 404);
    }

    const nowRow = await d1.db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());

    if (action === "delete") {
      if ((member as any).deleted_at) {
        return jsonResponse({ ok: false, error: "Member is already soft-deleted." }, 409);
      }

      await d1.db
        .prepare(
          "UPDATE members SET deleted_at = ?, deletion_reason = ?, deleted_by = ?, updated_at = ? WHERE lower(email) = ?",
        )
        .bind(now, deletionReason, deletedBy, now, email)
        .run();
      await d1.db
        .prepare("UPDATE join_requests SET deleted_at = ? WHERE lower(email) = ?")
        .bind(now, email)
        .run();

      return jsonResponse({ ok: true, action: "delete", email, deleted_at: now }, 200);
    }

    // restore
    if (!(member as any).deleted_at) {
      return jsonResponse({ ok: false, error: "Member is not currently soft-deleted." }, 409);
    }

    await d1.db
      .prepare(
        "UPDATE members SET deleted_at = NULL, deletion_reason = NULL, deleted_by = NULL, updated_at = ? WHERE lower(email) = ?",
      )
      .bind(now, email)
      .run();
    await d1.db
      .prepare("UPDATE join_requests SET deleted_at = NULL WHERE lower(email) = ?")
      .bind(email)
      .run();

    return jsonResponse({ ok: true, action: "restore", email }, 200);
  } catch (err: any) {
    console.error("admin member soft-delete error:", err);
    return jsonResponse({ ok: false, error: "Member deletion operation failed." }, 500);
  }
};
