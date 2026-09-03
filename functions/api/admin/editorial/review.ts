// POST /api/admin/editorial/review
// Moves submission_queue rows through manual editorial review states.

import { requireAdmin } from "../../../_lib/auth";
import {
  buildAssociationsFromSubmission,
  insertStoryMediaAssociations,
  loadPhotosByIds,
  serializeLegacyMediaJson,
} from "../../../_lib/content-inventory-media";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

type ReviewBody = {
  submission_id?: unknown;
  action?: unknown;
  tag?: unknown;
  summary?: unknown;
  perspective_label?: unknown;
  source_name?: unknown;
  source_url?: unknown;
  credit_line?: unknown;
  story_type?: unknown;
  allowed_sections?: unknown;
  priority?: unknown;
  canonical?: unknown;
  media?: unknown;
  media_associations?: unknown;
  event_date?: unknown;
  event_year?: unknown;
  rotation_group?: unknown;
  feature_weight?: unknown;
  review_notes?: unknown;
  reviewer?: unknown;
  triage_flags?: unknown;
  duplicate_candidate?: unknown;
  retention_reason?: unknown;
  purge_eligible_at?: unknown;
  target_inventory_id?: unknown;
};

const STORY_TYPES = new Set(["primary", "secondary", "brief"]);
const TRIAGE_STATUSES = new Set(["pending", "triaged"]);
const REVIEWABLE_STATUSES = new Set(["pending", "triaged", "under_review"]);
const ACTIONS = new Set(["triage", "start_review", "approve", "merge", "reject", "purge"]);

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function slugifyTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function jsonText(value: unknown, fallback: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return JSON.stringify(fallback);
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(fallback);
    }
  }
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value);
  }
  return JSON.stringify(fallback);
}

function normalizeOptionalDate(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function appendText(existing: unknown, addition: string): string {
  const current = String(existing || "").trim();
  return [current, addition.trim()].filter(Boolean).join("\n\n");
}

function defaultCreditFromSubmitter(value: unknown): string {
  const submittedBy = String(value || "").trim();
  return submittedBy.includes("<") ? submittedBy.split("<")[0].trim() : submittedBy;
}

/** Fail-open structured audit (P1-08 / #3416) — never blocks a successful editorial mutation. */
async function recordEditorialAudit(
  db: any,
  event: {
    action: string;
    objectType: string;
    objectId?: number | null;
    actor?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    meta?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    const nowRow = await db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());
    await db
      .prepare(
        `INSERT INTO editorial_audit_events
           (action, object_type, object_id, actor, outcome, before_json, after_json, meta_json, created_at)
         VALUES (?, ?, ?, ?, 'success', ?, ?, ?, ?)`,
      )
      .bind(
        event.action,
        event.objectType,
        event.objectId ?? null,
        event.actor ?? null,
        event.before ? JSON.stringify(event.before) : null,
        event.after ? JSON.stringify(event.after) : null,
        event.meta ? JSON.stringify(event.meta) : null,
        now,
      )
      .run();
  } catch (err) {
    console.error("editorial audit write error:", err);
  }
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["submission_queue", "content_inventory"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = (await request.json().catch(() => null)) as ReviewBody | null;
    const submissionId = asInt(body?.submission_id, 0);
    const action = asString(body?.action);

    if (!submissionId || !ACTIONS.has(action)) {
      return jsonResponse({ ok: false, error: "submission_id and valid action are required." }, 400);
    }

    const submission = await d1.db
      .prepare(
        `SELECT submission_id, submitted_by, payload, title, description, source_name, source_url,
                credit_line, proposed_tag, media_url, media_reference, status, triage_flags,
                duplicate_candidate, review_notes, retention_reason
           FROM submission_queue
          WHERE submission_id = ?`,
      )
      .bind(submissionId)
      .first();

    if (!submission) {
      return jsonResponse({ ok: false, error: "Submission not found." }, 404);
    }

    const nowRow = await d1.db.prepare("SELECT datetime('now') AS now, datetime('now', '+90 days') AS purge_eligible_at").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());
    const defaultPurgeEligibleAt = String((nowRow as any)?.purge_eligible_at || now);
    const reviewNotes = asString(body?.review_notes) || null;
    const reviewer = asString(body?.reviewer) || "admin-ui";
    const duplicateCandidate = asString(body?.duplicate_candidate) || null;
    const triageFlags = jsonText(body?.triage_flags, []);
    const currentStatus = String((submission as any).status || "");

    if (action === "triage") {
      if (!TRIAGE_STATUSES.has(currentStatus)) {
        return jsonResponse({ ok: false, error: "Only open submissions can be triaged." }, 409);
      }

      await d1.db
        .prepare(
          `UPDATE submission_queue
              SET status = 'triaged', triage_flags = ?, duplicate_candidate = ?, review_notes = ?,
                  updated_at = ?, reviewer = ?
            WHERE submission_id = ?`,
        )
        .bind(triageFlags, duplicateCandidate, reviewNotes, now, reviewer, submissionId)
        .run();

      await recordEditorialAudit(d1.db, {
        action: "triage",
        objectType: "submission",
        objectId: submissionId,
        actor: reviewer,
        before: { status: currentStatus },
        after: { status: "triaged" },
        meta: { duplicate_candidate: duplicateCandidate },
      });

      return jsonResponse({ ok: true, action: "triage", submission_id: submissionId }, 200);
    }

    if (action === "start_review") {
      if (!REVIEWABLE_STATUSES.has(currentStatus)) {
        return jsonResponse({ ok: false, error: "Only open submissions can enter review." }, 409);
      }

      await d1.db
        .prepare(
          `UPDATE submission_queue
              SET status = 'under_review', review_notes = ?, updated_at = ?, reviewer = ?
            WHERE submission_id = ?`,
        )
        .bind(reviewNotes, now, reviewer, submissionId)
        .run();

      await recordEditorialAudit(d1.db, {
        action: "start_review",
        objectType: "submission",
        objectId: submissionId,
        actor: reviewer,
        before: { status: currentStatus },
        after: { status: "under_review" },
      });

      return jsonResponse({ ok: true, action: "start_review", submission_id: submissionId }, 200);
    }

    if (action === "purge") {
      if (currentStatus !== "rejected") {
        return jsonResponse({ ok: false, error: "Only rejected submissions can be marked purged." }, 409);
      }
      if (String((submission as any).retention_reason || "").trim()) {
        return jsonResponse({ ok: false, error: "Retained rejected submissions cannot be purged." }, 409);
      }

      await d1.db
        .prepare(
          `UPDATE submission_queue
              SET status = 'purged', review_notes = ?, decision_by = ?, decision_at = ?,
                  updated_at = ?, reviewed_at = ?, reviewer = ?, purge_flag = 0
            WHERE submission_id = ?`,
        )
        .bind(reviewNotes, reviewer, now, now, now, reviewer, submissionId)
        .run();

      await recordEditorialAudit(d1.db, {
        action: "purge",
        objectType: "submission",
        objectId: submissionId,
        actor: reviewer,
        before: { status: currentStatus },
        after: { status: "purged" },
      });

      return jsonResponse({ ok: true, action: "purge", submission_id: submissionId }, 200);
    }

    if (!REVIEWABLE_STATUSES.has(currentStatus)) {
      return jsonResponse({ ok: false, error: "Submission has already reached a terminal review state." }, 409);
    }

    if (action === "reject") {
      const retentionReason = asString(body?.retention_reason) || null;
      const purgeEligibleAt = retentionReason ? null : normalizeOptionalDate(body?.purge_eligible_at) || defaultPurgeEligibleAt;

      await d1.db
        .prepare(
          `UPDATE submission_queue
              SET status = 'rejected', review_notes = ?, duplicate_candidate = ?,
                  retention_reason = ?, rejected_at = ?, purge_eligible_at = ?, purge_flag = ?,
                  decision_by = ?, decision_at = ?, updated_at = ?, reviewed_at = ?, reviewer = ?
            WHERE submission_id = ?`,
        )
        .bind(
          reviewNotes,
          duplicateCandidate,
          retentionReason,
          now,
          purgeEligibleAt,
          purgeEligibleAt ? 1 : 0,
          reviewer,
          now,
          now,
          now,
          reviewer,
          submissionId,
        )
        .run();

      await recordEditorialAudit(d1.db, {
        action: "reject",
        objectType: "submission",
        objectId: submissionId,
        actor: reviewer,
        before: { status: currentStatus },
        after: { status: "rejected" },
        meta: { retention_reason: retentionReason, purge_eligible_at: purgeEligibleAt },
      });

      return jsonResponse({ ok: true, action: "reject", submission_id: submissionId }, 200);
    }

    if (action === "merge") {
      const targetInventoryId = asInt(body?.target_inventory_id, 0);
      if (!targetInventoryId) {
        return jsonResponse({ ok: false, error: "target_inventory_id is required for merge." }, 400);
      }

      const target = await d1.db
        .prepare("SELECT id, title, review_notes, search_text FROM content_inventory WHERE id = ?")
        .bind(targetInventoryId)
        .first();

      if (!target) {
        return jsonResponse({ ok: false, error: "Target content record not found." }, 404);
      }

      const title = String((submission as any).title || "").trim();
      const text = String((submission as any).description || "").trim();
      const mergeNote = appendText(
        reviewNotes,
        `Merged submission #${submissionId} (${title || "untitled"}) into content_inventory #${targetInventoryId} by ${reviewer}.`,
      );
      const nextNotes = appendText((target as any).review_notes, mergeNote);
      const nextSearchText = [String((target as any).search_text || ""), title, text].filter(Boolean).join(" ").trim();

      await d1.db
        .prepare("UPDATE content_inventory SET review_notes = ?, search_text = ?, updated_at = ? WHERE id = ?")
        .bind(nextNotes, nextSearchText, now, targetInventoryId)
        .run();

      await d1.db
        .prepare(
          `UPDATE submission_queue
              SET status = 'merged', review_notes = ?, duplicate_candidate = ?, decision_by = ?,
                  decision_at = ?, updated_at = ?, reviewed_at = ?, reviewer = ?, purge_flag = 0
            WHERE submission_id = ?`,
        )
        .bind(mergeNote, duplicateCandidate || String(targetInventoryId), reviewer, now, now, now, reviewer, submissionId)
        .run();

      await recordEditorialAudit(d1.db, {
        action: "merge",
        objectType: "submission",
        objectId: submissionId,
        actor: reviewer,
        before: { status: currentStatus },
        after: { status: "merged" },
        meta: { inventory_id: targetInventoryId },
      });

      return jsonResponse({ ok: true, action: "merge", submission_id: submissionId, inventory_id: targetInventoryId }, 200);
    }

    const title = String((submission as any).title || "").trim();
    const text = String((submission as any).description || "").trim();
    const tag = slugifyTag(asString(body?.tag) || String((submission as any).proposed_tag || "") || title);
    const summary = asString(body?.summary) || null;
    const perspectiveLabel = asString(body?.perspective_label) || null;
    const storyType = STORY_TYPES.has(asString(body?.story_type)) ? asString(body?.story_type) : "brief";
    const sourceUrl = asString(body?.source_url) || String((submission as any).source_url || "").trim() || null;
    const sourceName = asString(body?.source_name) || String((submission as any).source_name || "").trim() || "Member submission";
    const creditLine =
      asString(body?.credit_line) ||
      String((submission as any).credit_line || "").trim() ||
      defaultCreditFromSubmitter((submission as any).submitted_by);
    const allowedSections = jsonText(body?.allowed_sections, ["library"]);
    const priority = asInt(body?.priority, 0);
    const canonical = body?.canonical === false || body?.canonical === 0 ? 0 : 1;
    const eventDate = asString(body?.event_date) || null;
    const eventYear = asOptionalInt(body?.event_year);
    const rotationGroup = asString(body?.rotation_group) || null;
    const featureWeight = Math.max(1, asInt(body?.feature_weight, 1));
    const searchText = [title, text, summary, tag, perspectiveLabel, sourceName, creditLine, eventDate, eventYear]
      .filter(Boolean)
      .join(" ");

    if (!title || !text || !tag || !creditLine) {
      return jsonResponse({ ok: false, error: "Approved records require title, text, tag, and credit_line." }, 400);
    }

    if (canonical === 0 && !perspectiveLabel) {
      return jsonResponse({ ok: false, error: "Alternate-perspective records require perspective_label." }, 400);
    }

    const associationsResult = await buildAssociationsFromSubmission(
      d1.db,
      submission as Record<string, unknown>,
      body?.media_associations ?? body?.media,
      { source_name: sourceName, source_url: sourceUrl, credit_line: creditLine },
    );
    if (!associationsResult.ok) {
      return jsonResponse({ ok: false, error: associationsResult.error }, 400);
    }

    const mediaTables = await requireTables(d1.db, ["content_inventory_media", "photos"]);
    if (!mediaTables.ok && associationsResult.value.length) {
      return jsonResponse(mediaTables.body, mediaTables.status);
    }

    const initialMediaJson = "[]";
    const insert = await d1.db
      .prepare(
        `INSERT INTO content_inventory
          (tag, title, text, summary, perspective_label, media, story_type, allowed_sections, priority,
           search_text, canonical, source_name, source_url, credit_line, event_date, event_year,
           rotation_group, feature_weight,
           status, review_notes, submitted_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      )
      .bind(
        tag,
        title,
        text,
        summary,
        perspectiveLabel,
        initialMediaJson,
        storyType,
        allowedSections,
        priority,
        searchText,
        canonical,
        sourceName,
        sourceUrl,
        creditLine,
        eventDate,
        eventYear,
        rotationGroup,
        featureWeight,
        reviewNotes,
        (submission as any).submitted_by || null,
        now,
      )
      .run();

    await d1.db
      .prepare(
        `UPDATE submission_queue
            SET status = 'approved', review_notes = ?, duplicate_candidate = ?, decision_by = ?,
                decision_at = ?, updated_at = ?, reviewed_at = ?, reviewer = ?, purge_flag = 0
          WHERE submission_id = ?`,
      )
      .bind(reviewNotes, duplicateCandidate, reviewer, now, now, now, reviewer, submissionId)
      .run();

    const inventoryId = (insert as any)?.meta?.last_row_id ?? (insert as any)?.meta?.lastRowId ?? null;

    if (inventoryId && associationsResult.value.length && mediaTables.ok) {
      await insertStoryMediaAssociations(d1.db, inventoryId, associationsResult.value, now);
      const photoRows = await loadPhotosByIds(
        d1.db,
        associationsResult.value.map((association) => association.media_id),
      );
      const mediaJson = serializeLegacyMediaJson(associationsResult.value, photoRows);
      const mediaSearchText = associationsResult.value
        .flatMap((association) => [association.caption, association.alt_text, association.credit_line])
        .filter(Boolean)
        .join(" ");

      await d1.db
        .prepare("UPDATE content_inventory SET media = ?, search_text = ?, updated_at = ? WHERE id = ?")
        .bind(mediaJson, [searchText, mediaSearchText].filter(Boolean).join(" ").trim(), now, inventoryId)
        .run();
    }

    await recordEditorialAudit(d1.db, {
      action: "approve",
      objectType: "submission",
      objectId: submissionId,
      actor: reviewer,
      before: { status: currentStatus },
      after: { status: "approved" },
      meta: { inventory_id: inventoryId },
    });

    return jsonResponse(
      {
        ok: true,
        action: "approve",
        submission_id: submissionId,
        inventory_id: inventoryId,
        media_associations: associationsResult.value,
      },
      200,
    );
  } catch (err: any) {
    const message = String(err?.message || err);
    if (message.toLowerCase().includes("unique")) {
      return jsonResponse({ ok: false, error: "A canonical content record already exists for that tag." }, 409);
    }
    console.error("admin editorial review error:", err);
    return jsonResponse({ ok: false, error: "Editorial review failed." }, 500);
  }
};
