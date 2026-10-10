// Story (text) discovery adapter for
// scripts/content-pipeline/collect-gehrig-story-sources.mjs (#4532).
//
// Parallel to the image collector: search records the origin URL and the
// origin's own license statement for everything it finds; it decides nothing
// about relevance or admission to B2/D1 (that is the evaluation process).
//
// Kept as a pure, importable module so the response-to-candidate mapping and
// the rights classification are unit-testable (the script calls main() on
// import), the same reason as content-pipeline-dpla-adapter.ts.
//
// Rights rules (Product Authority, 2026-10-10): only a source's own
// structured license statement classifies a story automatically. Anything
// restrictive, free text, absent, or date-only is AMBIGUOUS, which is treated
// as not permitted, and the reason is returned so a person can review why.

export const STORY_SOURCES = ["wikipedia", "wikisource", "internetarchive"] as const;
export type StorySource = (typeof STORY_SOURCES)[number];

export const STORY_SOURCE_DOMAINS: Record<StorySource, string> = {
  wikipedia: "en.wikipedia.org",
  wikisource: "en.wikisource.org",
  internetarchive: "archive.org",
};

export const STORY_SOURCE_NAMES: Record<StorySource, string> = {
  wikipedia: "Wikipedia",
  wikisource: "Wikisource",
  internetarchive: "Internet Archive",
};

export type StoryUsageBasis = "free_use" | "free_use_credit" | "not_permitted";

export type StoryRightsClassification = {
  rightsStatus: "unknown" | "public_domain_candidate" | "permission_granted";
  conclusion: "public_domain_confirmed" | "permission_granted" | undefined;
  usageBasis: StoryUsageBasis;
  shareAlike: boolean;
  /** Reasons the result is ambiguous (not permitted); empty when the source's license is unambiguous. */
  ambiguity: string[];
};

const PUBLIC_DOMAIN_URL = /creativecommons\.org\/(publicdomain\/(zero|mark)|licenses\/zero)\//i;
const PUBLIC_DOMAIN_NAME = /^(cc0|cc[\s-]?zero|public domain( mark)?|pdm)\b/i;
const CC_BY_URL = /creativecommons\.org\/licenses\/by(-sa)?\/(\d\.\d)/i;
const CC_BY_NAME = /^cc[\s-]?by(-sa)?([\s-]?\d\.\d)?$/i;
const CC_RESTRICTED = /\b(nc|nd)\b|-nc|-nd/i;

/**
 * Classifies a story from the origin's own license statement. Never decides
 * from a publication date alone: a date can be a digitisation date, so a
 * date-only public-domain claim is ambiguous and needs a person.
 */
export function classifyStoryRights(input: {
  licenseUrl?: string | null;
  licenseName?: string | null;
  publicationYear?: number | null;
}): StoryRightsClassification {
  const url = (input.licenseUrl ?? "").trim();
  const name = (input.licenseName ?? "").trim();

  if (url && /creativecommons\.org/i.test(url) && CC_RESTRICTED.test(url)) {
    return notPermitted(["License carries a non-commercial or no-derivatives restriction."]);
  }
  if (name && /^cc/i.test(name) && CC_RESTRICTED.test(name)) {
    return notPermitted(["License carries a non-commercial or no-derivatives restriction."]);
  }
  if (PUBLIC_DOMAIN_URL.test(url) || PUBLIC_DOMAIN_NAME.test(name)) {
    return {
      rightsStatus: "public_domain_candidate",
      conclusion: "public_domain_confirmed",
      usageBasis: "free_use",
      shareAlike: false,
      ambiguity: [],
    };
  }
  const byUrl = CC_BY_URL.exec(url);
  if (byUrl || CC_BY_NAME.test(name)) {
    const shareAlike = byUrl ? Boolean(byUrl[1]) : /-sa/i.test(name);
    return {
      rightsStatus: "permission_granted",
      conclusion: "permission_granted",
      usageBasis: "free_use_credit",
      shareAlike,
      ambiguity: [],
    };
  }

  const reasons: string[] = [];
  if (!url && !name) {
    reasons.push("The origin states no license.");
    if (input.publicationYear != null && input.publicationYear <= 1930) {
      reasons.push(
        `Publication year ${input.publicationYear} suggests public domain, but a date alone is not confirmation; a person must verify.`,
      );
    }
  } else {
    reasons.push(`License statement is not a recognized free-use license: ${[name, url].filter(Boolean).join(" ")}.`);
  }
  return notPermitted(reasons);
}

function notPermitted(ambiguity: string[]): StoryRightsClassification {
  return {
    rightsStatus: "unknown",
    conclusion: undefined,
    usageBasis: "not_permitted",
    shareAlike: false,
    ambiguity,
  };
}

/** LGFC default citation: "Title, by Creator, via Source (License)". A source-defined format overrides this at publication. */
export function buildDefaultCitation(parts: {
  title: string;
  creator?: string | null;
  source: string;
  license?: string | null;
}): string {
  const creator = parts.creator?.trim();
  const license = parts.license?.trim();
  return `${parts.title.trim()}${creator ? `, by ${creator}` : ""}, via ${parts.source}${license ? ` (${license})` : ""}`;
}

/** Cleans an origin URL for storage: https only, tracking parameters and fragment removed, still retrievable. Returns null for http or invalid URLs. */
export function cleanOriginUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.hash = "";
  const drop: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|ref$|ref_src$)/i.test(key)) drop.push(key);
  });
  for (const key of drop) url.searchParams.delete(key);
  return url.toString();
}

export function buildWikiSearchUrl(source: "wikipedia" | "wikisource", query: string, limit: number): string {
  const host = STORY_SOURCE_DOMAINS[source];
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  });
  return `https://${host}/w/api.php?${params.toString()}`;
}

export function buildWikiPageInfoUrl(source: "wikipedia" | "wikisource", titles: string[]): string {
  const host = STORY_SOURCE_DOMAINS[source];
  const params = new URLSearchParams({
    action: "query",
    titles: titles.join("|"),
    prop: "extracts|info",
    exintro: "1",
    explaintext: "1",
    exlimit: "max",
    inprop: "url",
    meta: "siteinfo",
    siprop: "rightsinfo",
    format: "json",
    origin: "*",
  });
  return `https://${host}/w/api.php?${params.toString()}`;
}

export function buildInternetArchiveSearchUrl(query: string, limit: number): string {
  const q = `"${query}" AND mediatype:texts`;
  const params = new URLSearchParams({ q, rows: String(limit), output: "json" });
  for (const field of ["identifier", "title", "creator", "date", "year", "licenseurl", "rights", "description"]) {
    params.append("fl[]", field);
  }
  return `https://archive.org/advancedsearch.php?${params.toString()}`;
}

type WikiPage = { pageid?: number; title?: string; extract?: string; fullurl?: string; touched?: string };
type RightsInfo = { text?: string; url?: string };

export type StoryCandidateFields = {
  title: string;
  sourceType: "archive" | "library" | "other";
  sourceName: string;
  sourceOwner: string | undefined;
  sourceDomain: string;
  sourceUrl: string | undefined;
  summary: string;
  dateOrPeriod: string | undefined;
  creditLine: string;
  provenanceNotes: string;
  sourceRecordId: string | number;
  sourceCitation: string;
  rightsStatus: StoryRightsClassification["rightsStatus"];
  rightsEvidence:
    | {
        evidence_type: "other";
        evidence_text: string;
        evidence_url: string | undefined;
        conclusion: StoryRightsClassification["conclusion"];
      }
    | undefined;
  classification: StoryRightsClassification;
};

function truncate(text: string | undefined, max: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Maps a Wikipedia or Wikisource page plus the site's rights info to candidate fields. */
export function mapWikiPageToCandidateFields(
  source: "wikipedia" | "wikisource",
  page: WikiPage,
  rights: RightsInfo,
  query: string,
): StoryCandidateFields {
  const sourceName = STORY_SOURCE_NAMES[source];
  const title = page.title?.trim() || "Untitled page";
  const sourceUrl = cleanOriginUrl(page.fullurl) ?? undefined;
  const siteClassification = classifyStoryRights({ licenseUrl: rights.url, licenseName: rights.text });
  // Wikisource's site license covers its contributors' transcription only. The
  // underlying work has its own copyright status, so a person must verify it:
  // ambiguous, so not permitted.
  const classification: StoryRightsClassification =
    source === "wikisource"
      ? notPermitted([
          "Wikisource's site license covers the transcription only; the underlying work has its own copyright status and a person must verify it.",
        ])
      : siteClassification;
  const licenseLabel = rights.text?.trim() || undefined;
  const creator = `${sourceName} contributors`;
  const citation = buildDefaultCitation({ title, creator, source: sourceName, license: licenseLabel });
  return {
    title,
    sourceType: "library",
    sourceName,
    sourceOwner: creator,
    sourceDomain: STORY_SOURCE_DOMAINS[source],
    sourceUrl,
    summary: truncate(page.extract, 500) || `Discovered via ${sourceName} search for "${query}".`,
    dateOrPeriod: undefined,
    creditLine: citation,
    provenanceNotes: [
      `${sourceName} story discovery for query "${query}".`,
      `Page: ${sourceUrl ?? "none"}.`,
      `Site license statement: ${licenseLabel ?? "none"} ${rights.url ?? ""}`.trim() + ".",
      classification.shareAlike ? "License is share-alike: adapted text must carry the same license." : "",
      "Page text is community-written; images on the page are separately licensed and are not covered.",
    ]
      .filter(Boolean)
      .join(" "),
    sourceRecordId: page.pageid ?? title,
    sourceCitation: citation,
    rightsStatus: classification.rightsStatus,
    rightsEvidence: licenseLabel
      ? {
          evidence_type: "other",
          evidence_text: `${sourceName} site license: ${licenseLabel}.`,
          evidence_url: rights.url,
          conclusion: classification.conclusion,
        }
      : undefined,
    classification,
  };
}

type IaDoc = {
  identifier?: string;
  title?: string | string[];
  creator?: string | string[];
  date?: string;
  year?: string | number;
  licenseurl?: string;
  rights?: string | string[];
  description?: string | string[];
};

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.find((v) => v && v.trim());
  return value?.trim() || undefined;
}

/** Maps an Internet Archive search document to candidate fields. */
export function mapInternetArchiveDocToCandidateFields(doc: IaDoc, query: string): StoryCandidateFields {
  const identifier = doc.identifier ?? "";
  const title = first(doc.title) ?? identifier ?? "Untitled item";
  const creator = first(doc.creator);
  const rightsText = first(doc.rights);
  const year = Number(String(doc.year ?? doc.date ?? "").slice(0, 4)) || null;
  const sourceUrl = identifier ? cleanOriginUrl(`https://archive.org/details/${encodeURIComponent(identifier)}`) ?? undefined : undefined;
  const classification = classifyStoryRights({ licenseUrl: doc.licenseurl, licenseName: null, publicationYear: year });
  const licenseLabel = doc.licenseurl?.trim() || rightsText;
  const citation = buildDefaultCitation({
    title,
    creator,
    source: "Internet Archive",
    license: classification.usageBasis === "not_permitted" ? null : licenseLabel,
  });
  return {
    title,
    sourceType: "library",
    sourceName: "Internet Archive",
    sourceOwner: creator,
    sourceDomain: STORY_SOURCE_DOMAINS.internetarchive,
    sourceUrl,
    summary: truncate(first(doc.description), 500) || `Discovered via Internet Archive search for "${query}".`,
    dateOrPeriod: doc.date?.slice(0, 10),
    creditLine: citation,
    provenanceNotes: [
      `Internet Archive story discovery for query "${query}".`,
      `Item: ${sourceUrl ?? "none"}.`,
      `License URL: ${doc.licenseurl ?? "none"}. Rights field: ${rightsText ?? "none"}.`,
      "The uploader's license and date fields are assertions, not verified facts.",
    ].join(" "),
    sourceRecordId: identifier || title,
    sourceCitation: citation,
    rightsStatus: classification.rightsStatus,
    rightsEvidence:
      doc.licenseurl || rightsText
        ? {
            evidence_type: "other",
            evidence_text: `Internet Archive item rights: ${[doc.licenseurl, rightsText].filter(Boolean).join(" | ")}. Uploader assertion, not a verified fact.`,
            evidence_url: doc.licenseurl,
            conclusion: classification.conclusion,
          }
        : undefined,
    classification,
  };
}
