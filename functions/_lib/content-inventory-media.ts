import { rightsClearedClause } from "./rights-hold";

export const MEDIA_ROLES = new Set([
  "primary_image",
  "gallery_image",
  "ocr_source",
  "newspaper_source",
  "memorabilia_reference",
  "supporting_image",
]);

const PUBLIC_IMAGE_ROLES = new Set([
  "primary_image",
  "gallery_image",
  "memorabilia_reference",
  "supporting_image",
]);

export type MediaAssociationInput = {
  media_id?: unknown;
  media_role?: unknown;
  display_order?: unknown;
  caption?: unknown;
  alt_text?: unknown;
  source_name?: unknown;
  source_url?: unknown;
  credit_line?: unknown;
};

export type NormalizedMediaAssociation = {
  media_id: number;
  media_role: string;
  display_order: number;
  caption: string | null;
  alt_text: string | null;
  source_name: string | null;
  source_url: string | null;
  credit_line: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function parseMediaAssociationsInput(value: unknown): MediaAssociationInput[] {
  if (Array.isArray(value)) return value as MediaAssociationInput[];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? (parsed as MediaAssociationInput[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeMediaAssociation(
  input: MediaAssociationInput,
  index: number,
): { ok: true; value: NormalizedMediaAssociation } | { ok: false; error: string } {
  const mediaId = asInt(input.media_id, 0);
  const mediaRole = asString(input.media_role) || "supporting_image";
  const displayOrder = asInt(input.display_order, index);
  const caption = asString(input.caption) || null;
  const altText = asString(input.alt_text) || null;
  const sourceName = asString(input.source_name) || null;
  const sourceUrl = asString(input.source_url) || null;
  const creditLine = asString(input.credit_line) || null;

  if (!mediaId) {
    return { ok: false, error: "Each media association requires media_id." };
  }
  if (!MEDIA_ROLES.has(mediaRole)) {
    return { ok: false, error: `Invalid media_role: ${mediaRole}` };
  }
  if (PUBLIC_IMAGE_ROLES.has(mediaRole) && !altText) {
    return { ok: false, error: `media_role ${mediaRole} requires alt_text.` };
  }

  return {
    ok: true,
    value: {
      media_id: mediaId,
      media_role: mediaRole,
      display_order: displayOrder,
      caption,
      alt_text: altText,
      source_name: sourceName,
      source_url: sourceUrl,
      credit_line: creditLine,
    },
  };
}

export function normalizeMediaAssociations(
  value: unknown,
): { ok: true; value: NormalizedMediaAssociation[] } | { ok: false; error: string } {
  const inputs = parseMediaAssociationsInput(value);
  const normalized: NormalizedMediaAssociation[] = [];

  for (let index = 0; index < inputs.length; index += 1) {
    const result = normalizeMediaAssociation(inputs[index], index);
    if (!result.ok) return result;
    normalized.push(result.value);
  }

  normalized.sort((a, b) => a.display_order - b.display_order || a.media_id - b.media_id);
  return { ok: true, value: normalized };
}

export function serializeLegacyMediaJson(associations: NormalizedMediaAssociation[], photoRows: Array<Record<string, unknown>>): string {
  const photoById = new Map<number, Record<string, unknown>>();
  for (const row of photoRows) {
    const id = asInt(row.id, 0);
    if (id) photoById.set(id, row);
  }

  const payload = associations.map((association) => {
    const photo = photoById.get(association.media_id);
    return {
      media_id: association.media_id,
      media_role: association.media_role,
      display_order: association.display_order,
      url: photo?.url || null,
      photo_id: photo?.photo_id || null,
      caption: association.caption,
      alt_text: association.alt_text,
      source_name: association.source_name,
      source_url: association.source_url,
      credit_line: association.credit_line,
    };
  });

  return JSON.stringify(payload);
}

export async function resolvePhotoByReference(
  db: any,
  reference: string,
): Promise<Record<string, unknown> | null> {
  const trimmed = reference.trim();
  if (!trimmed) return null;

  const numericId = Number(trimmed);
  if (Number.isFinite(numericId) && numericId > 0) {
    const byId = await db
      .prepare(`SELECT id, photo_id, url, title, description, source FROM photos WHERE id = ? AND ${rightsClearedClause()}`)
      .bind(Math.trunc(numericId))
      .first();
    if (byId) return byId;
  }

  const byPhotoId = await db
    .prepare(`SELECT id, photo_id, url, title, description, source FROM photos WHERE lower(trim(photo_id)) = lower(trim(?)) AND ${rightsClearedClause()}`)
    .bind(trimmed)
    .first();
  if (byPhotoId) return byPhotoId;

  return db
    .prepare(`SELECT id, photo_id, url, title, description, source FROM photos WHERE lower(trim(url)) = lower(trim(?)) AND ${rightsClearedClause()}`)
    .bind(trimmed)
    .first();
}

export async function loadPhotosByIds(db: any, mediaIds: number[]): Promise<Array<Record<string, unknown>>> {
  if (!mediaIds.length) return [];
  const placeholders = mediaIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT id, photo_id, url, title, description, source, is_memorabilia
         FROM photos
        WHERE id IN (${placeholders})`,
    )
    .bind(...mediaIds)
    .all();
  return rows?.results || [];
}

export async function insertStoryMediaAssociations(
  db: any,
  storyId: number,
  associations: NormalizedMediaAssociation[],
  now: string,
): Promise<void> {
  for (const association of associations) {
    await db
      .prepare(
        `INSERT INTO content_inventory_media
          (story_id, media_id, media_role, display_order, caption, alt_text,
           source_name, source_url, credit_line, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(story_id, media_id, media_role) DO UPDATE SET
           display_order = excluded.display_order,
           caption = excluded.caption,
           alt_text = excluded.alt_text,
           source_name = excluded.source_name,
           source_url = excluded.source_url,
           credit_line = excluded.credit_line,
           updated_at = excluded.updated_at`,
      )
      .bind(
        storyId,
        association.media_id,
        association.media_role,
        association.display_order,
        association.caption,
        association.alt_text,
        association.source_name,
        association.source_url,
        association.credit_line,
        now,
        now,
      )
      .run();
  }
}

export async function listStoryMediaAssociations(
  db: any,
  storyIds: number[],
): Promise<Map<number, Array<Record<string, unknown>>>> {
  const grouped = new Map<number, Array<Record<string, unknown>>>();
  if (!storyIds.length) return grouped;

  const placeholders = storyIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT cim.id, cim.story_id, cim.media_id, cim.media_role, cim.display_order,
              cim.caption, cim.alt_text, cim.source_name, cim.source_url, cim.credit_line,
              p.photo_id, p.url, p.title AS photo_title, p.description AS photo_description,
              p.source AS photo_source, p.is_memorabilia
         FROM content_inventory_media cim
         JOIN photos p ON p.id = cim.media_id AND ${rightsClearedClause("p")}
        WHERE cim.story_id IN (${placeholders})
        ORDER BY cim.story_id ASC, cim.display_order ASC, cim.id ASC`,
    )
    .bind(...storyIds)
    .all();

  for (const row of rows?.results || []) {
    const storyId = asInt((row as any).story_id, 0);
    if (!grouped.has(storyId)) grouped.set(storyId, []);
    grouped.get(storyId)?.push(row);
  }

  return grouped;
}

export async function buildAssociationsFromSubmission(
  db: any,
  submission: Record<string, unknown>,
  bodyAssociations: unknown,
  storyDefaults: { source_name: string; source_url: string | null; credit_line: string },
): Promise<{ ok: true; value: NormalizedMediaAssociation[] } | { ok: false; error: string }> {
  const explicit = normalizeMediaAssociations(bodyAssociations);
  if (!explicit.ok) return explicit;
  if (explicit.value.length) return explicit;

  const reference = asString(submission.media_reference) || asString(submission.media_url);
  if (!reference) return { ok: true, value: [] };

  const photo = await resolvePhotoByReference(db, reference);
  if (!photo) {
    return { ok: false, error: "Submission media reference does not match an approved photo record." };
  }

  const altText =
    asString(photo.title) || asString(photo.description) || "Historical photo associated with submitted story.";

  return {
    ok: true,
    value: [
      {
        media_id: asInt(photo.id, 0),
        media_role: Number(photo.is_memorabilia) === 1 ? "memorabilia_reference" : "supporting_image",
        display_order: 0,
        caption: asString(photo.description) || null,
        alt_text: altText,
        source_name: storyDefaults.source_name,
        source_url: storyDefaults.source_url || asString(photo.source) || null,
        credit_line: storyDefaults.credit_line,
      },
    ],
  };
}
