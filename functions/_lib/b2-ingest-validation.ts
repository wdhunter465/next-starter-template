// #3551 step 6 ("Ingest approved bytes"): validation for a fetched candidate
// original before it is written to B2. Pure functions, no network or B2
// access -- the ingestion endpoint fetches bytes, then calls these to decide
// whether the result is acceptable.

export const MAX_INGEST_BYTES = 25 * 1024 * 1024; // 25MB

export const ALLOWED_INGEST_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
]);

export type MagicByteCheck = {
  contentType: string;
  matches: (bytes: Uint8Array) => boolean;
};

// Minimal, well-known signatures. This is a sanity check that the declared
// Content-Type matches what the bytes actually are -- not a full format
// validator.
const MAGIC_BYTE_CHECKS: MagicByteCheck[] = [
  {
    contentType: "image/jpeg",
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    contentType: "image/png",
    matches: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    contentType: "image/gif",
    matches: (b) =>
      b.length >= 6 &&
      b[0] === 0x47 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61,
  },
  {
    contentType: "image/webp",
    matches: (b) =>
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    contentType: "image/tiff",
    matches: (b) =>
      b.length >= 4 &&
      ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) || // little-endian
        (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)), // big-endian
  },
];

export type IngestValidationResult = { ok: true } | { ok: false; error: string };

export function validateIngestContentType(contentType: string | null): IngestValidationResult {
  const normalized = (contentType || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_INGEST_CONTENT_TYPES.has(normalized)) {
    return {
      ok: false,
      error: `Unsupported content type: ${contentType || "(missing)"}. Allowed: ${[...ALLOWED_INGEST_CONTENT_TYPES].join(", ")}.`,
    };
  }
  return { ok: true };
}

export function validateIngestSize(byteLength: number): IngestValidationResult {
  if (byteLength <= 0) {
    return { ok: false, error: "Fetched body is empty." };
  }
  if (byteLength > MAX_INGEST_BYTES) {
    return { ok: false, error: `Fetched body (${byteLength} bytes) exceeds the ${MAX_INGEST_BYTES}-byte limit.` };
  }
  return { ok: true };
}

export function validateIngestMagicBytes(contentType: string, bytes: Uint8Array): IngestValidationResult {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const check = MAGIC_BYTE_CHECKS.find((c) => c.contentType === normalized);
  if (!check) {
    return { ok: false, error: `No magic-byte signature known for content type: ${contentType}.` };
  }
  if (!check.matches(bytes)) {
    return { ok: false, error: `File bytes do not match the declared content type (${contentType}).` };
  }
  return { ok: true };
}

export function validateIngestSourceUrl(
  sourceUrl: string,
  approvedDomains: ReadonlySet<string>,
): IngestValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return { ok: false, error: `source_fetch_url is not a valid URL: ${sourceUrl}` };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "source_fetch_url must use https." };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = [...approvedDomains].some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!allowed) {
    return { ok: false, error: `source_fetch_url host "${host}" is not one of the allowlisted source domains.` };
  }
  return { ok: true };
}

export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
