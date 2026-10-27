// Europeana Search API adapter for the 1931 and 1934 Gehrig tours (#4847).
//
// Opt-in only. The scheduled discovery workflow does not list this source.
// No request is sent unless EUROPEANA_PROJECT_API_KEY is set. That variable is
// the project key. A personal key is non-production and is not read here.
// Product Authority accepts the Europeana API terms and provisions the key.
// The key is the X-Api-Key header. It is never written into a URL or the repository.
//
// The search is limited to YEAR 1931 or 1934. This is not a general Gehrig harvest.
// Only a Public Domain Mark or CC0 statement in edm:rights is kept. Every other
// rights value, including a missing one, is excluded. A kept statement follows
// the existing structured-license rule and may record public_domain_confirmed.
// A year by itself is not a first-publication date.

export const EUROPEANA_SEARCH_URL = "https://api.europeana.eu/record/v2/search.json";
export const EUROPEANA_PROJECT_API_KEY_ENV = "EUROPEANA_PROJECT_API_KEY";
export const EUROPEANA_SOURCE_DOMAIN = "europeana.eu";
const OPEN_RIGHTS = [
  "http://creativecommons.org/publicdomain/mark/1.0/",
  "https://creativecommons.org/publicdomain/mark/1.0/",
  "http://creativecommons.org/publicdomain/zero/1.0/",
  "https://creativecommons.org/publicdomain/zero/1.0/",
];

export class EuropeanaApiKeyMissingError extends Error {
  constructor() {
    super(`${EUROPEANA_PROJECT_API_KEY_ENV} is required before a Europeana request. No request was sent.`);
    this.name = "EuropeanaApiKeyMissingError";
  }
}

export class EuropeanaHttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`Europeana search -> HTTP ${status}`);
    this.name = "EuropeanaHttpError";
    this.status = status;
  }
}

export type EuropeanaCandidateFields = {
  title: string;
  sourceType: "archive";
  sourceName: "Europeana";
  sourceOwner?: string;
  sourceDomain: typeof EUROPEANA_SOURCE_DOMAIN;
  sourceUrl: string;
  summary: string;
  dateOrPeriod?: string;
  contentType: "photo" | "article";
  provenanceNotes: string;
  sourceRecordId: string;
  sourceCitation: string;
  rightsStatus: "public_domain_candidate";
  rightsEvidence: {
    evidence_type: "other";
    evidence_text: string;
    evidence_url: string;
    conclusion: "public_domain_confirmed";
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

export function requireEuropeanaProjectApiKey(env: Record<string, string | undefined> = process.env): string {
  const apiKey = (env[EUROPEANA_PROJECT_API_KEY_ENV] ?? "").trim();
  if (!apiKey) throw new EuropeanaApiKeyMissingError();
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

export function openRightsStatement(value: unknown): string | null {
  const text = firstScalar(value).replace(/\/+$/, "/");
  const normalized = text.endsWith("/") ? text : `${text}/`;
  return OPEN_RIGHTS.find((allowed) => allowed.toLowerCase() === normalized.toLowerCase()) ?? null;
}

function issuedDate(item: Record<string, unknown>): string | null {
  const text = firstScalar(item.dctermsIssued ?? item.issued);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function buildEuropeanaSearchUrl(query: string, limit: number): string {
  const rows = Math.min(Math.max(1, Math.floor(limit)), 20);
  const params = new URLSearchParams({
    query,
    qf: "YEAR:1931 OR YEAR:1934",
    rows: String(rows),
    profile: "rich",
  });
  return `${EUROPEANA_SEARCH_URL}?${params.toString()}`;
}

export function mapEuropeanaItemToCandidateFields(item: Record<string, unknown>, query: string): EuropeanaCandidateFields | null {
  const rights = openRightsStatement(item.rights ?? item["edm:rights"]);
  if (!rights) return null;
  const recordId = firstScalar(item.id);
  if (!recordId) return null;
  const title = firstScalar(item.title) || recordId;
  const provider = firstScalar(item.dataProvider);
  const shownAt = firstScalar(item.edmIsShownAt);
  const pageUrl = /^https?:\/\//i.test(shownAt) ? shownAt : `https://www.europeana.eu/item${recordId.startsWith("/") ? recordId : `/${recordId}`}`;
  const issued = issuedDate(item);
  const typeText = firstScalar(item.type).toLowerCase();

  return {
    title,
    sourceType: "archive",
    sourceName: "Europeana",
    sourceOwner: provider || undefined,
    sourceDomain: EUROPEANA_SOURCE_DOMAIN,
    sourceUrl: pageUrl,
    summary: `${title}. Europeana record for the 1931 or 1934 tour window.`,
    ...(issued ? { dateOrPeriod: issued } : {}),
    contentType: typeText.includes("image") ? "photo" : "article",
    provenanceNotes: [
      `Europeana discovery for query "${query}", limited to 1931 and 1934.`,
      `edm:rights: ${rights}.`,
      `Issued date: ${issued || "none"}. A year alone is not a first-publication date.`,
      `Provider: ${provider || "none"}.`,
      "The public-domain conclusion records the source rights statement, not the pre-1931 date rule.",
    ].join(" "),
    sourceRecordId: recordId,
    sourceCitation: `Europeana, ${recordId}`,
    rightsStatus: "public_domain_candidate",
    rightsEvidence: {
      evidence_type: "other",
      evidence_text: `edm:rights: ${rights}.`,
      evidence_url: rights,
      conclusion: "public_domain_confirmed",
    },
  };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof EuropeanaHttpError) return error.status === 429 || error.status >= 500;
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

export async function fetchEuropeanaItems(
  query: string,
  limit: number,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  env: Record<string, string | undefined> = process.env,
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Record<string, unknown>[]> {
  const apiKey = requireEuropeanaProjectApiKey(env);
  const url = buildEuropeanaSearchUrl(query, limit);
  const data = await withRetry(async () => {
    const response = await fetchImpl(url, {
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
        "User-Agent": "LGFC-Gehrig-Content-Discovery/1.0 (lougehrigfanclub.com; contact via site)",
      },
    });
    if (!response.ok) throw new EuropeanaHttpError(response.status);
    return (await response.json()) as { items?: Record<string, unknown>[] };
  }, delay);
  return Array.isArray(data.items) ? data.items : [];
}
