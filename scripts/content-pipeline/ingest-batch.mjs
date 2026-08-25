#!/usr/bin/env node
/**
 * #3552: fetches each approved candidate's real file from its Commons
 * description page, resolves the actual direct file URL live via the
 * Wikimedia Commons API (the candidates fixture only stores the description
 * page URL, matching what a reviewer actually looked at -- resolving the
 * binary's real host is a mechanical step, not a new discovery/approval
 * decision), validates it, and writes it to B2 -- reusing the exact same
 * validated modules the #3567 HTTP ingestion endpoint uses
 * (validateIngestSourceUrl/ContentType/Size/MagicBytes, sha256Hex,
 * buildNewIntakeKey, putB2Object, commitIngestedMedia) via a
 * wrangler-d1-adapter.mjs shim so this CLI path can never drift from the
 * endpoint's own logic.
 *
 * Refuses to ingest any candidate without a recorded rights_evidence
 * conclusion, matching #3551's core safety rule -- this script never
 * records a conclusion itself (see record-batch-rights-approval.mjs).
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   B2_ENDPOINT=... B2_BUCKET=... B2_KEY_ID=... B2_APP_KEY=... \
 *   node --experimental-strip-types scripts/content-pipeline/ingest-batch.mjs \
 *     --candidates <registry.json> [--database lgfc_lite] [--local|--remote] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\\.(?:js|mjs|cjs|json|ts|tsx)$/i.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

const { makeWranglerD1 } = await import('../ci/wrangler-d1-adapter.mjs');
const { requireB2, putB2Object } = await import('../../functions/_lib/b2.ts');
const {
  INGEST_CONTENT_TYPE_EXTENSIONS,
  sha256Hex,
  validateIngestContentType,
  validateIngestMagicBytes,
  validateIngestSize,
  validateIngestSourceUrl,
} = await import('../../functions/_lib/b2-ingest-validation.ts');
const { buildReadableIntakeKey } = await import('../../functions/_lib/content-pipeline-media-key.ts');
const { getCandidateByCandidateId } = await import('../../functions/_lib/content-pipeline-candidate-repository.ts');
const { commitIngestedMedia } = await import('../../functions/_lib/media-ingest-repository.ts');
const { getCurrentConclusionForCandidate } = await import('../../functions/_lib/rights-evidence-repository.ts');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/content-pipeline/ingest-batch.mjs --candidates <registry.json> [--database lgfc_lite] [--local|--remote] [--dry-run]',
  );
}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = { candidates: null, database: 'lgfc_lite', target: 'local', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--candidates') {
      options.candidates = readFlagValue(argv, index, '--candidates');
      index += 1;
    } else if (arg === '--database') {
      options.database = readFlagValue(argv, index, '--database');
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.candidates) throw new Error('--candidates is required');
  return options;
}

function readJson(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'LGFC-Gehrig-Content-Ingest/1.0 (lougehrigfanclub.com; contact via site)',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

/** Resolves a Commons File: title to its direct, original-resolution file URL via the Commons API. */
async function resolveWikimediaFileUrl(title) {
  const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
  const data = await fetchJson(infoUrl);
  const pages = Object.values(data.query?.pages ?? {});
  const page = pages[0];
  const url = page?.imageinfo?.[0]?.url;
  if (!url) {
    throw new Error(`Could not resolve a direct file URL for Commons title "${title}"`);
  }
  return url;
}

async function loadApprovedSourceDomains(db) {
  const result = await db.prepare(`SELECT source_domain FROM sources WHERE source_trust_status = 'trusted'`).all();
  return new Set(
    (result.results ?? [])
      .map((row) => String(row.source_domain || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

async function ingestOne(db, candidate, approvedDomains, dryRun) {
  const candidateId = candidate.candidate_id;

  const stored = await getCandidateByCandidateId(db, candidateId);
  if (!stored) {
    throw new Error(`${candidateId}: not found in content_items -- run the import step first`);
  }

  const conclusion = await getCurrentConclusionForCandidate(db, stored.id);
  if (!conclusion) {
    throw new Error(`${candidateId}: no recorded rights_evidence conclusion -- refusing to ingest`);
  }

  const sourceFetchUrl = await resolveWikimediaFileUrl(candidate.title);

  const urlCheck = validateIngestSourceUrl(sourceFetchUrl, approvedDomains);
  if (!urlCheck.ok) {
    throw new Error(`${candidateId}: ${urlCheck.error}`);
  }

  const sourceResponse = await fetch(sourceFetchUrl, {
    headers: { 'User-Agent': 'LGFC-Gehrig-Content-Ingest/1.0 (lougehrigfanclub.com; contact via site)' },
  });
  if (!sourceResponse.ok) {
    throw new Error(`${candidateId}: source_fetch_url returned HTTP ${sourceResponse.status}`);
  }

  const finalUrlCheck = validateIngestSourceUrl(sourceResponse.url, approvedDomains);
  if (!finalUrlCheck.ok) {
    throw new Error(`${candidateId}: source_fetch_url redirected off the allowlist: ${finalUrlCheck.error}`);
  }

  const contentType = sourceResponse.headers.get('content-type');
  const contentTypeCheck = validateIngestContentType(contentType);
  if (!contentTypeCheck.ok) {
    throw new Error(`${candidateId}: ${contentTypeCheck.error}`);
  }
  const normalizedContentType = (contentType || '').split(';')[0].trim().toLowerCase();

  const bodyBuffer = await sourceResponse.arrayBuffer();
  const sizeCheck = validateIngestSize(bodyBuffer.byteLength);
  if (!sizeCheck.ok) {
    throw new Error(`${candidateId}: ${sizeCheck.error}`);
  }

  const bytes = new Uint8Array(bodyBuffer);
  const magicCheck = validateIngestMagicBytes(normalizedContentType, bytes);
  if (!magicCheck.ok) {
    throw new Error(`${candidateId}: ${magicCheck.error}`);
  }

  const checksum = await sha256Hex(bytes);
  const mediaUid = `sha256_${checksum.slice(0, 40)}`;
  const extension = INGEST_CONTENT_TYPE_EXTENSIONS[normalizedContentType] ?? 'bin';
  const b2Key = buildReadableIntakeKey(stored.id, stored.title, extension);

  console.log(
    `${candidateId}: resolved ${sourceFetchUrl} -> ${normalizedContentType}, ${bytes.byteLength} bytes, media_uid=${mediaUid}, b2_key=${b2Key}`,
  );

  if (dryRun) {
    console.log(`${candidateId}: dry run -- not writing to B2 or D1`);
    return { candidateId, mediaUid, b2Key, dryRun: true };
  }

  const b2Check = requireB2(process.env);
  if (!b2Check.ok) {
    throw new Error(`${candidateId}: B2 not configured (${b2Check.response.status})`);
  }

  let etag = null;
  const alreadyInB2 = await db.prepare('SELECT media_uid FROM media_assets WHERE media_uid = ? LIMIT 1').bind(mediaUid).first();
  if (!alreadyInB2) {
    const putResult = await putB2Object(b2Check.cfg, { key: b2Key, body: bytes, contentType: normalizedContentType });
    etag = putResult.etag;
  }

  const result = await commitIngestedMedia(db, {
    candidateId: stored.id,
    candidateExternalId: candidateId,
    mediaUid,
    b2Key,
    size: bytes.byteLength,
    etag,
    reviewer: conclusion.reviewer ?? 'unknown',
    conclusion: conclusion.conclusion ?? 'unknown',
  });

  console.log(`${candidateId}: ingested (already_existed=${result.alreadyExisted})`);
  return { candidateId, mediaUid: result.mediaUid, b2Key: result.b2Key, alreadyExisted: result.alreadyExisted };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = readJson(options.candidates);

  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });
  const approvedDomains = await loadApprovedSourceDomains(db);

  const results = [];
  const errors = [];
  for (const candidate of registry.candidates) {
    try {
      results.push(await ingestOne(db, candidate, approvedDomains, options.dryRun));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      console.error(`FAILED: ${message}`);
    }
  }

  console.log(`\n${results.length} succeeded, ${errors.length} failed, out of ${registry.candidates.length} candidate(s).`);
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main();
