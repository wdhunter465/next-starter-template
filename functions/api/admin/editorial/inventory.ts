// POST /api/admin/editorial/inventory
// Creates or updates content_inventory draft metadata. Protected by ADMIN_TOKEN.

import { requireAdmin } from "../../../_lib/auth";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

const STORY_TYPES = new Set(["primary", "secondary", "brief"]);
const ALLOWED_SECTION_KEYS = new Set([
  "homepage_spotlight",
  "homepage_discussions",
  "homepage_milestones",
  "library",
  "club_home",
  "search",
  "archive",
  "related_content",
]);

type InventoryBody = {
  id?: unknown;
  tag?: unknown;
  title?: unknown;
  text?: unknown;
  summary?: unknown;
  perspective_label?: unknown;
  story_type?: unknown;
  source_name?: unknown;
  source_url?: unknown;
  credit_line?: unknown;
  allowed_sections?: unknown;
  priority?: unknown;
  canonical?: unknown;
  event_date?: unknown;
  event_year?: unknown;
  rotation_group?: unknown;
  feature_weight?: unknown;
  review_notes?: unknown;
  submitted_by?: unknown;
};

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

/** Fail-open structured audit — never blocks a successful editorial mutation. */
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

function normalizeAllowedSections(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  let sections: string[] = [];
  if (Array.isArray(value)) {
    sections = value.map((entry) => asString(entry)).filter(Boolean);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      sections = [];
    } else {
      try {
        const parsed = JSON.parse(trimmed);
        sections = Array.isArray(parsed) ? parsed.map((entry) => asString(entry)).filter(Boolean) : [];
      } catch {
        sections = trimmed.split(",").map((entry) => entry.trim()).filter(Boolean);
      }
    }
  }

  if (!sections.length) {
    sections = ["library"];
  }

  for (const section of sections) {
    if (!ALLOWED_SECTION_KEYS.has(section)) {
      return { ok: false, error: `Invalid allowed_sections value: ${section}` };
    }
  }

  return { ok: true, value: JSON.stringify([...new Set(sections)]) };
}

function buildSearchText(fields: {
  title: string;
  text: string;
  summary: string | null;
  tag: string;
  perspectiveLabel: string | null;
  sourceName: string;
  creditLine: string;
  eventDate: string | null;
  eventYear: number | null;
}): string {
  return [
    fields.title,
    fields.text,
    fields.summary,
    fields.tag,
    fields.perspectiveLabel,
    fields.sourceName,
    fields.creditLine,
    fields.eventDate,
    fields.eventYear,
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim())
    .join(" ")
    .trim();
}

function parseInventoryFields(body: InventoryBody | null) {
  const title = asString(body?.title);
  const text = asString(body?.text);
  const tag = slugifyTag(asString(body?.tag) || title);
  const summary = asString(body?.summary) || null;
  const perspectiveLabel = asString(body?.perspective_label) || null;
  const storyType = STORY_TYPES.has(asString(body?.story_type)) ? asString(body?.story_type) : "brief";
  const sourceName = asString(body?.source_name) || "Editorial draft";
  const sourceUrl = asString(body?.source_url) || null;
  const creditLine = asString(body?.credit_line);
  const allowedSections = normalizeAllowedSections(body?.allowed_sections);
  const priority = asInt(body?.priority, 0);
  const canonical = body?.canonical === false || body?.canonical === 0 ? 0 : 1;
  const eventDate = asString(body?.event_date) || null;
  const eventYear = asOptionalInt(body?.event_year);
  const rotationGroup = asString(body?.rotation_group) || null;
  const featureWeight = Math.max(1, asInt(body?.feature_weight, 1));
  const reviewNotes = asString(body?.review_notes) || null;
  const submittedBy = asString(body?.submitted_by) || "admin-ui";

  return {
    title,
    text,
    tag,
    summary,
    perspectiveLabel,
    storyType,
    sourceName,
    sourceUrl,
    creditLine,
    allowedSections,
    priority,
    canonical,
    eventDate,
    eventYear,
    rotationGroup,
    featureWeight,
    reviewNotes,
    submittedBy,
  };
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["content_inventory"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = (await request.json().catch(() => null)) as InventoryBody | null;
    const id = asInt(body?.id, 0);
    const fields = parseInventoryFields(body);

    if (!fields.allowedSections.ok) {
      return jsonResponse({ ok: false, error: fields.allowedSections.error }, 400);
    }

    if (!fields.title || !fields.text || !fields.tag || !fields.creditLine) {
      return jsonResponse({ ok: false, error: "title, text, tag, and credit_line are required." }, 400);
    }

    if (fields.canonical === 0 && !fields.perspectiveLabel) {
      return jsonResponse(
        { ok: false, error: "Alternate-perspective records require perspective_label." },
        400,
      );
    }

    const searchText = buildSearchText({
      title: fields.title,
      text: fields.text,
      summary: fields.summary,
      tag: fields.tag,
      perspectiveLabel: fields.perspectiveLabel,
      sourceName: fields.sourceName,
      creditLine: fields.creditLine,
      eventDate: fields.eventDate,
      eventYear: fields.eventYear,
    });

    const nowRow = await d1.db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());

    if (id) {
      const existing = await d1.db
        .prepare("SELECT id, status FROM content_inventory WHERE id = ?")
        .bind(id)
        .first();

      if (!existing) {
        return jsonResponse({ ok: false, error: "Content record not found." }, 404);
      }

      await d1.db
        .prepare(
          `UPDATE content_inventory
              SET tag = ?, title = ?, text = ?, summary = ?, perspective_label = ?, story_type = ?,
                  allowed_sections = ?, priority = ?, search_text = ?, canonical = ?, source_name = ?,
                  source_url = ?, credit_line = ?, event_date = ?, event_year = ?, rotation_group = ?,
                  feature_weight = ?, review_notes = ?, updated_at = ?
            WHERE id = ?`,
        )
        .bind(
          fields.tag,
          fields.title,
          fields.text,
          fields.summary,
          fields.perspectiveLabel,
          fields.storyType,
          fields.allowedSections.value,
          fields.priority,
          searchText,
          fields.canonical,
          fields.sourceName,
          fields.sourceUrl,
          fields.creditLine,
          fields.eventDate,
          fields.eventYear,
          fields.rotationGroup,
          fields.featureWeight,
          fields.reviewNotes,
          now,
          id,
        )
        .run();

      await recordEditorialAudit(d1.db, {
        action: "inventory_update",
        objectType: "content_inventory",
        objectId: id,
        actor: fields.submittedBy || "admin-ui",
        before: { status: String((existing as any).status || "draft") },
        after: { status: String((existing as any).status || "draft"), tag: fields.tag },
      });

      return jsonResponse({ ok: true, action: "update", id, status: String((existing as any).status || "draft") }, 200);
    }

    const insert = await d1.db
      .prepare(
        `INSERT INTO content_inventory
          (tag, title, text, summary, perspective_label, media, story_type, allowed_sections, priority,
           search_text, canonical, source_name, source_url, credit_line, event_date, event_year,
           rotation_group, feature_weight, status, review_notes, submitted_by, updated_at)
         VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      )
      .bind(
        fields.tag,
        fields.title,
        fields.text,
        fields.summary,
        fields.perspectiveLabel,
        fields.storyType,
        fields.allowedSections.value,
        fields.priority,
        searchText,
        fields.canonical,
        fields.sourceName,
        fields.sourceUrl,
        fields.creditLine,
        fields.eventDate,
        fields.eventYear,
        fields.rotationGroup,
        fields.featureWeight,
        fields.reviewNotes,
        fields.submittedBy,
        now,
      )
      .run();

    const inventoryId = (insert as any)?.meta?.last_row_id ?? (insert as any)?.meta?.lastRowId ?? null;

    await recordEditorialAudit(d1.db, {
      action: "inventory_create",
      objectType: "content_inventory",
      objectId: inventoryId == null ? null : Number(inventoryId),
      actor: fields.submittedBy || "admin-ui",
      before: null,
      after: { status: "draft", tag: fields.tag },
    });

    return jsonResponse({ ok: true, action: "create", id: inventoryId, status: "draft" }, 200);
  } catch (err: any) {
    const message = String(err?.message || err);
    if (message.toLowerCase().includes("unique")) {
      return jsonResponse({ ok: false, error: "A canonical content record already exists for that tag." }, 409);
    }
    console.error("admin editorial inventory error:", err);
    return jsonResponse({ ok: false, error: "Inventory save failed." }, 500);
  }
};
