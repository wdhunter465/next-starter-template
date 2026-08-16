#!/usr/bin/env node
/**
 * Collect Lou Gehrig content candidates from the #3551-approved discovery
 * sources (Openverse, Library of Congress, Wikimedia Commons) and write a
 * CandidateRegistry JSON file matching functions/_lib/content-pipeline-candidate-import.ts,
 * ready for the existing scripts/content-pipeline/import-seed-candidates.mjs pipeline.
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
 * Usage:
 *   node --experimental-strip-types scripts/content-pipeline/collect-gehrig-external-sources.mjs \
 *     [--query "Lou Gehrig"] [--sources openverse,loc,wikimedia] [--limit 20] \
 *     [--out data/research/lou-gehrig-content-candidates-external-discovery.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const DEFAULT_QUERY = 'Lou Gehrig';
const DEFAULT_SOURCES = ['openverse', 'loc', 'wikimedia'];
const DEFAULT_LIMIT = 20;
const DEFAULT_OUT = 'data/research/lou-gehrig-content-candidates-external-discovery.json';
const SEED_FILE = 'data/research/lou-gehrig-content-candidates.json';

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
      options.query = argv[i + 1];
      i += 1;
    } else if (arg === '--sources') {
      options.sources = argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--limit') {
      options.limit = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--out') {
      options.out = argv[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node --experimental-strip-types scripts/content-pipeline/collect-gehrig-external-sources.mjs [--query "Lou Gehrig"] [--sources openverse,loc,wikimedia] [--limit 20] [--out <file>]',
      );
      process.exit(0);
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

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LGFC-Gehrig-Content-Discovery/1.0 (lougehrigfanclub.com; contact via site)',
      Accept: 'application/json',
      ...headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status}`);
  }
  return response.json();
}

function baseCandidate({ id, title, sourceType, sourceName, sourceOwner, sourceDomain, sourceUrl, summary, dateOrPeriod, sourceMetadata, topicTags = [] }) {
  return {
    candidate_id: id,
    input_stream: 'scheduled_discovery',
    title,
    source_url: sourceUrl,
    source_name: sourceName,
    source_owner: sourceOwner,
    source_domain: sourceDomain,
    source_type: sourceType,
    content_type: 'photo',
    summary,
    date_or_period: dateOrPeriod ?? null,
    people_tags: ['Lou Gehrig'],
    topic_tags: ['baseball', ...topicTags],
    location_tags: [],
    provenance_notes: 'Produced by scripts/content-pipeline/collect-gehrig-external-sources.mjs (#3552/#3554). Not reviewed. Do not publish without full rights-evidence review.',
    rights_status: 'unknown',
    source_trust_status: 'trusted', // pre-vetted per #3551's approved allowlist; does NOT imply this item's rights are cleared
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: 'none',
    privacy_review_status: 'not_applicable',
    review_priority: 'normal',
    admin_notes: 'Automated discovery candidate. Rights conclusion, relevance, and publication decisions require human review per #3551 core safety rule.',
    source_metadata: sourceMetadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function collectOpenverse(query, limit, nextId) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit}`;
  const data = await fetchJson(url);
  const results = data.results ?? [];
  return results.map((item) =>
    baseCandidate({
      id: nextId(),
      title: item.title || `Openverse image ${item.id}`,
      sourceType: 'other',
      sourceName: 'Openverse',
      sourceOwner: item.source ?? item.provider ?? null,
      sourceDomain: 'openverse.org',
      sourceUrl: item.foreign_landing_url ?? item.url ?? null,
      summary: `Discovered via Openverse search for "${query}". Provider: ${item.provider ?? 'unknown'}. Treat license metadata as a lead — verify against the originating collection before any rights conclusion (Openverse's own terms disclaim verification of individual-work licensing).`,
      sourceMetadata: {
        openverse_id: item.id ?? null,
        provider: item.provider ?? null,
        original_item_url: item.url ?? null,
        foreign_landing_url: item.foreign_landing_url ?? null,
        creator: item.creator ?? null,
        license: item.license ?? null,
        license_version: item.license_version ?? null,
        license_url: item.license_url ?? null,
        retrieved_at: new Date().toISOString(),
      },
    }),
  );
}

async function collectLibraryOfCongress(query, limit, nextId) {
  const url = `https://www.loc.gov/search/?q=${encodeURIComponent(query)}&fo=json&c=${limit}`;
  const data = await fetchJson(url);
  const results = data.results ?? [];
  return results.map((item) =>
    baseCandidate({
      id: nextId(),
      title: item.title || 'Untitled Library of Congress item',
      sourceType: 'library',
      sourceName: 'Library of Congress',
      sourceOwner: 'Library of Congress',
      sourceDomain: 'loc.gov',
      sourceUrl: item.url ?? item.id ?? null,
      summary: `Discovered via loc.gov search for "${query}". A rights/advisory statement here (if present) is LOC's own research note, not a legal clearance -- LOC generally does not own copyright in donated/acquired collection material.`,
      dateOrPeriod: Array.isArray(item.date) ? item.date[0] : item.date ?? null,
      sourceMetadata: {
        loc_control_number: item.number_lccn ?? item.id ?? null,
        collection: item.partof ?? null,
        creator: item.contributor ?? null,
        rights_advisory: item.rights_advisory ?? item.rights ?? null,
        source_page: item.url ?? null,
        download_url: item.resources?.[0]?.url ?? null,
        retrieved_at: new Date().toISOString(),
      },
    }),
  );
}

async function collectWikimediaCommons(query, limit, nextId) {
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
    return baseCandidate({
      id: nextId(),
      title: page.title || 'Untitled Commons file',
      sourceType: 'archive',
      sourceName: 'Wikimedia Commons',
      sourceOwner: null,
      sourceDomain: 'commons.wikimedia.org',
      sourceUrl: info.descriptionurl ?? null,
      summary: `Discovered via Wikimedia Commons search for "${query}". License template is an uploader assertion, not a verified fact -- mislabeled licenses are a known, recurring problem on Commons. Verify before any rights conclusion.`,
      sourceMetadata: {
        file_page_url: info.descriptionurl ?? null,
        original_source: meta.Credit?.value ?? null,
        uploader: info.user ?? null,
        asserted_creator: meta.Artist?.value ?? null,
        license_template: meta.LicenseShortName?.value ?? null,
        license_url: meta.LicenseUrl?.value ?? null,
        attribution_text: meta.Attribution?.value ?? null,
        revision_permalink: info.url ?? null,
        retrieved_at: new Date().toISOString(),
      },
    });
  });
}

const COLLECTORS = {
  openverse: collectOpenverse,
  loc: collectLibraryOfCongress,
  wikimedia: collectWikimediaCommons,
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const nextId = makeCandidateIdFactory();
  const allCandidates = [];
  const errors = [];

  for (const source of options.sources) {
    const collector = COLLECTORS[source];
    if (!collector) {
      errors.push(`Unknown source: ${source} (expected one of ${Object.keys(COLLECTORS).join(', ')})`);
      continue;
    }
    try {
      const candidates = await collector(options.query, options.limit, nextId);
      console.log(`${source}: collected ${candidates.length} candidate(s)`);
      allCandidates.push(...candidates);
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
      console.error(`${source} failed: ${error.message}`);
    }
  }

  const registry = {
    schema_version: '1',
    registry_class: 'operator_export',
    description: `Automated discovery export from Openverse/LOC/Wikimedia Commons for query "${options.query}". Every candidate is unreviewed (rights_status=unknown, review_status=pending_review, publication_status=not_ready). Not approved for publication.`,
    registry_purpose: 'external_discovery_pending_review',
    content_evidence_level: 'unverified_discovery_lead',
    updated_at: new Date().toISOString(),
    candidates: allCandidates,
  };

  const outPath = path.isAbsolute(options.out) ? options.out : path.join(repoRoot, options.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');

  console.log(`\nWrote ${allCandidates.length} candidate(s) to ${path.relative(repoRoot, outPath)}`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s) occurred:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  }
  console.log('\nNext step: validate and import via');
  console.log(`  node --experimental-strip-types scripts/content-pipeline/import-seed-candidates.mjs --file ${options.out} --database lgfc-litedev --local --dry-run`);
  console.log('(review the dry-run output, then drop --dry-run once satisfied — Development only, per #3552/#3554)');
}

main();
