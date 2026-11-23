// POST /api/admin/photos/block
// Admin-only. Blocks or restores a photo for public display (#5471, follow-up to #5467).
//
// Body: { id, blocked: boolean, reason: string }
//
// Since the 2026-11-23 Product Authority decision (#5467) every photo is public unless its
// rights_status is 'blocked' or 'copyright_restricted' (functions/_lib/rights-hold.ts).
// This is the takedown path: a rights holder denies, revokes or asks for removal -> block.
//
//   block   (blocked: true)   sets rights_status = 'blocked' (also rights_hold = 1 and
//                             publication_eligible = 0, as the review record). A
//                             'copyright_restricted' photo is already withheld and is left alone (409).
//   restore (blocked: false)  moves a 'blocked' photo back to 'unreviewed'. Anything else is
//                             refused (409), so this page can never lift a copyright restriction.
//
// A non-empty reason is required both ways. It is appended, with the date and the admin's
// email, to rights_notes; the admin is also recorded in reviewed_by / reviewed_at.

import { requireAdminMember } from "../../../_lib/session";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

const MAX_REASON = 500;

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const auth = await requireAdminMember({ env, request });
  if (!auth.ok) return jsonResponse(auth.body, auth.status);

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["photos"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, error: "invalid_id" }, 400);
    }
    if (typeof body?.blocked !== "boolean") {
      return jsonResponse({ ok: false, error: "blocked_must_be_boolean" }, 400);
    }
    const reason = String(body?.reason ?? "").replace(/\s+/g, " ").trim();
    if (!reason) {
      return jsonResponse({ ok: false, error: "reason_required" }, 400);
    }
    if (reason.length > MAX_REASON) {
      return jsonResponse({ ok: false, error: "reason_too_long" }, 400);
    }

    const existing = (await d1.db
      .prepare("SELECT id, rights_status FROM photos WHERE id = ? LIMIT 1;")
      .bind(id)
      .first()) as { id: number; rights_status: string | null } | null;
    if (!existing) {
      return jsonResponse({ ok: false, error: "not_found" }, 404);
    }
    const current = existing.rights_status || "unreviewed";

    const now = new Date().toISOString();
    const actor = String(auth.email || "admin");
    const note = `${body.blocked ? "BLOCKED" : "RESTORED"} ${now.slice(0, 10)} by ${actor}: ${reason}`;

    if (body.blocked) {
      if (current === "copyright_restricted") {
        return jsonResponse({ ok: false, error: "already_restricted", rights_status: current }, 409);
      }
      await d1.db
        .prepare(
          `UPDATE photos
           SET rights_status = 'blocked',
               rights_hold = 1,
               publication_eligible = 0,
               reviewed_by = ?,
               reviewed_at = ?,
               rights_notes = CASE
                 WHEN rights_notes IS NULL OR TRIM(rights_notes) = '' THEN ?
                 ELSE rights_notes || ' | ' || ?
               END
           WHERE id = ?;`,
        )
        .bind(actor, now, note, note, id)
        .run();
      return jsonResponse({ ok: true, id, rights_status: "blocked" }, 200);
    }

    if (current !== "blocked") {
      return jsonResponse({ ok: false, error: "not_blocked", rights_status: current }, 409);
    }
    await d1.db
      .prepare(
        `UPDATE photos
         SET rights_status = 'unreviewed',
             reviewed_by = ?,
             reviewed_at = ?,
             rights_notes = CASE
               WHEN rights_notes IS NULL OR TRIM(rights_notes) = '' THEN ?
               ELSE rights_notes || ' | ' || ?
             END
         WHERE id = ? AND rights_status = 'blocked';`,
      )
      .bind(actor, now, note, note, id)
      .run();
    return jsonResponse({ ok: true, id, rights_status: "unreviewed" }, 200);
  } catch (err: any) {
    console.error("admin photos block error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message || err) }, 500);
  }
};
