// Chronicling America page discovery (#4788 / #5110).
//
// Opt-in only. The scheduled Gehrig discovery workflow does not list this
// source. Search goes through the Library of Congress collection JSON API
// (https://www.loc.gov/collections/chronicling-america/), not the retired
// chroniclingamerica.loc.gov/search/pages/results/ endpoint (#5110).
//
// Candidates use source_domain loc.gov because that row is already on the
// approved source list. content_type is photo so archive selection picks them
// up; pages are treated as newspaper pictures (800 px floor) at ingest.
//
// One search request per call. Send a descriptive User-Agent. HTTP 429 and
// 5xx retry up to 3 times with backoff. Any other HTTP status fails
// immediately. Do not run two Chronicling America calls at once.
//
// A newspaper issue date before 1931-01-01 is a sourced first-publication
// date, so the candidate records the public-domain conclusion. A later date,
// or no date, stays on the ordinary rights path.

export const CHRONICLING_AMERICA_SEARCH_URL =
  "https://www.loc.gov/collections/chronicling-america/";
/** @deprecated Retired host path; kept for tests that assert the old failure mode. */
export const CHRONICLING_AMERICA_LEGACY_SEARCH_URL =
  "https://chroniclingamerica.loc.gov/search/pages/results/";
export const CHRONICLING_AMERICA_SOURCE_DOMAIN = "loc.gov";
export const PRE_1931_EXCLUSIVE_END = "1931-01-01";
export const NEWSPAPER_MIN_LONG_SIDE_PX = 800;

export type ChroniclingAmericaCandidateFields = {
  title: string;
  sourceType: "library";
  sourceName: "Library of Congress, Chronicling America";
  sourceOwner: string;
  sourceDomain: typeof CHRONICLING_AMERICA_SOURCE_DOMAIN;
  sourceUrl: string;
  summary: string;
  dateOrPeriod?: string;
  contentType: "photo";
  provenanceNotes: string;
  sourceRecordId: string;
  sourceCitation: string;
  rightsStatus: "public_domain_candidate" | "unknown";
  rightsEvidence: {
    evidence_type: "loc_statement";
    evidence_text: string;
    evidence_url?: string;
    conclusion?: "public_domain_confirmed";
  };
  /** Hint for archive ingest: newspaper picture floor (#5110 / #4861). */
  qualityTier?: "newspaper";
  imageUrl?: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json" | "text">>;

export class ChroniclingAmericaHttpError extends Error {
  status: number;

  constructor(url: string, status: number) {
    super(`${url} -> HTTP ${status}`);
    this.name = "ChroniclingAmericaHttpError";
    this.status = status;
  }
}

function firstScalar(value: unknown): string {
  if (Array.isArray(value)) {
    const hit = value.find((item) => item != null && String(item).trim() !== "");
    return hit == null ? "" : String(hit).trim();
  }
  if (value == null) return "";
  return String(value).trim();
}

// A newspaper issue date is a full calendar day. A bare year is not enough.
export function issueDate(value: unknown): string | null {
  const text = firstScalar(value);
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  const dashed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const parts = compact || dashed;
  if (!parts) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${parts[1]}-${parts[2]}-${parts[3]}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return iso;
}

/** Pull YYYY-MM-DD from a Chronicling America page URL when the JSON date is only a year. */
export function issueDateFromPageUrl(url: string): string | null {
  const match = /\/(\d{4}-\d{2}-\d{2})\//.exec(url);
  return match ? issueDate(match[1]) : null;
}

export function ocrExcerpt(value: unknown, needle = "gehrig"): string {
  const text = firstScalar(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const at = text.toLowerCase().indexOf(needle);
  const start = at < 0 ? 0 : Math.max(0, at - 80);
  const slice = text.slice(start, start + 240).trim();
  return slice.length < text.length ? `${slice}…` : slice;
}

export function buildChroniclingAmericaSearchUrl(
  query: string,
  limit: number,
  page = 1,
  dateStart = "1920",
  dateEnd = "1930",
): string {
  const rows = Math.min(Math.max(1, Math.floor(limit)), 20);
  const params = new URLSearchParams({
    q: query,
    fo: "json",
    c: String(rows),
    sp: String(Math.max(1, Math.floor(page))),
    dates: `${dateStart}/${dateEnd}`,
  });
  return `${CHRONICLING_AMERICA_SEARCH_URL}?${params.toString()}`;
}

/** Prefer a chroniclingamerica.loc.gov page URL; fall back to loc.gov item/resource. */
export function pickChroniclingPageUrl(item: Record<string, unknown>): string {
  const candidates = [
    firstScalar(item.id),
    firstScalar(item.url),
    firstScalar(item.aka),
    firstScalar((item.item as Record<string, unknown> | undefined)?.id),
    firstScalar((item.item as Record<string, unknown> | undefined)?.url),
  ];
  const chronicling = candidates.find((u) => /chroniclingamerica\.loc\.gov\/lccn\//i.test(u));
  if (chronicling) return chronicling;
  return candidates.find((u) => /^https?:\/\//i.test(u)) || "";
}

export function pickChroniclingImageUrl(item: Record<string, unknown>): string {
  const direct = firstScalar(item.image_url) || firstScalar(item.image);
  if (/^https?:\/\//i.test(direct)) return direct;
  const resources = item.resources;
  if (Array.isArray(resources)) {
    for (const resource of resources) {
      if (!resource || typeof resource !== "object") continue;
      const row = resource as Record<string, unknown>;
      for (const key of ["image", "url", "jp2", "pdf"]) {
        const value = firstScalar(row[key]);
        if (/^https?:\/\//i.test(value) && /\.(jpe?g|png|jp2|gif)(\?|$)/i.test(value)) return value;
      }
    }
  }
  const pageUrl = pickChroniclingPageUrl(item);
  // Stable thumbnail for a Classic CA page URL when search JSON names no image.
  if (/chroniclingamerica\.loc\.gov\/lccn\/.+\/seq-\d+/i.test(pageUrl)) {
    return pageUrl.replace(/\/?$/, "/") + "thumbnail.jpg";
  }
  return "";
}

export function mapChroniclingAmericaItemToCandidateFields(
  item: Record<string, unknown>,
  query: string,
): ChroniclingAmericaCandidateFields | null {
  const pageUrl = pickChroniclingPageUrl(item);
  if (!/^https?:\/\//i.test(pageUrl)) return null;

  const nested = (item.item && typeof item.item === "object" ? item.item : {}) as Record<string, unknown>;
  const date =
    issueDate(item.date) ||
    issueDate(nested.date) ||
    issueDateFromPageUrl(pageUrl) ||
    issueDate(firstScalar(item.date).replace(/[^\d]/g, "").slice(0, 8));
  const newspaper =
    firstScalar(item.title) ||
    firstScalar(nested.title) ||
    firstScalar(item.partof_title) ||
    "Untitled newspaper";
  const page = firstScalar(item.sequence) || firstScalar(nested.sequence) || (() => {
    const m = /\/seq-(\d+)/i.exec(pageUrl);
    return m ? m[1] : "";
  })();
  const edition = firstScalar(item.edition) || firstScalar(nested.edition);
  const excerpt =
    ocrExcerpt(item.ocr_eng) ||
    ocrExcerpt(item.description) ||
    ocrExcerpt(nested.description) ||
    ocrExcerpt(item.full_text);
  const imageUrl = pickChroniclingImageUrl(item);
  const before1931 = Boolean(date && date < PRE_1931_EXCLUSIVE_END);
  const title = page ? `${newspaper}, ${date || "undated"}, page ${page}` : `${newspaper}, ${date || "undated"}`;
  const evidenceText = [
    `Chronicling America newspaper issue.`,
    `Newspaper: ${newspaper}.`,
    `Issue date: ${date || "none"}.`,
    `Edition: ${edition || "none"}.`,
    `Page: ${page || "none"}.`,
    `OCR excerpt: ${excerpt || "none"}.`,
    "The issue date is the newspaper's own publication date.",
  ].join(" ");

  return {
    title,
    sourceType: "library",
    sourceName: "Library of Congress, Chronicling America",
    sourceOwner: "Library of Congress",
    sourceDomain: CHRONICLING_AMERICA_SOURCE_DOMAIN,
    sourceUrl: pageUrl,
    summary: excerpt || `${newspaper} page mentioning the query "${query}".`,
    ...(date ? { dateOrPeriod: date } : {}),
    contentType: "photo",
    qualityTier: "newspaper",
    ...(imageUrl ? { imageUrl } : {}),
    provenanceNotes: [
      `Chronicling America discovery for query "${query}" via loc.gov collection search (#5110).`,
      `Newspaper: ${newspaper}.`,
      `Issue date: ${date || "none"}. The date source is this newspaper issue record.`,
      `Page: ${page || "none"}. Edition: ${edition || "none"}.`,
      `Page URL: ${pageUrl}.`,
      imageUrl ? `Page image URL: ${imageUrl}.` : "No page image URL in the search hit; archive resolver must fetch the page JSON.",
      before1931
        ? "First published before 1931-01-01 with a sourced issue date, so the pre-1931 public-domain rule applies."
        : "No sourced issue date before 1931-01-01, so this stays on the ordinary rights path.",
    ].join(" "),
    sourceRecordId: pageUrl,
    sourceCitation: `Chronicling America, ${newspaper}, ${date || "undated"}, page ${page || "unknown"}`,
    rightsStatus: before1931 ? "public_domain_candidate" : "unknown",
    rightsEvidence: {
      evidence_type: "loc_statement",
      evidence_text: evidenceText,
      evidence_url: pageUrl,
      ...(before1931 ? { conclusion: "public_domain_confirmed" as const } : {}),
    },
  };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ChroniclingAmericaHttpError) return error.status === 429 || error.status >= 500;
  return true;
}

async function withRetry<T>(fn: () => Promise<T>, delay: (ms: number) => Promise<void>): Promise<T> {
  const maxAttempts = 3;
  const baseDelayMs = 500;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryable(error)) throw error;
      await delay(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

export function extractChroniclingSearchResults(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;
  if (Array.isArray(root.results)) return root.results as Record<string, unknown>[];
  if (Array.isArray(root.items)) return root.items as Record<string, unknown>[];
  const content = root.content;
  if (content && typeof content === "object" && Array.isArray((content as Record<string, unknown>).results)) {
    return (content as Record<string, unknown>).results as Record<string, unknown>[];
  }
  return [];
}

export async function fetchChroniclingAmericaItems(
  query: string,
  limit: number,
  page = 1,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Record<string, unknown>[]> {
  const url = buildChroniclingAmericaSearchUrl(query, limit, page);
  const data = await withRetry(async () => {
    const response = await fetchImpl(url, {
      headers: {
        "User-Agent": "LGFC-Gehrig-Content-Discovery/1.0 (lougehrigfanclub.com; contact via site)",
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new ChroniclingAmericaHttpError(url, response.status);
    return (await response.json()) as unknown;
  }, delay);
  return extractChroniclingSearchResults(data);
}

/** Page image URL from a Classic CA page JSON body (#5110). */
export function pageImageFromChroniclingPageJson(data: Record<string, unknown>, pageUrl: string): string | null {
  for (const key of ["jp2", "pdf", "full_image", "image_url", "thumbnail"]) {
    const value = firstScalar(data[key]);
    if (/^https?:\/\//i.test(value)) return value;
  }
  if (/chroniclingamerica\.loc\.gov\/lccn\/.+\/seq-\d+/i.test(pageUrl)) {
    return pageUrl.replace(/\/?$/, "/") + "thumbnail.jpg";
  }
  return null;
}

export function ocrFromChroniclingPageJson(data: Record<string, unknown>): string {
  return (
    ocrExcerpt(data.ocr_eng) ||
    ocrExcerpt(data.full_text) ||
    ocrExcerpt(data.text) ||
    ocrExcerpt((data as { ocr?: unknown }).ocr)
  );
}
