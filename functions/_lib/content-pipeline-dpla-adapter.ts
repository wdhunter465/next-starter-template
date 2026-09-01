// DPLA (Digital Public Library of America) discovery adapter for
// scripts/content-pipeline/collect-gehrig-external-sources.mjs (#3551 Tier 2
// aggregator source; #3826 closes the code-absent gap left after migration
// 0055 already seeded `dp.la` into `sources` and reserved the
// `dpla_rights_statement` rights_evidence.evidence_type).
//
// Kept as a separate, pure, importable module (rather than inline in the
// .mjs script like the Openverse/LOC/Wikimedia collectors) specifically so
// the DPLA response-to-candidate mapping is unit-testable -- the script
// itself calls `main()` unconditionally at import time, which makes its
// existing inline collectors impractical to import from a test file without
// changing their behavior.
//
// DPLA is an aggregator: rights and media must be verified at the
// contributing institution's own record, not DPLA's, per #3551's DPLA
// evidence requirements ("Treat DPLA as an aggregator..."). This module
// never produces a rights conclusion -- only leads and captured metadata.
//
// NOT verified against DPLA's live API in the environment that wrote this
// file: DPLA v2 requires a registered `api_key`, none is configured here,
// and this sandbox's network egress already blocks the other three source
// domains (see the .mjs script's header). The response shape below follows
// DPLA's published API v2 documentation (https://pro.dp.la/developers/api-basics)
// as closely as possible from static reference. Verify against a real
// response on first live run and adjust if it differs.

export const DPLA_API_BASE = "https://api.dp.la/v2/items";
export const DPLA_API_KEY_ENV_VAR = "DPLA_API_KEY";

export class DplaApiKeyMissingError extends Error {
  constructor() {
    super(
      `${DPLA_API_KEY_ENV_VAR} environment variable is required to query the DPLA API (register at https://pro.dp.la/developers/policies#registration) -- refusing to silently skip the source.`,
    );
    this.name = "DplaApiKeyMissingError";
  }
}

export function requireDplaApiKey(env: Record<string, string | undefined> = process.env): string {
  const apiKey = env[DPLA_API_KEY_ENV_VAR];
  if (!apiKey) {
    throw new DplaApiKeyMissingError();
  }
  return apiKey;
}

export function buildDplaSearchUrl(query: string, limit: number, apiKey: string): string {
  const params = new URLSearchParams({
    q: query,
    page_size: String(limit),
    api_key: apiKey,
  });
  return `${DPLA_API_BASE}?${params.toString()}`;
}

// DPLA's sourceResource fields are inconsistently single value vs. array
// across providers -- normalize to the first non-empty scalar, matching the
// existing collectors' firstScalar() convention.
function firstScalar(value: unknown): string {
  if (Array.isArray(value)) {
    const hit = value.find((item) => item != null && String(item).trim() !== "");
    return hit == null ? "" : String(hit);
  }
  if (value == null) return "";
  return String(value);
}

function orUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export type DplaSourceResource = {
  title?: string | string[];
  description?: string | string[];
  creator?: string | string[];
  date?: { displayDate?: string; begin?: string; end?: string } | string | string[];
  rights?: string | string[];
  collection?: { title?: string } | { title?: string }[];
};

export type DplaDoc = {
  id?: string;
  sourceResource?: DplaSourceResource;
  dataProvider?: string;
  provider?: { name?: string };
  // Documented as a single string, but DPLA providers are inconsistent in
  // practice (see the array-typed-fields test) -- widened defensively like
  // the other sourceResource fields below.
  isShownAt?: string | string[];
  rightsCategory?: string;
};

export type DplaCandidateFields = {
  title: string;
  sourceType: "institution";
  sourceName: "DPLA";
  sourceOwner: string | undefined;
  sourceDomain: "dp.la";
  sourceUrl: string | undefined;
  summary: string;
  dateOrPeriod: string | undefined;
  creditLine: string | undefined;
  provenanceNotes: string;
  sourceRecordId: string | undefined;
  sourceCitation: string;
};

function dplaDisplayDate(date: DplaSourceResource["date"]): string {
  if (date == null) return "";
  if (typeof date === "string") return date;
  if (Array.isArray(date)) return firstScalar(date);
  return date.displayDate ?? date.begin ?? "";
}

function dplaCollectionTitle(collection: DplaSourceResource["collection"]): string {
  if (collection == null) return "";
  if (Array.isArray(collection)) return collection[0]?.title ?? "";
  return collection.title ?? "";
}

/**
 * Pure mapping from one DPLA `docs[]` entry to the candidate fields
 * `baseCandidate()` (in the .mjs script) expects. Never sets a rights
 * conclusion -- `rightsCategory` (DPLA's own classification, e.g. "Public
 * Domain"/"Unknown"/"In Copyright") is captured verbatim as evidence in
 * provenance_notes only, exactly like the other three collectors treat
 * their sources' license/rights fields as leads, not clearances.
 */
export function mapDplaDocToCandidateFields(doc: DplaDoc, query: string): DplaCandidateFields {
  const sourceResource = doc.sourceResource ?? {};
  const title = firstScalar(sourceResource.title) || "Untitled DPLA item";
  const description = firstScalar(sourceResource.description);
  const creator = firstScalar(sourceResource.creator) || "unknown";
  const dplaRights = firstScalar(sourceResource.rights) || "none provided";
  const rightsCategory = doc.rightsCategory || "unknown";
  const contributingInstitution = doc.dataProvider || "unknown";
  const providerName = doc.provider?.name || "unknown";
  const collectionTitle = dplaCollectionTitle(sourceResource.collection);
  const isShownAt = orUndefined(firstScalar(doc.isShownAt));
  const dplaItemId = orUndefined(firstScalar(doc.id));
  const dateOrPeriod = orUndefined(dplaDisplayDate(sourceResource.date));

  const provenanceNotes = [
    `DPLA discovery for query "${query}".`,
    `DPLA item ID: ${dplaItemId ?? "unknown"}.`,
    `Contributing institution: ${contributingInstitution}.`,
    `Provider (hub): ${providerName}.`,
    `Collection: ${collectionTitle || "unknown"}.`,
    `Creator: ${creator}.`,
    `DPLA rights statement/URI: ${dplaRights}.`,
    `DPLA rightsCategory: ${rightsCategory}.`,
    `Original item URL (isShownAt): ${isShownAt ?? "none"}.`,
    "DPLA is a pure aggregator -- rights and downloadable media must be verified at the contributing institution's own original record, not at DPLA's, before any rights conclusion.",
  ].join(" ");

  return {
    title,
    sourceType: "institution",
    sourceName: "DPLA",
    sourceOwner: orUndefined(contributingInstitution === "unknown" ? "" : contributingInstitution),
    sourceDomain: "dp.la",
    sourceUrl: isShownAt,
    summary: description
      ? `${description} (DPLA-aggregated description, contributing institution: ${contributingInstitution} -- not independently verified.)`
      : `Discovered via DPLA search for "${query}". Contributing institution: ${contributingInstitution}. Rights must be verified at the contributing institution's own record.`,
    dateOrPeriod,
    creditLine: undefined, // DPLA does not supply a ready-made credit line; a reviewer assembles one from contributingInstitution/creator during rights review.
    provenanceNotes,
    sourceRecordId: dplaItemId,
    sourceCitation: `DPLA (contributing institution: ${contributingInstitution}), item ${dplaItemId ?? "unknown"}`,
  };
}
