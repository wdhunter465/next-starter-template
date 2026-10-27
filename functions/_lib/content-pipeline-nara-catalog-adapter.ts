// National Archives Catalog discovery adapter for #4846.
//
// Opt-in only. The scheduled discovery workflow does not list this source.
// No request is sent unless NARA_CATALOG_API_KEY is set. The key is a header
// (`x-api-key`) and is never written into a URL, a candidate, or the repository.
// Product Authority provisions it. Email Catalog_API@nara.gov. Do not commit it.
//
// The Catalog API default quota is 10,000 queries per key per month. One search
// request per call. HTTP 429 and 5xx retry up to 3 times. Any other status fails
// immediately. Do not run two Catalog calls at once.
//
// A catalog record is not a public-domain conclusion. useRestriction.status is
// stored as evidence. productionDates are a date lead only. A candidate is on
// the pre-1931 path only when the record has a copyright date before 1931-01-01
// and a use-restriction status. This module never sets a rights conclusion.
//
// Required notice, carried on every candidate: "This product uses the National
// Archives Catalog API but is not endorsed or certified by the National Archives
// and Records Administration."

export const NARA_CATALOG_SEARCH_URL = "https://catalog.archives.gov/api/v2/records/search";
export const NARA_CATALOG_API_KEY_ENV = "NARA_CATALOG_API_KEY";
export const NARA_CATALOG_SOURCE_DOMAIN = "catalog.archives.gov";
export const NARA_ATTRIBUTION =
  "This product uses the National Archives Catalog API but is not endorsed or certified by the National Archives and Records Administration.";
const PRE_1931_EXCLUSIVE_END = "1931-01-01";

export class NaraApiKeyMissingError extends Error {
  constructor() {
    super(`${NARA_CATALOG_API_KEY_ENV} is required before a National Archives Catalog request. No request was sent.`);
    this.name = "NaraApiKeyMissingError";
  }
}

export class NaraCatalogHttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`National Archives Catalog search -> HTTP ${status}`);
    this.name = "NaraCatalogHttpError";
    this.status = status;
  }
}

export type NaraCandidateFields = {
  title: string;
  sourceType: "archive";
  sourceName: "National Archives Catalog";
  sourceOwner: "National Archives and Records Administration";
  sourceDomain: typeof NARA_CATALOG_SOURCE_DOMAIN;
  sourceUrl: string;
  summary: string;
  dateOrPeriod?: string;
  contentType: "article" | "photo" | "video";
  provenanceNotes: string;
  sourceRecordId: string;
  sourceCitation: string;
  rightsStatus: "unknown";
  rightsEvidence: {
    evidence_type: "other";
    evidence_text: string;
    evidence_url: string;
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

type DatedValue = { logicalDate?: unknown };

export function requireNaraCatalogApiKey(env: Record<string, string | undefined> = process.env): string {
  const apiKey = (env[NARA_CATALOG_API_KEY_ENV] ?? "").trim();
  if (!apiKey) throw new NaraApiKeyMissingError();
  return apiKey;
}

function firstScalar(value: unknown): string {
  if (Array.isArray(value)) {
    const hit = value.find((item) => item != null && String(item).trim() !== "");
    return hit == null ? "" : String(hit).trim();
  }
  if (value == null) return "";
  return String(value).trim();
}

export function calendarDate(value: unknown): string | null {
  const text = firstScalar(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return iso;
}

function logicalDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => calendarDate((item as DatedValue | null)?.logicalDate))
    .filter((item): item is string => Boolean(item));
}

function contentTypeFor(record: Record<string, unknown>): NaraCandidateFields["contentType"] {
  const types = JSON.stringify(record.generalRecordsTypes ?? "").toLowerCase();
  if (types.includes("moving")) return "video";
  if (types.includes("photograph") || types.includes("graphic")) return "photo";
  return "article";
}

export function buildNaraCatalogSearchUrl(query: string, limit: number): string {
  const rows = Math.min(Math.max(1, Math.floor(limit)), 20);
  const params = new URLSearchParams({
    q: query,
    limit: String(rows),
    availableOnline: "true",
  });
  return `${NARA_CATALOG_SEARCH_URL}?${params.toString()}`;
}

export function mapNaraHitToCandidateFields(hit: Record<string, unknown>, query: string): NaraCandidateFields | null {
  const source = (hit._source ?? {}) as { record?: Record<string, unknown> };
  const record = source.record ?? {};
  const naId = firstScalar(record.naId) || firstScalar(hit._id);
  if (!naId) return null;
  const title = firstScalar(record.title) || `National Archives ${naId}`;
  const pageUrl = `https://catalog.archives.gov/id/${encodeURIComponent(naId)}`;
  const useStatus = firstScalar((record.useRestriction as { status?: unknown } | undefined)?.status);
  const copyrightDate = logicalDates(record.copyrightDates)[0] ?? null;
  const productionDate = logicalDates(record.productionDates)[0] ?? null;
  const onPre1931Path = Boolean(useStatus && copyrightDate && copyrightDate < PRE_1931_EXCLUSIVE_END);
  const evidenceText = [
    `National Archives Catalog use restriction: ${useStatus || "none"}.`,
    `Copyright date: ${copyrightDate || "none"}.`,
    `Production date: ${productionDate || "none"}. A production date is not a first-publication date.`,
    "Catalog presence is not a public-domain conclusion.",
  ].join(" ");

  return {
    title,
    sourceType: "archive",
    sourceName: "National Archives Catalog",
    sourceOwner: "National Archives and Records Administration",
    sourceDomain: NARA_CATALOG_SOURCE_DOMAIN,
    sourceUrl: pageUrl,
    summary: `${title}. National Archives Identifier ${naId}.`,
    ...(onPre1931Path && copyrightDate ? { dateOrPeriod: copyrightDate } : {}),
    contentType: contentTypeFor(record),
    provenanceNotes: [
      `National Archives Catalog discovery for query "${query}".`,
      `NAID: ${naId}.`,
      `Use restriction: ${useStatus || "none"}.`,
      `Copyright date: ${copyrightDate || "none"}.`,
      `Production date: ${productionDate || "none"}.`,
      onPre1931Path
        ? "The copyright date is before 1931-01-01 and the record states a use restriction, so the date is kept. No public-domain conclusion is recorded from catalog presence."
        : "Undated or rights-unknown records stay off the pre-1931 path.",
      NARA_ATTRIBUTION,
    ].join(" "),
    sourceRecordId: naId,
    sourceCitation: `National Archives Catalog, NAID ${naId}`,
    rightsStatus: "unknown",
    rightsEvidence: {
      evidence_type: "other",
      evidence_text: evidenceText,
      evidence_url: pageUrl,
    },
  };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof NaraCatalogHttpError) return error.status === 429 || error.status >= 500;
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

export async function fetchNaraCatalogHits(
  query: string,
  limit: number,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  env: Record<string, string | undefined> = process.env,
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Record<string, unknown>[]> {
  const apiKey = requireNaraCatalogApiKey(env);
  const url = buildNaraCatalogSearchUrl(query, limit);
  const data = await withRetry(async () => {
    const response = await fetchImpl(url, {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
        "User-Agent": "LGFC-Gehrig-Content-Discovery/1.0 (lougehrigfanclub.com; contact via site)",
      },
    });
    if (!response.ok) throw new NaraCatalogHttpError(response.status);
    return (await response.json()) as { body?: { hits?: { hits?: Record<string, unknown>[] } } };
  }, delay);
  return data.body?.hits?.hits ?? [];
}
