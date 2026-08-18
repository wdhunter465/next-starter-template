// GET /api/admin/editorial/rotation-preview
// Admin-only ranked preview of the published rotation set as of a chosen date.
// Does not write last_featured, invent slot_rotation/incoming_set, or publish.

import { requireAdmin } from "../../../_lib/auth";
import {
  CLUB_HOME_SECTION,
  LIBRARY_SECTION,
  RELATED_CONTENT_SECTION,
  SEARCH_SECTION,
} from "../../../_lib/content-inventory-public";
import {
  computeRotationScore,
  fetchRotationRankedInventory,
  HOMEPAGE_DISCUSSIONS_SECTION,
  HOMEPAGE_MILESTONES_SECTION,
  HOMEPAGE_SPOTLIGHT_SECTION,
  type RotationRow,
} from "../../../_lib/content-inventory-rotation";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

const VALID_SECTIONS = new Set([
  CLUB_HOME_SECTION,
  LIBRARY_SECTION,
  RELATED_CONTENT_SECTION,
  SEARCH_SECTION,
  HOMEPAGE_SPOTLIGHT_SECTION,
  HOMEPAGE_DISCUSSIONS_SECTION,
  HOMEPAGE_MILESTONES_SECTION,
  "archive",
]);

function parseLimit(raw: string | null): number {
  const n = Number(raw || "8");
  return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 20) : 8;
}

function parseAsOf(raw: string | null): { ok: true; date: Date } | { ok: false; error: string } {
  if (!raw || !raw.trim()) {
    return { ok: true, date: new Date() };
  }

  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      return { ok: false, error: "Invalid as_of; use YYYY-MM-DD or ISO-8601." };
    }
    return { ok: true, date };
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: "Invalid as_of; use YYYY-MM-DD or ISO-8601." };
  }
  return { ok: true, date: new Date(parsed) };
}

function toPreviewItem(row: RotationRow, asOfDate: Date) {
  return {
    id: row.id,
    title: row.title ?? null,
    summary: (row as { summary?: string | null }).summary ?? null,
    source_name: row.source_name ?? null,
    credit_line: row.credit_line ?? null,
    priority: row.priority ?? null,
    canonical: Number(row.canonical) === 1 || row.canonical === true,
    last_featured: row.last_featured ?? null,
    event_date: row.event_date ?? null,
    rotation_group: row.rotation_group ?? null,
    score: computeRotationScore(row, { asOfDate }),
  };
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["content_inventory"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const section = (url.searchParams.get("section") || CLUB_HOME_SECTION).trim().toLowerCase();
    const asOfResult = parseAsOf(url.searchParams.get("as_of"));
    const limit = parseLimit(url.searchParams.get("limit"));

    if (!VALID_SECTIONS.has(section)) {
      return jsonResponse({ ok: false, error: "Invalid section." }, 400);
    }

    if (!asOfResult.ok) {
      return jsonResponse({ ok: false, error: asOfResult.error }, 400);
    }

    const { items, total } = await fetchRotationRankedInventory(d1.db, {
      sectionKey: section,
      limit,
      asOfDate: asOfResult.date,
    });

    return jsonResponse(
      {
        ok: true,
        section,
        as_of: asOfResult.date.toISOString(),
        total,
        items: items.map((row) => toPreviewItem(row, asOfResult.date)),
        note: "Admin preview of the published rotation ranking. Does not write last_featured or publish.",
      },
      200,
    );
  } catch (error: any) {
    return jsonResponse(
      {
        ok: false,
        error: "Rotation preview failed.",
        detail: error?.message || "Unknown error",
      },
      500,
    );
  }
};
