#!/usr/bin/env node
/**
 * #4859: archives the picture file for imported discovery candidates.
 *
 * Product Authority direction (2026-10-24, #4839): the archive holds the actual
 * pictures now and the website uses them only after written permission. Every
 * file written here starts on rights hold (media_assets.rights_hold = 1); nothing
 * leaves hold without recorded rights evidence and a person's release.
 *
 * Per run: pick a small batch of imported loc.gov and Wikimedia Commons photo
 * rows that have no media yet, resolve the real image file from the source's own
 * record, apply the quality gate (no watermark or agency copies, minimum size,
 * no near-duplicate of an archived picture), fetch it through the same
 * validators as the ingest endpoint, write it to Backblaze and link it. A row
 * that fails the gate gets a dated skip note in admin_notes so it is not
 * retried; a transient failure (throttling, network) leaves the row untouched
 * for the next run.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   B2_ENDPOINT=... B2_BUCKET=... B2_KEY_ID=... B2_APP_KEY=... \
 *   node --experimental-strip-types scripts/content-pipeline/archive-ingest.mjs \
 *     [--database lgfc_lite] [--local|--remote] [--limit 20] [--dry-run]
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
const { findNearDuplicateMediaAssets } = await import('../../functions/_lib/content-pipeline-duplicate-detection.ts');
const { commitIngestedMedia } = await import('../../functions/_lib/media-ingest-repository.ts');
const { computePerceptualHash } = await import('../../functions/_lib/perceptual-hash.ts');
const { PhotonImage, SamplingFilter, resize } = await import('@cf-wasm/photon');
const { loadCopyQualityLists } = await import('./gehrig-copy-quality.mjs');
const {
  ARCHIVE_HOLD_REASON,
  backoffDelayMs,
  buildDplaImageLadder,
  createThrottleTracker,
  DPLA_EXTRA_APPROVED_DOMAINS,
  parseDplaLinks,
  buildArchiveCandidatesSql,
  MASTER_JPEG_QUALITY,
  MASTER_TIFF_MAX_BYTES,
  describeLocFiles,
  masterTargetSize,
  isRetryableStatus,
  appendArchiveNote,
  archiveVerdict,
  assessPictureQuality,
  locItemIsPicture,
  longSideOf,
  minimumLongSideFor,
  pickLocFile,
  pickCommonsFile,
  pictureKind,
} = await import('./archive-ingest-lib.mjs');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const USER_AGENT = 'LGFC-Gehrig-Archive-Ingest/1.0 (https://www.lougehrigfanclub.com/; Lou Gehrig Fan Club picture archive)';
const NEAR_DUPLICATE_SKIP_DISTANCE = 4;
const REQUEST_PAUSE_MS = 3000;

class SkipError extends Error {}
class TransientError extends Error {}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flagName}`);
  return value;
}

function parseArgs(argv) {
  const options = { database: 'lgfc_lite', target: 'local', limit: 20, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--database') {
      options.database = readFlagValue(argv, index, '--database');
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--limit') {
      const parsed = Number(readFlagValue(argv, index, '--limit'));
      if (!Number.isInteger(parsed) || parsed < 1) throw new Error('--limit must be a positive integer');
      options.limit = parsed;
      index += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_FETCH_ATTEMPTS = 3;

async function fetchOk(url, accept, timeoutMs = 90_000) {
  let lastProblem = '';
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      lastProblem = `${url} -> ${error instanceof Error ? error.message : String(error)}`;
      if (attempt < MAX_FETCH_ATTEMPTS) await sleep(backoffDelayMs(attempt));
      continue;
    }
    if (response.status === 404 || response.status === 410) throw new SkipError(`source returned HTTP ${response.status}`);
    if (isRetryableStatus(response.status)) {
      lastProblem = `${url} -> HTTP ${response.status}`;
      if (attempt < MAX_FETCH_ATTEMPTS) await sleep(backoffDelayMs(attempt, response.headers.get('retry-after')));
      continue;
    }
    if (response.status === 403 || response.status >= 500) throw new TransientError(`${url} -> HTTP ${response.status}`);
    if (!response.ok) throw new SkipError(`source returned HTTP ${response.status}`);
    return response;
  }
  throw new TransientError(`${lastProblem} (after ${MAX_FETCH_ATTEMPTS} attempts)`);
}

async function resolveLoc(row, minimumLongSide) {
  const match = /\/item\/([^/?#]+)/.exec(row.source_url ?? '');
  if (!match) throw new SkipError('source_url is not a loc.gov item page');
  const response = await fetchOk(`https://www.loc.gov/item/${match[1]}/?fo=json`, 'application/json', 30_000);
  const data = await response.json();
  if (!locItemIsPicture(data)) throw new SkipError('loc.gov record is not a photograph, print or drawing');
  const file = pickLocFile(data, minimumLongSide);
  if (!file) throw new SkipError(`loc.gov record names no downloadable image file (${describeLocFiles(data)})`);
  const item = data.item ?? {};
  return {
    ...file,
    inventory: describeLocFiles(data),
    text: [item.title, JSON.stringify(item.notes ?? ''), JSON.stringify(item.rights_advisory ?? ''), JSON.stringify(item.contributor_names ?? '')],
  };
}

async function resolveCommons(row) {
  const title = decodeURIComponent((row.source_url ?? '').split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  if (!title.startsWith('File:')) throw new SkipError('source_url is not a Commons file page');
  const api =
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    '&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*';
  const response = await fetchOk(api, 'application/json');
  const data = await response.json();
  const file = pickCommonsFile(Object.values(data.query?.pages ?? {})[0]);
  if (!file) throw new SkipError('Commons file is not a keepable image type');
  return { ...file, text: [title, file.description, file.credit, file.restrictions, file.categories] };
}

// DPLA rows: try each full-size link for the contributing library and keep the first that is large enough (#4902).
async function resolveDpla(row, minimumLongSide) {
  const links = parseDplaLinks(row.provenance_notes);
  const ladder = buildDplaImageLadder(links);
  if (!ladder.length) throw new SkipError(`no known full-size image layout for ${links.institution || 'this library'}${links.thumbnail ? ` (thumbnail ${links.thumbnail})` : ' (no thumbnail recorded)'}`);
  const tried = [];
  for (const step of ladder) {
    let response;
    try {
      response = await fetchOk(step.url, 'image/*');
    } catch (error) {
      tried.push(`${step.label}: ${error instanceof Error ? error.message.slice(0, 80) : 'failed'}`);
      continue;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const size = decodedSize(bytes);
    if (!size) {
      tried.push(`${step.label}: not a decodable image`);
      continue;
    }
    const side = longSideOf(size.width, size.height);
    if (side < minimumLongSide) {
      tried.push(`${step.label}: ${size.width}x${size.height}`);
      continue;
    }
    return {
      url: step.url,
      mimetype: (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase(),
      width: size.width,
      height: size.height,
      inventory: tried.join('; '),
      text: [row.title, row.provenance_notes],
    };
  }
  throw new SkipError(`no link reached ${minimumLongSide}px (${tried.join('; ')})`);
}

async function loadApprovedSourceDomains(db) {
  const result = await db.prepare(`SELECT source_domain FROM sources WHERE source_trust_status = 'trusted'`).all();
  return new Set((result.results ?? []).map((row) => String(row.source_domain || '').trim().toLowerCase()).filter(Boolean));
}

function decodedSize(bytes) {
  try {
    const image = PhotonImage.new_from_byteslice(bytes);
    const size = { width: image.get_width(), height: image.get_height() };
    image.free();
    return size;
  } catch {
    return null;
  }
}

// Decodes a TIFF master and returns a JPEG master, or null when the TIFF cannot be decoded (#4874).
function convertTiffToJpegMaster(tiffBytes) {
  let image = null;
  let scaled = null;
  try {
    image = PhotonImage.new_from_byteslice(tiffBytes);
    const sourceWidth = image.get_width();
    const sourceHeight = image.get_height();
    const target = masterTargetSize(sourceWidth, sourceHeight);
    scaled = target.scaled ? resize(image, target.width, target.height, SamplingFilter.Lanczos3) : null;
    const jpeg = (scaled ?? image).get_bytes_jpeg(MASTER_JPEG_QUALITY);
    return { bytes: jpeg, sourceWidth, sourceHeight };
  } catch {
    return null;
  } finally {
    scaled?.free();
    image?.free();
  }
}

// A picture that decodes but cannot be resized would fail every rendition, so it is archived
// but blocked from publication instead of being skipped.
function canResize(bytes) {
  try {
    const image = PhotonImage.new_from_byteslice(bytes);
    const resized = resize(image, 32, 32, SamplingFilter.Nearest);
    resized.free();
    image.free();
    return true;
  } catch {
    return false;
  }
}

async function noteRow(db, row, line, dryRun) {
  if (dryRun) return;
  await db
    .prepare('UPDATE content_items SET admin_notes = ? WHERE id = ?')
    .bind(appendArchiveNote(row.admin_notes, line), row.id)
    .run();
}

async function archiveOne(db, row, context) {
  const resolved =
    row.source_domain === 'loc.gov'
      ? await resolveLoc(row, context.lists.minimum_long_side_px)
      : row.source_domain === 'dp.la'
        ? await resolveDpla(row, context.lists.minimum_long_side_px)
        : await resolveCommons(row);

  const kind = pictureKind(row.title, ...resolved.text);
  const minimumLongSide = minimumLongSideFor(kind, context.lists.minimum_long_side_px);

  const early = archiveVerdict({
    imageUrl: resolved.url,
    text: resolved.text,
    width: resolved.width,
    height: resolved.height,
    minimumLongSide,
    denylist: context.lists.denylist,
  });
  if (!early.ok) throw new SkipError(`${early.reason}${resolved.inventory ? ` (${resolved.inventory})` : ''}`);

  const urlCheck = validateIngestSourceUrl(resolved.url, context.approvedDomains);
  if (!urlCheck.ok) throw new SkipError(urlCheck.error);

  if (context.options.dryRun) {
    console.log(`${row.candidate_id}: would archive ${resolved.url} (${resolved.mimetype}, ${resolved.width}x${resolved.height})`);
    return 'dry-run';
  }

  const isTiff = resolved.mimetype === 'image/tiff';
  const response = await fetchOk(resolved.url, 'image/*', isTiff ? 300_000 : 90_000);
  const finalUrlCheck = validateIngestSourceUrl(response.url, context.approvedDomains);
  if (!finalUrlCheck.ok) throw new SkipError(`redirected off the allowlist: ${finalUrlCheck.error}`);
  let contentType = isTiff ? 'image/tiff' : (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!isTiff) {
    const typeCheck = validateIngestContentType(contentType);
    if (!typeCheck.ok) throw new SkipError(typeCheck.error);
  }
  const body = await response.arrayBuffer();
  if (isTiff) {
    if (body.byteLength > MASTER_TIFF_MAX_BYTES) throw new SkipError(`TIFF master is ${Math.round(body.byteLength / 1e6)} MB, over the ${Math.round(MASTER_TIFF_MAX_BYTES / 1048576)} MB limit`);
  } else {
    const sizeCheck = validateIngestSize(body.byteLength);
    if (!sizeCheck.ok) throw new SkipError(sizeCheck.error);
  }
  let bytes = new Uint8Array(body);
  const magicCheck = validateIngestMagicBytes(contentType, bytes);
  if (!magicCheck.ok) throw new SkipError(magicCheck.error);

  // loc.gov offers JPEG copies only up to 1,024 px, so a TIFF master is decoded, checked against the
  // minimum, scaled to at most 4,000 px and stored as a JPEG master (#4874).
  let conversionNote = '';
  if (isTiff) {
    const converted = convertTiffToJpegMaster(bytes);
    if (!converted) throw new SkipError(`TIFF master of ${Math.round(bytes.byteLength / 1e6)} MB could not be decoded`);
    const sourceSide = longSideOf(converted.sourceWidth, converted.sourceHeight);
    if (sourceSide < minimumLongSide) {
      throw new SkipError(`TIFF master long side ${sourceSide}px is under the ${minimumLongSide}px minimum for a ${kind}${resolved.inventory ? ` (${resolved.inventory})` : ''}`);
    }
    const sizeCheck = validateIngestSize(converted.bytes.byteLength);
    if (!sizeCheck.ok) throw new SkipError(`converted master: ${sizeCheck.error}`);
    conversionNote = `, converted from a ${converted.sourceWidth}x${converted.sourceHeight} TIFF master (${Math.round(bytes.byteLength / 1e6)} MB) to a ${Math.round(converted.bytes.byteLength / 1e5) / 10} MB JPEG`;
    bytes = converted.bytes;
    contentType = 'image/jpeg';
  }

  const decoded = decodedSize(bytes);
  if (decoded && !isTiff) {
    const side = longSideOf(decoded.width, decoded.height);
    if (side < minimumLongSide) {
      throw new SkipError(`downloaded file long side ${side}px is under the ${minimumLongSide}px minimum for a ${kind}${resolved.inventory ? ` (${resolved.inventory})` : ''}`);
    }
  }

  const quality = assessPictureQuality({ width: decoded?.width, height: decoded?.height, kind });
  if (decoded && !canResize(bytes)) {
    quality.publishBlocked = true;
    quality.publishBlockReason = 'the picture decoded but could not be resized to a test size';
  }

  let perceptualHash = null;
  try {
    perceptualHash = await computePerceptualHash(bytes);
  } catch {
    // The hash is a best-effort duplicate signal; a decode failure never blocks the archive.
  }

  const checksum = await sha256Hex(bytes);
  const mediaUid = `sha256_${checksum.slice(0, 40)}`;

  if (perceptualHash) {
    const matches = await findNearDuplicateMediaAssets(db, { perceptualHash, sourceFilename: row.title, excludeMediaUid: mediaUid });
    const closest = matches.find((match) => match.distance <= NEAR_DUPLICATE_SKIP_DISTANCE);
    if (closest) throw new SkipError(`near-duplicate of archived ${closest.matchedCandidateId} (distance ${closest.distance})`);
  }

  const extension = INGEST_CONTENT_TYPE_EXTENSIONS[contentType] ?? 'bin';
  const b2Key = buildReadableIntakeKey(row.id, row.title, extension);
  let etag = null;
  const alreadyInB2 = await db.prepare('SELECT media_uid FROM media_assets WHERE media_uid = ? LIMIT 1').bind(mediaUid).first();
  if (!alreadyInB2) {
    etag = (await putB2Object(context.b2.cfg, { key: b2Key, body: bytes, contentType })).etag;
  }

  const result = await commitIngestedMedia(db, {
    candidateId: row.id,
    candidateExternalId: row.candidate_id,
    mediaUid,
    b2Key,
    size: bytes.byteLength,
    etag,
    reviewer: 'automated:archive-ingest',
    conclusion: 'unknown',
    perceptualHash,
    rightsHold: true,
    rightsHoldReason: ARCHIVE_HOLD_REASON,
    quality,
  });
  await noteRow(db, row, `archived ${result.b2Key}, on rights hold, ${kind}${conversionNote}${quality.publishBlocked ? `, publish blocked: ${quality.publishBlockReason}` : ''}`, false);
  console.log(`${row.candidate_id}: archived ${result.b2Key} (${bytes.byteLength} bytes, ${decoded ? `${decoded.width}x${decoded.height}` : 'size n/a'})`);
  return 'archived';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const lists = loadCopyQualityLists(repoRoot);
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });
  const approvedDomains = await loadApprovedSourceDomains(db);
  for (const domain of DPLA_EXTRA_APPROVED_DOMAINS) approvedDomains.add(domain);

  const b2 = requireB2(process.env);
  if (!b2.ok && !options.dryRun) {
    console.error('B2 is not configured (B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY); refusing to run.');
    process.exit(1);
  }

  const rows = (
    await db
      .prepare(buildArchiveCandidatesSql())
      .bind(options.limit)
      .all()
  ).results ?? [];

  const counts = { archived: 0, skipped: 0, deferred: 0, dryRun: 0 };
  const throttle = createThrottleTracker(2);
  const domainsInRun = new Set(rows.map((row) => row.source_domain));
  console.log(`${rows.length} candidate(s) selected (limit ${options.limit}).`);

  for (const row of rows) {
    if (throttle.isPaused(row.source_domain)) {
      counts.deferred += 1;
      console.error(`${row.candidate_id}: deferred to the next run -- ${row.source_domain} is throttling this run`);
      continue;
    }
    try {
      const outcome = await archiveOne(db, row, { options, lists, approvedDomains, b2 });
      if (outcome === 'archived') counts.archived += 1;
      else counts.dryRun += 1;
      throttle.recordSuccess(row.source_domain);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof SkipError) {
        counts.skipped += 1;
        throttle.recordSuccess(row.source_domain);
        console.log(`${row.candidate_id}: skipped -- ${message}`);
        await noteRow(db, row, `skipped, ${message}`, options.dryRun);
      } else {
        counts.deferred += 1;
        throttle.recordFailure(row.source_domain);
        console.error(`${row.candidate_id}: deferred to the next run -- ${message}`);
        if (throttle.isPaused(row.source_domain)) console.error(`${row.source_domain}: two failures in a row; its remaining rows wait for the next run.`);
        if (throttle.allPaused(domainsInRun)) {
          console.error('Every source in this run is failing; stopping early (throttling or an outage).');
          break;
        }
      }
    }
    await sleep(REQUEST_PAUSE_MS);
  }

  console.log(`\nArchive ingest: ${counts.archived} archived, ${counts.skipped} skipped, ${counts.deferred} deferred${options.dryRun ? `, ${counts.dryRun} dry-run` : ''}.`);
  if (rows.length > 0 && counts.archived === 0 && counts.skipped === 0 && counts.dryRun === 0) process.exitCode = 1;
}

main();
