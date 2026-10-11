#!/usr/bin/env node
/**
 * Collect Lou Gehrig STORY (text) content candidates from free, credential-free
 * sources (Wikipedia, Wikisource, Internet Archive) and write a CandidateRegistry
 * JSON file in the same format as collect-gehrig-external-sources.mjs. This is
 * the parallel track to the image collector (#4532).
 *
 * Collection records the origin URL and the origin's own license statement for
 * everything found. It decides nothing about relevance or admission to the B2
 * and D1 libraries; the content evaluation process does. Rights are classified
 * only from the source's own structured license (see
 * functions/_lib/content-pipeline-story-adapter.ts). Ambiguous results are
 * treated as not permitted and the reason is written to admin_notes so a person
 * can review why. Every candidate stays pending_review / not_ready.
 *
 * A URL already present in any registry under data/research is skipped (same
 * URL, no new record). Metadata only: no text is stored beyond a short summary.
 *
 * Usage:
 *   node --experimental-strip-types scripts/content-pipeline/collect-gehrig-story-sources.mjs \
 *     [--query "Lou Gehrig"] [--sources wikipedia,wikisource,internetarchive] [--limit 10] \
 *     [--out data/research/lou-gehrig-story-candidates-discovery.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { withBoundedRetry } from '../../functions/_lib/bounded-retry.ts';
import { determineSearchRunTerminalStatus } from '../../functions/_lib/content-search-run-outcome.ts';
import { extractPeopleTags, extractDateOrPeriod } from '../../functions/_lib/content-pipeline-discovery-text-signals.ts';
import {
  STORY_SOURCES,
  STORY_SOURCE_DOMAINS,
  buildInternetArchiveSearchUrl,
  buildWikiPageInfoUrl,
  buildWikiSearchUrl,
  cleanOriginUrl,
  mapInternetArchiveDocToCandidateFields,
  mapWikiPageToCandidateFields,
} from '../../functions/_lib/content-pipeline-story-adapter.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const DEFAULT_QUERY = 'Lou Gehrig';
const DEFAULT_LIMIT = 10;
const DEFAULT_OUT = 'data/research/lou-gehrig-story-candidates-discovery.json';
const RESEARCH_DIR = 'data/research';
// Starts above the image collector's floor so IDs from the two tracks do not collide.
const ID_FLOOR = 800;
const USER_AGENT = 'LGFC-Gehrig-Story-Discovery/1.0 (https://www.lougehrigfanclub.com; admin@lougehrigfanclub.com)';

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/content-pipeline/collect-gehrig-story-sources.mjs [--query "Lou Gehrig"] [--sources wikipedia,wikisource,internetarchive] [--limit 10] [--out <file>]',
  );
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flagName}`);
  return value;
}

function parseArgs(argv) {
  const options = { query: DEFAULT_QUERY, sources: [...STORY_SOURCES], limit: DEFAULT_LIMIT, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--query') {
      options.query = readFlagValue(argv, i, '--query');
      i += 1;
    } else if (arg === '--sources') {
      const sources = [...new Set(readFlagValue(argv, i, '--sources').split(',').map((s) => s.trim()).filter(Boolean))];
      i += 1;
      const unknown = sources.filter((s) => !STORY_SOURCES.includes(s));
      if (sources.length === 0) throw new Error('--sources must list at least one source');
      if (unknown.length > 0) throw new Error(`Unknown source(s): ${unknown.join(', ')} (expected one or more of ${STORY_SOURCES.join(', ')})`);
      options.sources = sources;
    } else if (arg === '--limit') {
      const raw = readFlagValue(argv, i, '--limit');
      i += 1;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) throw new Error(`--limit must be an integer from 1 to 50, got: ${raw}`);
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

class HttpStatusError extends Error {
  constructor(url, status) {
    super(`${url} -> HTTP ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
  }
}

async function fetchJson(url) {
  return withBoundedRetry(
    async () => {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (!response.ok) throw new HttpStatusError(url, response.status);
      return response.json();
    },
    {
      // Wikimedia asks clients to back off on 429, so wait longer than the image collector.
      maxAttempts: 4,
      baseDelayMs: 2000,
      isRetryable: (error) => (error instanceof HttpStatusError ? error.status === 429 || error.status >= 500 : true),
    },
  );
}

/** Origin URLs already recorded in any registry file: same URL, no new record. */
function loadKnownUrls() {
  const known = new Set();
  const dir = path.join(repoRoot, RESEARCH_DIR);
  if (!fs.existsSync(dir)) return known;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      for (const candidate of data.candidates ?? []) {
        const url = cleanOriginUrl(candidate.source_url);
        if (url) known.add(url);
      }
    } catch {
      // Not a candidate registry (for example a search-runs or notes file).
    }
  }
  return known;
}

function nextCandidateSequence() {
  let maxSeq = ID_FLOOR;
  const dir = path.join(repoRoot, RESEARCH_DIR);
  if (!fs.existsSync(dir)) return maxSeq;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      for (const candidate of data.candidates ?? []) {
        const match = /^lgfc-gehrig-\d{4}-(\d+)$/.exec(candidate.candidate_id ?? '');
        if (match) maxSeq = Math.max(maxSeq, Number(match[1]));
      }
    } catch {
      // ignore non-registry files
    }
  }
  return maxSeq;
}

function makeCandidateIdFactory() {
  let seq = nextCandidateSequence();
  const year = new Date().getUTCFullYear();
  return () => {
    seq += 1;
    return `lgfc-gehrig-${year}-${String(seq).padStart(3, '0')}`;
  };
}

function toCandidate(id, fields) {
  const peopleSource = `${fields.title} ${fields.summary}`;
  const ambiguity = fields.classification.ambiguity;
  const notes = ['Automated story discovery candidate. Not permitted until the evaluation process or a person sets permitted; relevance and admission are decided there.'];
  if (ambiguity.length > 0) {
    notes.push(`AMBIGUOUS (treated as not permitted): ${ambiguity.join(' ')}`);
  }
  if (fields.classification.shareAlike) {
    notes.push('Share-alike license: adapted text must carry the same license.');
  }
  const candidate = {
    candidate_id: id,
    input_stream: 'scheduled_discovery',
    title: fields.title,
    source_name: fields.sourceName,
    source_type: fields.sourceType,
    content_type: 'article',
    summary: fields.summary,
    people_tags: extractPeopleTags(peopleSource).length > 0 ? extractPeopleTags(peopleSource) : ['Lou Gehrig'],
    topic_tags: ['baseball', 'story'],
    location_tags: [],
    rights_status: fields.rightsStatus,
    source_trust_status: 'trusted',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    admin_notes: notes.join(' '),
    provenance_notes: fields.provenanceNotes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (fields.sourceUrl) candidate.source_url = fields.sourceUrl;
  if (fields.sourceOwner) candidate.source_owner = fields.sourceOwner;
  if (fields.sourceDomain) candidate.source_domain = fields.sourceDomain;
  const dateOrPeriod = fields.dateOrPeriod || extractDateOrPeriod(peopleSource);
  if (dateOrPeriod) candidate.date_or_period = dateOrPeriod;
  if (fields.creditLine) candidate.credit_line = fields.creditLine;
  if (fields.rightsEvidence) {
    const evidence = { ...fields.rightsEvidence };
    for (const key of Object.keys(evidence)) if (evidence[key] === undefined) delete evidence[key];
    candidate.rights_evidence = evidence;
  }
  candidate.source_metadata = {
    source_record_id: String(fields.sourceRecordId),
    date_accessed: new Date().toISOString().slice(0, 10),
    source_citation: fields.sourceCitation,
  };
  return candidate;
}

async function collectWiki(source, query, limit) {
  const search = await fetchJson(buildWikiSearchUrl(source, query, limit));
  const titles = (search.query?.search ?? []).map((hit) => hit.title);
  const fieldsList = [];
  for (let i = 0; i < titles.length; i += 20) {
    const info = await fetchJson(buildWikiPageInfoUrl(source, titles.slice(i, i + 20)));
    const rights = info.query?.rightsinfo ?? {};
    for (const page of Object.values(info.query?.pages ?? {})) {
      if (page.missing !== undefined) continue;
      fieldsList.push(mapWikiPageToCandidateFields(source, page, rights, query));
    }
  }
  return fieldsList;
}

async function collectInternetArchive(query, limit) {
  const data = await fetchJson(buildInternetArchiveSearchUrl(query, limit));
  return (data.response?.docs ?? []).map((doc) => mapInternetArchiveDocToCandidateFields(doc, query));
}

async function collectSource(source, query, limit) {
  if (source === 'internetarchive') return collectInternetArchive(query, limit);
  return collectWiki(source, query, limit);
}

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

  const knownUrls = loadKnownUrls();
  const nextId = makeCandidateIdFactory();
  const candidates = [];
  const errors = [];
  const searchRuns = [];
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let ambiguousCount = 0;

  for (const source of options.sources) {
    let found = [];
    let collectionError = null;
    try {
      found = await collectSource(source, options.query, options.limit);
    } catch (error) {
      collectionError = error;
      errors.push(`${source}: ${errorMessage(error)}`);
      console.error(`${source} failed: ${errorMessage(error)}`);
    }

    let duplicateCount = 0;
    let newCount = 0;
    for (const fields of found) {
      if (fields.sourceUrl && knownUrls.has(fields.sourceUrl)) {
        duplicateCount += 1;
        continue;
      }
      if (fields.sourceUrl) knownUrls.add(fields.sourceUrl);
      if (fields.classification.ambiguity.length > 0) ambiguousCount += 1;
      candidates.push(toCandidate(nextId(), fields));
      newCount += 1;
    }
    console.log(`${source}: ${found.length} found, ${newCount} new, ${duplicateCount} already recorded`);

    searchRuns.push({
      run_uid: `run-${source}-${runTimestamp}`,
      source_domain: STORY_SOURCE_DOMAINS[source],
      query: options.query,
      result_limit: options.limit,
      status: determineSearchRunTerminalStatus({ resultCount: found.length, requestedLimit: options.limit, error: collectionError }),
      discovered_count: found.length,
      new_count: newCount,
      duplicate_count: duplicateCount,
      error_count: collectionError ? 1 : 0,
      error_summary: collectionError ? errorMessage(collectionError) : null,
    });
  }

  const registry = {
    schema_version: '1',
    registry_class: 'operator_export',
    description: `Automated story discovery export (Wikipedia, Wikisource, Internet Archive) for query "${options.query}". Every candidate is unreviewed (review_status=pending_review, publication_status=not_ready). Ambiguous rights are treated as not permitted. Not approved for publication.`,
    registry_purpose: 'operator_export',
    content_evidence_level: 'mixed',
    updated_at: new Date().toISOString(),
    candidates,
  };

  const outPath = path.isAbsolute(options.out) ? options.out : path.join(repoRoot, options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  const runsOutPath = outPath.replace(/\.json$/, '') + '.search-runs.json';
  fs.writeFileSync(runsOutPath, JSON.stringify({ search_runs: searchRuns }, null, 2) + '\n', 'utf8');

  console.log(`\nWrote ${candidates.length} candidate(s) to ${outPath}`);
  console.log(`Wrote ${searchRuns.length} search-run record(s) to ${runsOutPath}`);
  console.log(`${ambiguousCount} candidate(s) are ambiguous (treated as not permitted); see admin_notes for the reason.`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const message of errors) console.error(`  - ${message}`);
    process.exitCode = 1;
  }
}

await main();
