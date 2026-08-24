#!/usr/bin/env node
/**
 * Collect Lou Gehrig content candidates from the #3551-approved discovery
 * sources (Openverse, Library of Congress, Wikimedia Commons) and write a
 * CandidateRegistry JSON file matching functions/_lib/content-pipeline-candidate-import.ts
 * AND data/research/lou-gehrig-content-candidates.schema.json (the two must
 * agree; the schema file is stricter in places -- e.g. source_metadata is
 * additionalProperties:false with exactly {source_record_id, date_accessed,
 * source_citation}, optional string fields must be omitted rather than
 * null, and tag arrays require uniqueItems).
 *
 * NOT RUN AGAINST LIVE APIS in the session that wrote this file — this
 * environment's network egress policy blocks api.openverse.org, www.loc.gov,
 * and commons.wikimedia.org outright (confirmed via both curl and WebFetch).
 * Verify each source's actual response shape against the mapping functions
 * below on first real run and adjust if it differs from what's coded here.
 *
 * U.S. Copyright Office is intentionally excluded from this adapter — #3552
 * treats it as verification-only, human-run research, not an automated
 * discovery source.
 *
 * Metadata only. Never downloads or stores media bytes. Every candidate is
 * written with rights_status defaulting to 'unknown', review_status
 * 'pending_review', and publication_status 'not_ready' — this script never
 * decides a rights conclusion, per #3551's core safety rule.
 *
 * Bounded retry with exponential backoff (functions/_lib/bounded-retry.ts)
 * is now in effect on every source fetch: a transient failure (network
 * error, HTTP 429, or HTTP 5xx) is retried up to 3 attempts before a search
 * run is classified source_error/rate_limited, per #3551's "source failed
 * after bounded retries" contract. Other 4xx responses fail fast without
 * retrying, since retrying a malformed request cannot succeed.
 *
 * Usage:
 *   node --experimental-strip-types scripts/content-pipeline/collect-gehrig-external-sources.mjs \
 *     [--query "Lou Gehrig"] [--sources openverse,loc,wikimedia] [--limit 20] \
 *     [--out data/research/lou-gehrig-content-candidates-external-discovery.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { determineSearchRunTerminalStatus } from '../../functions/_lib/content-search-run-outcome.ts';
import { extractPeopleTags, extractDateOrPeriod } from '../../functions/_lib/content-pipeline-discovery-text-signals.ts';
import { withBoundedRetry } from '../../functions/_lib/bounded-retry.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

// Matches the #3551 six-source allowlist rows seeded by migration 0055.
const SOURCE_DOMAINS = {
  openverse: 'openverse.org',
  loc: 'loc.gov',
  wikimedia: 'commons.wikimedia.org',
};

const DEFAULT_QUERY = 'Lou Gehrig';
const DEFAULT_SOURCES = ['openverse', 'loc', 'wikimedia'];
const DEFAULT_LIMIT = 20;
const DEFAULT_OUT = 'data/research/lou-gehrig-content-candidates-external-discovery.json';
const SEED_FILE = 'data/research/lou-gehrig-content-candidates.json';
const KNOWN_SOURCES = ['openverse', 'loc', 'wikimedia'];

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/content-pipeline/collect-gehrig-external-sources.mjs [--query "Lou Gehrig"] [--sources openverse,loc,wikimedia] [--limit 20] [--out <file>]',
  );
}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(argv) {
  const options = {
    query: DEFAULT_QUERY,
    sources: DEFAULT_SOURCES,
    limit: DEFAULT_LIMIT,
    out: DEFAULT_OUT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--query') {
      options.query = readFlagValue(argv, i, '--query');
      i += 1;
    } else if (arg === '--sources') {
      const raw = readFlagValue(argv, i, '--sources');
      i += 1;
      const sources = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
      const unknown = sources.filter((s) => !KNOWN_SOURCES.includes(s));
      if (sources.length === 0) {
        throw new Error('--sources must list at least one source');
      }
      if (unknown.length > 0) {
        throw new Error(`Unknown source(s): ${unknown.join(', ')} (expected one or more of ${KNOWN_SOURCES.join(', ')})`);
      }
      options.sources = sources;
    } else if (arg === '--limit') {
      const raw = readFlagValue(argv, i, '--limit');
      i += 1;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`--limit must be a positive integer, got: ${raw}`);
      }
      options.limit = parsed;
    } else if (arg === '--out') {
      options.out = readFlagValue(argv, i, '--out');
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

/** Reads the existing seed file (if present) to find the next free candidate_id sequence number, so this script never collides with fixture data. */
function nextCandidateSequence() {
  const seedPath = path.join(repoRoot, SEED_FILE);
  let maxSeq = 0;
  if (fs.existsSync(seedPath)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      for (const candidate of seed.candidates ?? []) {
        const match = /^lgfc-gehrig-\d{4}-(\d+)$/.exec(candidate.candidate_id ?? '');
        if (match) {
          maxSeq = Math.max(maxSeq, Number(match[1]));
        }
      }
    } catch {
      // Seed file unreadable/malformed — start from a high floor to avoid collision risk.
      maxSeq = 500;
    }
  }
  return Math.max(maxSeq, 500); // floor well above known fixture IDs (001-0xx)
}

function makeCandidateIdFactory() {
  let seq = nextCandidateSequence();
  const year = new Date().getUTCFullYear();
  return () => {
    seq += 1;
    return `lgfc-gehrig-${year}-${String(seq).padStart(3, '0')}`;
  };
}

// Carries the raw HTTP status so isRetryable below can classify it without
// parsing the error message string.
class HttpStatusError extends Error {
  constructor(url, status) {
    super(`${url} -> HTTP ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

async function fetchJson(url, headers = {}) {
  return withBoundedRetry(
    async () => {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LGFC-Gehrig-Content-Discovery/1.0 (lougehrigfanclub.com; contact via site)',
          Accept: 'application/json',
          ...headers,
        },
      });
      if (!response.ok) {
        throw new HttpStatusError(url, response.status);
      }
      return response.json();
    },
    {
      isRetryable: (error) => {
        if (error instanceof HttpStatusError) {
          // 429 (rate limited) and 5xx (server-side) are transient --
          // worth retrying. Other 4xx responses (bad request, not found,
          // etc.) mean the request itself is wrong and retrying cannot help.
          return error.status === 429 || error.status >= 500;
        }
        // A thrown fetch (network/DNS/TLS failure) is always transient.
        return true;
      },
    },
  );
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10); // schema requires format:"date" (YYYY-MM-DD), not date-time
}

function firstScalar(value) {
  if (Array.isArray(value)) {
    const hit = value.find((item) => item != null && String(item).trim() !== '');
    return hit == null ? '' : String(hit);
  }
  if (value == null) return '';
  return String(value);
}

function absoluteHttpUrl(url) {
  const raw = firstScalar(url).trim();
  if (!raw) return undefined;
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
}

/**
 * Builds a schema-valid candidate. Optional string fields (source_url,
 * source_owner, source_domain, date_or_period, credit_line) are omitted
 * entirely when absent -- the schema types them as plain "string" with no
 * null option, so writing null fails validation. source_metadata is
 * constrained to exactly {source_record_id, date_accessed, source_citation};
 * anything richer (license text, uploader, rights advisory, etc.) goes into
 * provenance_notes instead, which is unrestricted free text.
 *
 * peopleTags/creditLine/dateOrPeriod may be derived from best-effort text
 * matching (see extractPeopleTags/extractDateOrPeriod below) -- these are
 * metadata-quality signals for a human reviewer, never a rights or identity
 * determination. A wrong or missing tag here is a data-quality issue to
 * correct in review, not a safety issue.
 */
function baseCandidate({
  id,
  title,
  sourceType,
  sourceName,
  sourceOwner,
  sourceDomain,
  sourceUrl,
  summary,
  dateOrPeriod,
  creditLine,
  peopleTags,
  provenanceNotes,
  sourceRecordId,
  sourceCitation,
  topicTags = [],
}) {
  const candidate = {
    candidate_id: id,
    input_stream: 'scheduled_discovery',
    title,
    source_name: sourceName,
    source_type: sourceType,
    content_type: 'photo',
    summary,
    people_tags: peopleTags && peopleTags.length > 0 ? [...new Set(peopleTags)] : ['Lou Gehrig'],
    topic_tags: [...new Set(['baseball', ...topicTags])],
    location_tags: [],
    rights_status: 'unknown',
    source_trust_status: 'trusted', // pre-vetted per #3551's approved allowlist; does NOT imply this item's rights are cleared
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    admin_notes: 'Automated discovery candidate. Rights conclusion, relevance, and publication decisions require human review per #3551 core safety rule.',
    provenance_notes: provenanceNotes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (sourceUrl) candidate.source_url = sourceUrl;
  if (sourceOwner) candidate.source_owner = sourceOwner;
  if (sourceDomain) candidate.source_domain = sourceDomain;
  if (dateOrPeriod) candidate.date_or_period = dateOrPeriod;
  if (creditLine) candidate.credit_line = creditLine;

  const sourceMetadata = {};
  if (sourceRecordId) sourceMetadata.source_record_id = String(sourceRecordId);
  sourceMetadata.date_accessed = todayDateOnly();
  if (sourceCitation) sourceMetadata.source_citation = sourceCitation;
  candidate.source_metadata = sourceMetadata;

  return candidate;
}

async function collectOpenverse(query, limit, nextId) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit}`;
  const data = await fetchJson(url);
  const results = data.results ?? [];
  return results.map((item) => {
    const provenanceNotes = [
      `Openverse discovery for query "${query}".`,
      `Provider: ${item.provider ?? 'unknown'}.`,
      `Creator: ${item.creator ?? 'unknown'}.`,
      `License: ${item.license ?? 'unknown'}${item.license_version ? ` ${item.license_version}` : ''}.`,
      `License URL: ${item.license_url ?? 'none'}.`,
      `Original item URL: ${item.url ?? 'none'}.`,
      `Foreign landing URL: ${item.foreign_landing_url ?? 'none'}.`,
      'Openverse’s own terms disclaim verification of individual-work licensing -- treat as a lead only, verify against the originating collection before any rights conclusion.',
    ].join(' ');

    return baseCandidate({
      id: nextId(),
      title: item.title || `Openverse image ${item.id}`,
      sourceType: 'other',
      sourceName: 'Openverse',
      sourceOwner: item.source || item.provider || undefined,
      sourceDomain: 'openverse.org',
      sourceUrl: item.foreign_landing_url || item.url || undefined,
      summary: `Discovered via Openverse search for "${query}". Provider: ${item.provider ?? 'unknown'}. Treat license metadata as a lead — verify against the originating collection before any rights conclusion.`,
      provenanceNotes,
      sourceRecordId: item.id,
      sourceCitation: `Openverse (provider: ${item.provider ?? 'unknown'}), item ${item.id ?? 'unknown'}`,
    });
  });
}

async function collectLibraryOfCongress(query, limit, nextId) {
  const url = `https://www.loc.gov/search/?q=${encodeURIComponent(query)}&fo=json&c=${limit}`;
  const data = await fetchJson(url);
  const results = data.results ?? [];
  return results.map((item) => {
    const nestedItem = item.item && typeof item.item === 'object' ? item.item : {};
    const controlNumber = firstScalar(item.number_lccn) || firstScalar(item.id) || null;
    const rightsAdvisory =
      firstScalar(item.rights_advisory) ||
      firstScalar(item.rights) ||
      firstScalar(nestedItem.rights_advisory) ||
      firstScalar(nestedItem.rights) ||
      null;
    const downloadUrl =
      absoluteHttpUrl(item.resources?.[0]?.url) ||
      absoluteHttpUrl(Array.isArray(item.image_url) ? item.image_url[0] : item.image_url) ||
      null;

    const provenanceNotes = [
      `Library of Congress discovery for query "${query}".`,
      `Control number/ID: ${controlNumber ?? 'unknown'}.`,
      `Collection: ${item.partof ?? 'unknown'}.`,
      `Creator/contributor: ${item.contributor ?? 'unknown'}.`,
      `Rights advisory: ${rightsAdvisory ?? 'none provided'}.`,
      `Source page: ${absoluteHttpUrl(item.url) ?? 'none'}.`,
      `Download URL: ${downloadUrl ?? 'none'}.`,
      'A rights/advisory statement here is LOC’s own research note, not a legal clearance -- LOC generally does not own copyright in donated/acquired collection material.',
    ].join(' ');

    return baseCandidate({
      id: nextId(),
      title: item.title || 'Untitled Library of Congress item',
      sourceType: 'library',
      sourceName: 'Library of Congress',
      sourceOwner: 'Library of Congress',
      sourceDomain: 'loc.gov',
      sourceUrl: absoluteHttpUrl(item.url),
      summary: `Discovered via loc.gov search for "${query}". A rights/advisory statement here (if present) is LOC's own research note, not a legal clearance.`,
      dateOrPeriod: Array.isArray(item.date) ? item.date[0] : item.date || undefined,
      provenanceNotes,
      sourceRecordId: controlNumber,
      sourceCitation: `Library of Congress, control/ID ${controlNumber ?? 'unknown'}`,
    });
  });
}

function stripHtml(value) {
  if (!value) return null;
  const text = String(value).replace(/<[^>]+>/g, '').trim();
  return text || null;
}

async function collectWikimediaCommons(query, limit, nextId, licenseNotesOut = []) {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=${limit}&format=json&origin=*`;
  const searchData = await fetchJson(searchUrl);
  const pages = searchData.query?.search ?? [];
  if (pages.length === 0) return [];

  const titles = pages.map((p) => p.title).join('|');
  const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|user|extmetadata&format=json&origin=*`;
  const infoData = await fetchJson(infoUrl);
  const infoPages = Object.values(infoData.query?.pages ?? {});

  return infoPages.map((page) => {
    const info = page.imageinfo?.[0] ?? {};
    const meta = info.extmetadata ?? {};
    const licenseTemplate = meta.LicenseShortName?.value ?? null;
    const titleText = page.title || 'Untitled Commons file';
    const imageDescription = stripHtml(meta.ImageDescription?.value ?? null);
    const creditLine = stripHtml(meta.Credit?.value ?? null) || stripHtml(meta.Attribution?.value ?? null) || undefined;
    const dateOrPeriod =
      stripHtml(meta.DateTimeOriginal?.value ?? null) || extractDateOrPeriod(`${titleText} ${imageDescription ?? ''}`);
    const peopleTags = extractPeopleTags(`${titleText} ${imageDescription ?? ''}`);

    const provenanceNotes = [
      `Wikimedia Commons discovery for query "${query}".`,
      `File page: ${info.descriptionurl ?? 'none'}.`,
      `Uploader: ${info.user ?? 'unknown'}.`,
      `Asserted creator: ${meta.Artist?.value ?? 'unknown'}.`,
      `License template: ${licenseTemplate ?? 'none'}.`,
      `License URL: ${meta.LicenseUrl?.value ?? 'none'}.`,
      `Attribution text: ${meta.Attribution?.value ?? 'none'}.`,
      `File URL: ${info.url ?? 'none'}.`,
      'License template is an uploader assertion, not a verified fact -- mislabeled licenses are a known, recurring problem on Commons. Verify before any rights conclusion.',
    ].join(' ');

    const id = nextId();

    licenseNotesOut.push({
      candidate_id: id,
      title: titleText,
      source_url: info.descriptionurl ?? null,
      license_short_name: licenseTemplate,
      license_url: meta.LicenseUrl?.value ?? null,
      usage_terms: stripHtml(meta.UsageTerms?.value ?? null),
      attribution: stripHtml(meta.Attribution?.value ?? null),
      artist: stripHtml(meta.Artist?.value ?? null),
      credit: stripHtml(meta.Credit?.value ?? null),
      restrictions: meta.Restrictions?.value ?? null,
    });

    return baseCandidate({
      id,
      title: titleText,
      sourceType: 'archive',
      sourceName: 'Wikimedia Commons',
      sourceDomain: 'commons.wikimedia.org',
      sourceUrl: info.descriptionurl || undefined,
      summary: imageDescription
        ? `${imageDescription} (Wikimedia Commons caption, uploader-provided -- not independently verified.)`
        : `Discovered via Wikimedia Commons search for "${query}". License template is an uploader assertion, not a verified fact.`,
      dateOrPeriod,
      creditLine,
      peopleTags,
      provenanceNotes,
      sourceRecordId: page.pageid ?? page.title,
      sourceCitation: `Wikimedia Commons, ${titleText}`,
    });
  });
}

const COLLECTORS = {
  openverse: collectOpenverse,
  loc: collectLibraryOfCongress,
  wikimedia: collectWikimediaCommons,
};

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(errorMessage(error));
    printUsage();
    process.exitCode = 1;
    return;
  }

  const nextId = makeCandidateIdFactory();
  const allCandidates = [];
  const errors = [];
  const searchRuns = [];
  const licenseNotes = [];
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

  for (const source of options.sources) {
    const collector = COLLECTORS[source];
    const runUid = `run-${source}-${runTimestamp}`;
    let resultCount = 0;
    let collectionError = null;
    try {
      const candidates = await collector(options.query, options.limit, nextId, licenseNotes);
      resultCount = candidates.length;
      console.log(`${source}: collected ${candidates.length} candidate(s)`);
      allCandidates.push(...candidates);
    } catch (error) {
      collectionError = error;
      const message = errorMessage(error);
      errors.push(`${source}: ${message}`);
      console.error(`${source} failed: ${message}`);
    }

    const status = determineSearchRunTerminalStatus({
      resultCount,
      requestedLimit: options.limit,
      error: collectionError,
    });

    searchRuns.push({
      run_uid: runUid,
      source_domain: SOURCE_DOMAINS[source],
      query: options.query,
      result_limit: options.limit,
      status,
      discovered_count: resultCount,
      new_count: resultCount,
      error_count: collectionError ? 1 : 0,
      error_summary: collectionError ? errorMessage(collectionError) : null,
    });
  }

  const registry = {
    schema_version: '1',
    registry_class: 'operator_export',
    description: `Automated discovery export from Openverse/LOC/Wikimedia Commons for query "${options.query}". Every candidate is unreviewed (rights_status=unknown, review_status=pending_review, publication_status=not_ready). Not approved for publication.`,
    registry_purpose: 'operator_export',
    content_evidence_level: 'mixed', // real (non-synthetic) discovery leads, not yet operator-verified -- schema's enum has no exact "pending review" value
    updated_at: new Date().toISOString(),
    candidates: allCandidates,
  };

  const outPath = path.isAbsolute(options.out) ? options.out : path.join(repoRoot, options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');

  const runsOutPath = outPath.replace(/\.json$/, '') + '.search-runs.json';
  fs.writeFileSync(runsOutPath, JSON.stringify({ search_runs: searchRuns }, null, 2) + '\n', 'utf8');

  console.log(`\nWrote ${allCandidates.length} candidate(s) to ${path.relative(repoRoot, outPath)}`);
  console.log(`Wrote ${searchRuns.length} search-run record(s) to ${path.relative(repoRoot, runsOutPath)}`);

  if (licenseNotes.length > 0) {
    const licenseNotesOutPath = outPath.replace(/\.json$/, '') + '.license-notes.json';
    fs.writeFileSync(licenseNotesOutPath, JSON.stringify({ license_notes: licenseNotes }, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${licenseNotes.length} Wikimedia Commons license note(s) to ${path.relative(repoRoot, licenseNotesOutPath)}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s) occurred:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  }
  console.log('\nNext steps:');
  console.log('1. Record each search run (POST start, then POST complete with the same run_uid) against');
  console.log('   /api/admin/content-pipeline/search-runs and /api/admin/content-pipeline/search-runs/complete');
  console.log(`   using the entries in ${path.relative(repoRoot, runsOutPath)} -- this is #3551's audit trail for the`);
  console.log('   attempt regardless of whether any candidates end up imported.');
  console.log('2. Validate and import discovered candidates via');
  console.log(`   node --experimental-strip-types scripts/content-pipeline/import-seed-candidates.mjs --file ${options.out} --database lgfc-litedev --local --dry-run`);
  console.log('   (review the dry-run output, then drop --dry-run once satisfied — Development only, per #3552/#3554)');
}

main();
