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
  ARCHIVE_NOTE_MARKER,
  appendArchiveNote,
  archiveVerdict,
  assessPictureQuality,
  locItemIsPicture,
  longSideOf,
  minimumLongSideFor,
  pickBestLocImage,
  pickCommonsFile,
  pictureKind,
} = await import('./archive-ingest-lib.mjs');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const USER_AGENT = 'LGFC-Gehrig-Archive-Ingest/1.0 (lougehrigfanclub.com; contact via site)';
const NEAR_DUPLICATE_SKIP_DISTANCE = 4;
const MAX_CONSECUTIVE_TRANSIENT_FAILURES = 3;
const REQUEST_PAUSE_MS = 1500;

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

async function fetchOk(url, accept) {
  let response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: AbortSignal.timeout(90_000) });
  } catch (error) {
    throw new TransientError(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 404 || response.status === 410) throw new SkipError(`source returned HTTP ${response.status}`);
  if (response.status === 429 || response.status >= 500 || response.status === 403) {
    throw new TransientError(`${url} -> HTTP ${response.status}`);
  }
  if (!response.ok) throw new SkipError(`source returned HTTP ${response.status}`);
  return response;
}

async function resolveLoc(row) {
  const match = /\/item\/([^/?#]+)/.exec(row.source_url ?? '');
  if (!match) throw new SkipError('source_url is not a loc.gov item page');
  const response = await fetchOk(`https://www.loc.gov/item/${match[1]}/?fo=json`, 'application/json');
  const data = await response.json();
  if (!locItemIsPicture(data)) throw new SkipError('loc.gov record is not a photograph, print or drawing');
  const file = pickBestLocImage(data);
  if (!file) throw new SkipError('loc.gov record names no downloadable image file');
  const item = data.item ?? {};
  return {
    ...file,
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
  const resolved = row.source_domain === 'loc.gov' ? await resolveLoc(row) : await resolveCommons(row);

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
  if (!early.ok) throw new SkipError(early.reason);

  const urlCheck = validateIngestSourceUrl(resolved.url, context.approvedDomains);
  if (!urlCheck.ok) throw new SkipError(urlCheck.error);

  if (context.options.dryRun) {
    console.log(`${row.candidate_id}: would archive ${resolved.url} (${resolved.mimetype}, ${resolved.width}x${resolved.height})`);
    return 'dry-run';
  }

  const response = await fetchOk(resolved.url, 'image/*');
  const finalUrlCheck = validateIngestSourceUrl(response.url, context.approvedDomains);
  if (!finalUrlCheck.ok) throw new SkipError(`redirected off the allowlist: ${finalUrlCheck.error}`);
  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const typeCheck = validateIngestContentType(contentType);
  if (!typeCheck.ok) throw new SkipError(typeCheck.error);
  const body = await response.arrayBuffer();
  const sizeCheck = validateIngestSize(body.byteLength);
  if (!sizeCheck.ok) throw new SkipError(sizeCheck.error);
  const bytes = new Uint8Array(body);
  const magicCheck = validateIngestMagicBytes(contentType, bytes);
  if (!magicCheck.ok) throw new SkipError(magicCheck.error);

  const decoded = decodedSize(bytes);
  if (decoded) {
    const side = longSideOf(decoded.width, decoded.height);
    if (side < minimumLongSide) {
      throw new SkipError(`downloaded file long side ${side}px is under the ${minimumLongSide}px minimum for a ${kind}`);
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
  await noteRow(db, row, `archived ${result.b2Key}, on rights hold, ${kind}${quality.publishBlocked ? `, publish blocked: ${quality.publishBlockReason}` : ''}`, false);
  console.log(`${row.candidate_id}: archived ${result.b2Key} (${bytes.byteLength} bytes, ${decoded ? `${decoded.width}x${decoded.height}` : 'size n/a'})`);
  return 'archived';
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const lists = loadCopyQualityLists(repoRoot);
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });
  const approvedDomains = await loadApprovedSourceDomains(db);

  const b2 = requireB2(process.env);
  if (!b2.ok && !options.dryRun) {
    console.error('B2 is not configured (B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY); refusing to run.');
    process.exit(1);
  }

  const rows = (
    await db
      .prepare(
        `SELECT id, candidate_id, title, source_url, source_domain, admin_notes
         FROM content_items
         WHERE media_asset_id IS NULL AND superseded_at IS NULL AND content_type = 'photo'
           AND source_domain IN ('loc.gov', 'commons.wikimedia.org')
           AND (admin_notes IS NULL OR admin_notes NOT LIKE '%${ARCHIVE_NOTE_MARKER}%')
         ORDER BY id LIMIT ?`,
      )
      .bind(options.limit)
      .all()
  ).results ?? [];

  const counts = { archived: 0, skipped: 0, deferred: 0, dryRun: 0 };
  let consecutiveTransient = 0;
  console.log(`${rows.length} candidate(s) selected (limit ${options.limit}).`);

  for (const row of rows) {
    try {
      const outcome = await archiveOne(db, row, { options, lists, approvedDomains, b2 });
      if (outcome === 'archived') counts.archived += 1;
      else counts.dryRun += 1;
      consecutiveTransient = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof SkipError) {
        counts.skipped += 1;
        consecutiveTransient = 0;
        console.log(`${row.candidate_id}: skipped -- ${message}`);
        await noteRow(db, row, `skipped, ${message}`, options.dryRun);
      } else {
        counts.deferred += 1;
        consecutiveTransient += 1;
        console.error(`${row.candidate_id}: deferred to the next run -- ${message}`);
        if (consecutiveTransient >= MAX_CONSECUTIVE_TRANSIENT_FAILURES) {
          console.error('Three failures in a row; stopping this run early (source throttling or an outage).');
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
