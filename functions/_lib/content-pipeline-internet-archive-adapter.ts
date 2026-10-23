// Internet Archive discovery adapter for #4789.
//
// Opt-in only. The scheduled Gehrig discovery workflow passes an explicit
// --sources list and does not include this source. archive.org is registered
// in sources by migrations/0088_internet_archive_source_4789.sql.
//
// Metadata only. This module never downloads media and never records a rights
// conclusion. The search `date` field is a date lead. publicdate is the
// archive upload time and is ignored. A date is kept on the pre-1931 path
// only when it is a year, or a year-month-day, from 1900 through 1930.

import { withBoundedRetry } from "./bounded-retry.ts";

export const INTERNET_ARCHIVE_SEARCH_URL = "https://archive.org/advancedsearch.php";
export const INTERNET_ARCHIVE_SOURCE_DOMAIN = "archive.org";
export const PRE_1931_DATE_START = "1900-01-01";
export const PRE_1931_DATE_END = "1930-12-31";

const SEARCH_FIELDS = [
  "identifier",
  "title",
  "date",
  "publisher",
  "rights",
  "licenseurl",
  "mediatype",
  "collection",
] as const;

const CONTENT_TYPE_BY_MEDIATYPE = {
  image: "photo",
  texts: "article",
  movies: "video",
} as const;

export class InternetArchiveHttpError extends Error {
  status: number;

  constructor(url: string, status: number) {
    super(`${url} -> HTTP ${status}`);
    this.name = "InternetArchiveHttpError";
    this.status = status;
  }
}

export type InternetArchiveContentType = (typeof CONTENT_TYPE_BY_MEDIATYPE)[keyof typeof CONTENT_TYPE_BY_MEDIATYPE];

export type InternetArchiveCandidateFields = {
  title: string;
  sourceType: "archive";
  sourceName: "Internet Archive";
  sourceOwner?: string;
  sourceDomain: typeof INTERNET_ARCHIVE_SOURCE_DOMAIN;
  sourceUrl: string;
  summary: string;
  dateOrPeriod: string;
  contentType: InternetArchiveContentType;
  provenanceNotes: string;
  sourceRecordId: string;
  sourceCitation: string;
  rightsStatus: "unknown";
  rightsEvidence: {
    evidence_type: "other";
    evidence_text: string;
    evidence_url?: string;
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

function firstScalar(value: unknown): string {
  if (Array.isArray(value)) {
    const hit = value.find((item) => item != null && String(item).trim() !== "");
    return hit == null ? "" : String(hit).trim();
  }
  if (value == null) return "";
  return String(value).trim();
}

function joinedScalars(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item == null ? "" : String(item).trim()))
      .filter(Boolean)
      .join(", ");
  }
  return firstScalar(value);
}

// A clean year or calendar date in 1900–1930. "circa 1927", a later reprint
// year, and an empty date stay off the pre-1931 path.
export function pre1931DateLead(value: unknown): string | null {
  const text = firstScalar(value);
  const match = /^(\d{4})(?:-\d{2}-\d{2})?(?:T.*)?$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1900 || year > 1930) return null;
  return text;
}

export function buildInternetArchiveSearchUrl(query: string, limit: number): string {
  const rows = Math.min(Math.max(1, Math.floor(limit)), 100);
  const q = `(${query}) AND date:[${PRE_1931_DATE_START} TO ${PRE_1931_DATE_END}] AND mediatype:(texts OR image OR movies)`;
  const params = new URLSearchParams({
    q,
    rows: String(rows),
    page: "1",
    output: "json",
  });
  for (const field of SEARCH_FIELDS) {
    params.append("fl[]", field);
  }
  return `${INTERNET_ARCHIVE_SEARCH_URL}?${params.toString()}`;
}

export function mapInternetArchiveDocToCandidateFields(
  doc: Record<string, unknown>,
  query: string,
): InternetArchiveCandidateFields | null {
  const mediatype = firstScalar(doc.mediatype);
  const contentType = CONTENT_TYPE_BY_MEDIATYPE[mediatype as keyof typeof CONTENT_TYPE_BY_MEDIATYPE];
  if (!contentType) return null;
  const dateOrPeriod = pre1931DateLead(doc.date);
  if (!dateOrPeriod) return null;
  const identifier = firstScalar(doc.identifier);
  if (!identifier) return null;

  const title = firstScalar(doc.title) || identifier;
  const publisher = firstScalar(doc.publisher);
  const rights = firstScalar(doc.rights);
  const licenseurl = firstScalar(doc.licenseurl);
  const collection = joinedScalars(doc.collection);
  const evidence: InternetArchiveCandidateFields["rightsEvidence"] = {
    evidence_type: "other",
    evidence_text: `Internet Archive rights: ${rights || "none"}. licenseurl: ${licenseurl || "none"}.`,
  };
  if (/^https?:\/\//i.test(licenseurl)) {
    evidence.evidence_url = licenseurl;
  }

  return {
    title,
    sourceType: "archive",
    sourceName: "Internet Archive",
    sourceOwner: publisher || undefined,
    sourceDomain: INTERNET_ARCHIVE_SOURCE_DOMAIN,
    sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    summary: `${title}. Internet Archive ${mediatype} item ${identifier}.`,
    dateOrPeriod,
    contentType,
    provenanceNotes: [
      `Internet Archive discovery for query "${query}".`,
      `mediatype: ${mediatype}.`,
      `date lead: ${dateOrPeriod}. The search date field is not recorded as a first-publication date.`,
      `publisher: ${publisher || "none"}.`,
      `rights: ${rights || "none"}.`,
      `licenseurl: ${licenseurl || "none"}.`,
      `collection: ${collection || "none"}.`,
      "publicdate is ignored. It is the archive upload time, not publication.",
    ].join(" "),
    sourceRecordId: identifier,
    sourceCitation: `Internet Archive, ${identifier}`,
    rightsStatus: "unknown",
    rightsEvidence: evidence,
  };
}

export async function fetchInternetArchiveDocs(
  query: string,
  limit: number,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<Record<string, unknown>[]> {
  const url = buildInternetArchiveSearchUrl(query, limit);
  const data = await withBoundedRetry(
    async () => {
      const response = await fetchImpl(url, {
        headers: {
          "User-Agent": "LGFC-Gehrig-Content-Discovery/1.0 (lougehrigfanclub.com; contact via site)",
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        throw new InternetArchiveHttpError(url, response.status);
      }
      return (await response.json()) as { response?: { docs?: Record<string, unknown>[] } };
    },
    {
      baseDelayMs: 500,
      delay,
      isRetryable: (error) => {
        if (error instanceof InternetArchiveHttpError) {
          return error.status === 429 || error.status >= 500;
        }
        return true;
      },
    },
  );
  return data.response?.docs ?? [];
}
