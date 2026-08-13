import { AwsClient } from "./aws4fetch";
import { requireB2, type B2Bindings } from "./b2";

export const MEDIA_ROLES = new Set([
  "primary_image",
  "gallery_image",
  "ocr_source",
  "newspaper_source",
  "memorabilia_reference",
  "supporting_image",
]);

/** P1-07 / #3419 long-edge contracts (px). Aspect-preserving; no upscaling. */
export const RENDITION_SIZES = ["thumbnail", "small", "medium", "large"] as const;
export type RenditionSize = (typeof RENDITION_SIZES)[number];

export const RENDITION_LONG_EDGE_PX: Record<RenditionSize, number> = {
  thumbnail: 320,
  small: 640,
  medium: 1280,
  large: 1920,
};

/** Club Home media feature requests the medium persisted rendition. */
export const CLUB_HOME_MEDIA_RENDITION_SIZE: RenditionSize = "medium";

export const RENDITION_OUTPUT_CONTENT_TYPE = "image/jpeg";

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
      .prepare("SELECT id, photo_id, url, title, description, source FROM photos WHERE id = ?")
      .bind(Math.trunc(numericId))
      .first();
    if (byId) return byId;
  }

  const byPhotoId = await db
    .prepare("SELECT id, photo_id, url, title, description, source FROM photos WHERE lower(trim(photo_id)) = lower(trim(?))")
    .bind(trimmed)
    .first();
  if (byPhotoId) return byPhotoId;

  return db
    .prepare("SELECT id, photo_id, url, title, description, source FROM photos WHERE lower(trim(url)) = lower(trim(?))")
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
         JOIN photos p ON p.id = cim.media_id
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

export function isRenditionSize(value: unknown): value is RenditionSize {
  return typeof value === "string" && (RENDITION_SIZES as readonly string[]).includes(value);
}

/**
 * Aspect-preserving long-edge resize math. Never upscales: if source long edge is
 * already <= contract, returns source dimensions unchanged.
 */
export function computeRenditionDimensions(
  sourceWidth: number,
  sourceHeight: number,
  size: RenditionSize,
): { width: number; height: number; longEdge: number; upscaled: false } | { ok: false; error: string } {
  const srcW = Math.trunc(sourceWidth);
  const srcH = Math.trunc(sourceHeight);
  if (!(srcW > 0 && srcH > 0)) {
    return { ok: false, error: "sourceWidth and sourceHeight must be positive integers." };
  }
  const contract = RENDITION_LONG_EDGE_PX[size];
  const sourceLong = Math.max(srcW, srcH);
  if (sourceLong <= contract) {
    return { width: srcW, height: srcH, longEdge: sourceLong, upscaled: false };
  }
  const scale = contract / sourceLong;
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  return { width, height, longEdge: Math.max(width, height), upscaled: false };
}

export function renditionObjectKey(mediaId: number, size: RenditionSize): string {
  return `club-newspaper/renditions/${mediaId}/${size}.jpg`;
}

export function publicUrlForRenditionKey(
  env: Record<string, unknown>,
  cfg: B2Bindings,
  key: string,
): string {
  const base = String(env.PUBLIC_B2_BASE_URL ?? "").trim();
  if (base) {
    const withSlash = base.endsWith("/") ? base : `${base}/`;
    return new URL(key.replace(/^\//, ""), withSlash).toString();
  }
  const pathBucket = cfg.B2_BUCKET.split("/").map(encodeURIComponent).join("/");
  const pathKey = key.split("/").map(encodeURIComponent).join("/");
  return `${cfg.B2_ENDPOINT.replace(/\/$/, "")}/${pathBucket}/${pathKey}`;
}

/** Fail-closed: only `ready` rows yield a URL. Never substitutes origin photos.url. */
export function readyRenditionUrl(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  if (String(row.status || "") !== "ready") return null;
  const url = typeof row.url === "string" ? row.url.trim() : "";
  return url || null;
}

export async function getMediaRendition(
  db: any,
  mediaId: number,
  size: RenditionSize,
): Promise<Record<string, unknown> | null> {
  return db
    .prepare(
      `SELECT id, media_id, size, b2_key, url, width_px, height_px, bytes, content_type,
              status, error, generated_at, generated_by
         FROM content_inventory_media_renditions
        WHERE media_id = ? AND size = ?`,
    )
    .bind(mediaId, size)
    .first();
}

export async function upsertMediaRendition(
  db: any,
  row: {
    media_id: number;
    size: RenditionSize;
    b2_key: string;
    url: string;
    width_px: number | null;
    height_px: number | null;
    bytes: number | null;
    content_type: string | null;
    status: "ready" | "failed" | "pending";
    error: string | null;
    generated_at: string;
    generated_by: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO content_inventory_media_renditions
        (media_id, size, b2_key, url, width_px, height_px, bytes, content_type,
         status, error, generated_at, generated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(media_id, size) DO UPDATE SET
         b2_key = excluded.b2_key,
         url = excluded.url,
         width_px = excluded.width_px,
         height_px = excluded.height_px,
         bytes = excluded.bytes,
         content_type = excluded.content_type,
         status = excluded.status,
         error = excluded.error,
         generated_at = excluded.generated_at,
         generated_by = excluded.generated_by`,
    )
    .bind(
      row.media_id,
      row.size,
      row.b2_key,
      row.url,
      row.width_px,
      row.height_px,
      row.bytes,
      row.content_type,
      row.status,
      row.error,
      row.generated_at,
      row.generated_by,
    )
    .run();
}

export async function putRenditionObject(
  cfg: B2Bindings,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const aws = new AwsClient({
    accessKeyId: cfg.B2_KEY_ID,
    secretAccessKey: cfg.B2_APP_KEY,
    sessionToken: undefined,
    service: "s3",
    region: undefined,
    cache: undefined,
    retries: 2,
    initRetryMs: undefined,
  });
  const pathBucket = cfg.B2_BUCKET.split("/").map(encodeURIComponent).join("/");
  const pathKey = key.split("/").map(encodeURIComponent).join("/");
  const url = `${cfg.B2_ENDPOINT.replace(/\/$/, "")}/${pathBucket}/${pathKey}`;
  const res = await aws.fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2 PutObject failed: HTTP ${res.status} ${text.slice(0, 400)}`);
  }
}

export function decodeBase64Bytes(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim().replace(/^data:[^;]+;base64,/, "");
  try {
    const binary = atob(trimmed);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function validatePersistedRenditionDimensions(input: {
  size: RenditionSize;
  source_width: number;
  source_height: number;
  width_px: number;
  height_px: number;
}): { ok: true } | { ok: false; error: string } {
  const expected = computeRenditionDimensions(input.source_width, input.source_height, input.size);
  if ("ok" in expected && expected.ok === false) return expected;
  const dims = expected as { width: number; height: number };
  if (input.width_px !== dims.width || input.height_px !== dims.height) {
    return {
      ok: false,
      error: `Declared dimensions ${input.width_px}x${input.height_px} do not match contract ${dims.width}x${dims.height} for ${input.size}.`,
    };
  }
  const contract = RENDITION_LONG_EDGE_PX[input.size];
  if (Math.max(input.width_px, input.height_px) > contract) {
    return { ok: false, error: `Long edge exceeds ${input.size} contract ${contract}px.` };
  }
  return { ok: true };
}

export { requireB2 };

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
