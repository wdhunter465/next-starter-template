// Smithsonian Open Access adapter for #4848.
//
// Opt-in only. The scheduled discovery workflow does not list this source.
// No request is sent unless SMITHSONIAN_API_KEY is set. That is the api.data.gov
// key Product Authority provisions. The key is sent as the api_key query
// parameter, which is what the Open Access API requires. It is never written
// into a candidate, a log line, or the repository.
//
// The Smithsonian pages cited by #4790 do not publish a separate numeric cap.
// HTTP 429 and 5xx retry up to 3 times. Any other status fails immediately.
//
// A candidate is kept only when a media object itself is marked CC0. Metadata
// with no media, and media that is not CC0, are dropped. The CC0 mark is
// recorded as evidence. It is not a trademark, privacy, or publicity clearance,
// and this module records no further rights conclusion. A museum date is a lead
// in the notes, not a first-publication date.

export const SMITHSONIAN_SEARCH_URL = "https://api.si.edu/openaccess/api/v1.0/search";
export const SMITHSONIAN_API_KEY_ENV = "SMITHSONIAN_API_KEY";
export const SMITHSONIAN_SOURCE_DOMAIN = "si.edu";

export class SmithsonianApiKeyMissingError extends Error {
  constructor() {
    super(`${SMITHSONIAN_API_KEY_ENV} is required before a Smithsonian request. No request was sent.`);
    this.name = "SmithsonianApiKeyMissingError";
  }
}

export class SmithsonianHttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`Smithsonian search -> HTTP ${status}`);
    this.name = "SmithsonianHttpError";
    this.status = status;
  }
}

export type SmithsonianCandidateFields = {
  title: string;
  sourceType: "museum";
  sourceName: "Smithsonian Open Access";
  sourceOwner: "Smithsonian Institution";
  sourceDomain: typeof SMITHSONIAN_SOURCE_DOMAIN;
  sourceUrl: string;
  originalFileUrl: string;
  summary: string;
  contentType: "photo";
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

type MediaItem = { content?: unknown; type?: unknown; usage?: { access?: unknown } };

export function requireSmithsonianApiKey(env: Record<string, string | undefined> = process.env): string {
  const apiKey = (env[SMITHSONIAN_API_KEY_ENV] ?? "").trim();
  if (!apiKey) throw new SmithsonianApiKeyMissingError();
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

function cc0Media(row: Record<string, unknown>): { url: string } | null {
  const content = (row.content ?? {}) as {
    descriptiveNonRepeating?: { online_media?: { media?: MediaItem[] } };
  };
  const media = content.descriptiveNonRepeating?.online_media?.media;
  if (!Array.isArray(media)) return null;
  const hit = media.find((item) => firstScalar(item?.usage?.access).toUpperCase() === "CC0" && /^https?:\/\//i.test(firstScalar(item?.content)));
  return hit ? { url: firstScalar(hit.content) } : null;
}

export function buildSmithsonianSearchUrl(query: string, limit: number): string {
  const rows = Math.min(Math.max(1, Math.floor(limit)), 20);
  const params = new URLSearchParams({ q: query, rows: String(rows), start: "0" });
  return `${SMITHSONIAN_SEARCH_URL}?${params.toString()}`;
}

export function mapSmithsonianRowToCandidateFields(row: Record<string, unknown>, query: string): SmithsonianCandidateFields | null {
  const media = cc0Media(row);
  if (!media) return null;
  const content = (row.content ?? {}) as {
    descriptiveNonRepeating?: { title?: { content?: unknown }; record_link?: unknown };
    indexedStructured?: { date?: unknown };
  };
  const recordId = firstScalar(row.id);
  if (!recordId) return null;
  const title = firstScalar(content.descriptiveNonRepeating?.title?.content) || firstScalar(row.title) || recordId;
  const recordLink = firstScalar(content.descriptiveNonRepeating?.record_link);
  const pageUrl = /^https?:\/\//i.test(recordLink) ? recordLink : `https://www.si.edu/object/${encodeURIComponent(recordId)}`;
  const museumDate = firstScalar(content.indexedStructured?.date);

  return {
    title,
    sourceType: "museum",
    sourceName: "Smithsonian Open Access",
    sourceOwner: "Smithsonian Institution",
    sourceDomain: SMITHSONIAN_SOURCE_DOMAIN,
    sourceUrl: pageUrl,
    originalFileUrl: media.url,
    summary: `${title}. Smithsonian media marked CC0.`,
    contentType: "photo",
    provenanceNotes: [
      `Smithsonian Open Access discovery for query "${query}".`,
      `Record: ${recordId}.`,
      "Media usage.access: CC0.",
      `Museum date: ${museumDate || "none"}. A museum date is not a first-publication date.`,
      "CC0 does not clear trademark, privacy, or publicity rights. No further rights conclusion is recorded.",
    ].join(" "),
    sourceRecordId: recordId,
    sourceCitation: `Smithsonian Open Access, ${recordId}`,
    rightsStatus: "unknown",
    rightsEvidence: {
      evidence_type: "other",
      evidence_text: "Smithsonian media usage.access is CC0. CC0 does not clear trademark, privacy, or publicity rights.",
      evidence_url: media.url,
    },
  };
}

function isRetryable(error: unknown): boolean {
  if (error instanceof SmithsonianHttpError) return error.status === 429 || error.status >= 500;
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

export async function fetchSmithsonianRows(
  query: string,
  limit: number,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  env: Record<string, string | undefined> = process.env,
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Record<string, unknown>[]> {
  const apiKey = requireSmithsonianApiKey(env);
  const url = new URL(buildSmithsonianSearchUrl(query, limit));
  url.searchParams.set("api_key", apiKey);
  const data = await withRetry(async () => {
    const response = await fetchImpl(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "LGFC-Gehrig-Content-Discovery/1.0 (lougehrigfanclub.com; contact via site)",
      },
    });
    if (!response.ok) throw new SmithsonianHttpError(response.status);
    return (await response.json()) as { response?: { rows?: Record<string, unknown>[] } };
  }, delay);
  return Array.isArray(data.response?.rows) ? data.response.rows : [];
}
