// Chronicling America page discovery for #4788.
//
// Opt-in only. The scheduled Gehrig discovery workflow does not list this
// source. The API host is https://chroniclingamerica.loc.gov. Candidates use
// source_domain loc.gov because that row is already on the approved source
// list. This module does not add a source row and does not change the workflow.
//
// One search request per call. Send a descriptive User-Agent. HTTP 429 and
// 5xx retry up to 3 times with backoff, the same contract as the Internet
// Archive adapter. Any other HTTP status fails immediately. Do not run two
// Chronicling America calls at once.
//
// Metadata only. No page image and no full OCR file is stored. A newspaper
// issue date before 1931-01-01 is a sourced first-publication date, so the
// candidate records the public-domain conclusion. A later date, or no date,
// stays on the ordinary rights path.

export const CHRONICLING_AMERICA_SEARCH_URL = "https://chroniclingamerica.loc.gov/search/pages/results/";
export const CHRONICLING_AMERICA_SOURCE_DOMAIN = "loc.gov";
export const PRE_1931_EXCLUSIVE_END = "1931-01-01";

export type ChroniclingAmericaCandidateFields = {
  title: string;
  sourceType: "library";
  sourceName: "Library of Congress, Chronicling America";
  sourceOwner: string;
  sourceDomain: typeof CHRONICLING_AMERICA_SOURCE_DOMAIN;
  sourceUrl: string;
  summary: string;
  dateOrPeriod?: string;
  contentType: "article";
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
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

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

export function ocrExcerpt(value: unknown, needle = "gehrig"): string {
  const text = firstScalar(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const at = text.toLowerCase().indexOf(needle);
  const start = at < 0 ? 0 : Math.max(0, at - 80);
  const slice = text.slice(start, start + 240).trim();
  return slice.length < text.length ? `${slice}…` : slice;
}

export function buildChroniclingAmericaSearchUrl(query: string, limit: number, page = 1, dateStart = "1920", dateEnd = "1930"): string {
  const rows = Math.min(Math.max(1, Math.floor(limit)), 20);
  const params = new URLSearchParams({
    andtext: query,
    dateFilterType: "yearRange",
    date1: dateStart,
    date2: dateEnd,
    format: "json",
    rows: String(rows),
    page: String(Math.max(1, Math.floor(page))),
  });
  return `${CHRONICLING_AMERICA_SEARCH_URL}?${params.toString()}`;
}

export function mapChroniclingAmericaItemToCandidateFields(
  item: Record<string, unknown>,
  query: string,
): ChroniclingAmericaCandidateFields | null {
  const pageUrl = firstScalar(item.id) || firstScalar(item.url);
  if (!/^https?:\/\//i.test(pageUrl)) return null;
  const date = issueDate(item.date);
  const newspaper = firstScalar(item.title) || "Untitled newspaper";
  const page = firstScalar(item.sequence);
  const edition = firstScalar(item.edition);
  const excerpt = ocrExcerpt(item.ocr_eng);
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
    contentType: "article",
    provenanceNotes: [
      `Chronicling America discovery for query "${query}".`,
      `Newspaper: ${newspaper}.`,
      `Issue date: ${date || "none"}. The date source is this newspaper issue record.`,
      `Page: ${page || "none"}. Edition: ${edition || "none"}.`,
      `Page URL: ${pageUrl}.`,
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
    return (await response.json()) as { items?: Record<string, unknown>[] };
  }, delay);
  return Array.isArray(data.items) ? data.items : [];
}
