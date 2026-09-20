#!/usr/bin/env node
// Fetches each pilot story's real photo from its Wikimedia Commons original
// (validated the same way #3552's ingestion path validates any fetched
// original), uploads it to production B2 at that photo's rendition keys,
// and updates `photos.url` and `content_inventory_media_renditions` for
// that media_id to the real B2 URLs -- computed via the app's own
// publicUrlForRenditionKey() so they match exactly what a live rendition
// would resolve to.
//
// Replaces the pilot pack's Wikimedia hotlinks, which aren't on the site's
// enforced CSP img-src allowlist (public/_headers) and so never rendered in
// a browser even though the D1 picture-routing chain itself was correct.
//
// One distinct, real, public-domain photo per pilot story (#4183 follow-up)
// so each Club Home zone shows a different picture instead of the same one
// four times over -- lead-story and media-feature still share one image,
// since the media-feature zone always mirrors the lead story's own primary
// image by design (see CLUB_HOME_PINNABLE_ZONES in
// functions/_lib/content-inventory-club-home.ts).
//
// Each photo is fetched, uploaded to B2, and applied to D1 as one complete
// unit before moving to the next -- a later photo hitting a rate limit (or
// any other failure) leaves the earlier photos' work done, instead of an
// all-or-nothing batch where one failure discards every already-completed
// upload (#4183: a run that got 429'd by Wikimedia on the 3rd of 4 photos
// wiped out the first 2 photos' progress under the old batched design).
//
// Usage:
//   node --experimental-strip-types scripts/upload-club-home-pilot-photo.mjs --print
//   node --experimental-strip-types scripts/upload-club-home-pilot-photo.mjs --apply --remote
//   node --experimental-strip-types scripts/upload-club-home-pilot-photo.mjs --apply --local

import { writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { register } from 'node:module';

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

const { requireB2, putB2Object } = await import('../functions/_lib/b2.ts');
const { renditionObjectKey, publicUrlForRenditionKey } = await import('../functions/_lib/content-inventory-media.ts');
const { validateIngestContentType, validateIngestMagicBytes, validateIngestSize } = await import(
  '../functions/_lib/b2-ingest-validation.ts'
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIZES = ['thumbnail', 'medium'];
const USER_AGENT = 'LGFC-ClubHome-Pilot/1.0 (lougehrigfanclub.com; contact via site)';
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_FETCH_ATTEMPTS = 4;
const INTER_PHOTO_DELAY_MS = 1500;

// One distinct real photo per story (see seed/content/club-home-pilot-pack.json).
const PHOTOS = [
  { mediaId: 9401, commonsTitle: 'File:Lou Gehrig 1925.jpg' },
  { mediaId: 9402, commonsTitle: 'File:Lou Gehrig as a new Yankee 11 Jun 1923.jpg' },
  { mediaId: 9403, commonsTitle: 'File:LouGehrig1934Goudeycard.jpg' },
  { mediaId: 9404, commonsTitle: 'File:GehrigCU.jpg' },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries on 429/502/503/504 with exponential backoff, honoring a numeric
// Retry-After header when Wikimedia sends one. Wikimedia rate-limits bursts
// of back-to-back file fetches from the same client; a bare fetch() with no
// retry turns a transient 429 into a hard failure for the whole run.
async function fetchWithRetry(url, options, context) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    if (!RETRYABLE_STATUSES.has(res.status) || attempt === MAX_FETCH_ATTEMPTS) {
      throw new Error(`${context}: HTTP ${res.status} (attempt ${attempt}/${MAX_FETCH_ATTEMPTS})`);
    }
    const retryAfterHeader = Number(res.headers.get('retry-after'));
    const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : 2 ** attempt * 1000;
    console.warn(`${context}: HTTP ${res.status}, retrying in ${backoffMs}ms (attempt ${attempt}/${MAX_FETCH_ATTEMPTS})`);
    lastError = new Error(`${context}: HTTP ${res.status}`);
    await sleep(backoffMs);
  }
  throw lastError;
}

async function resolveWikimediaFileUrl(title) {
  const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
  const res = await fetchWithRetry(infoUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }, `Commons API (${title})`);
  const data = await res.json();
  const pages = Object.values(data.query?.pages ?? {});
  const url = pages[0]?.imageinfo?.[0]?.url;
  if (!url) throw new Error(`Could not resolve a direct file URL for "${title}"`);
  return url;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function fetchValidatedPhoto(commonsTitle) {
  const fileUrl = await resolveWikimediaFileUrl(commonsTitle);
  const resolvedHost = new URL(fileUrl).hostname.toLowerCase();
  if (resolvedHost !== 'upload.wikimedia.org') {
    throw new Error(`Resolved file URL host "${resolvedHost}" is not upload.wikimedia.org -- refusing to fetch.`);
  }

  const sourceResponse = await fetchWithRetry(fileUrl, { headers: { 'User-Agent': USER_AGENT } }, `Fetching ${fileUrl}`);

  const contentType = (sourceResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const contentTypeCheck = validateIngestContentType(contentType);
  if (!contentTypeCheck.ok) throw new Error(contentTypeCheck.error);
  // The persisted rendition contract is JPEG-only -- renditionObjectKey() always
  // produces a .jpg key and RENDITION_OUTPUT_CONTENT_TYPE is image/jpeg. Fail
  // fast on any other (otherwise-valid) image type instead of silently writing
  // a mismatched content_type under a .jpg key (#4218 Copilot review).
  if (contentType !== 'image/jpeg') {
    throw new Error(`${commonsTitle}: source is ${contentType}, not image/jpeg -- the rendition pipeline is JPEG-only. Pick a JPEG Commons source instead.`);
  }

  const bytes = new Uint8Array(await sourceResponse.arrayBuffer());
  const sizeCheck = validateIngestSize(bytes.byteLength);
  if (!sizeCheck.ok) throw new Error(sizeCheck.error);
  const magicCheck = validateIngestMagicBytes(contentType, bytes);
  if (!magicCheck.ok) throw new Error(magicCheck.error);

  console.log(`Resolved ${fileUrl} -> ${contentType}, ${bytes.byteLength} bytes`);
  return { bytes, contentType };
}

function applyStatements(statements, isRemote) {
  const tmpFile = path.join(__dirname, '..', `.club-home-pilot-photo-update-${Date.now()}.sql`);
  writeFileSync(tmpFile, statements.join('\n'), 'utf8');
  const d1Args = isRemote
    ? ['wrangler', 'd1', 'execute', 'lgfc_lite', '--remote', '--yes']
    : ['wrangler', 'd1', 'execute', 'DB', '--local', '--env', 'preview'];
  const result = spawnSync('npx', [...d1Args, '--file', tmpFile], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  try {
    unlinkSync(tmpFile);
  } catch {}
  if (result.status !== 0) throw new Error(`wrangler d1 execute exited ${result.status}`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--apply') ? 'apply' : 'print';
  const isRemote = args.includes('--remote');

  if (mode === 'print') {
    for (const photo of PHOTOS) {
      await fetchValidatedPhoto(photo.commonsTitle);
    }
    console.log('--print: not uploading to B2 or writing SQL. Re-run with --apply --remote.');
    return;
  }

  const b2Check = requireB2(process.env);
  if (!b2Check.ok) {
    throw new Error(`B2 not configured (HTTP ${b2Check.response.status})`);
  }

  const failures = [];
  for (const [index, photo] of PHOTOS.entries()) {
    if (index > 0) await sleep(INTER_PHOTO_DELAY_MS);

    try {
      const { mediaId, commonsTitle } = photo;
      const { bytes, contentType } = await fetchValidatedPhoto(commonsTitle);

      const now = new Date().toISOString().replace('Z', '000Z').slice(0, 24);
      const renditionUrlBySize = {};
      for (const size of SIZES) {
        const key = renditionObjectKey(mediaId, size);
        await putB2Object(b2Check.cfg, { key, body: bytes, contentType });
        const publicUrl = publicUrlForRenditionKey(process.env, b2Check.cfg, key);
        renditionUrlBySize[size] = { key, publicUrl };
        console.log(`Uploaded media_id ${mediaId} ${size} rendition -> ${key} -> ${publicUrl}`);
      }

      const photoKey = `club-newspaper/originals/${mediaId}/original.jpg`;
      await putB2Object(b2Check.cfg, { key: photoKey, body: bytes, contentType });
      const photoPublicUrl = publicUrlForRenditionKey(process.env, b2Check.cfg, photoKey);
      console.log(`Uploaded media_id ${mediaId} original -> ${photoKey} -> ${photoPublicUrl}`);

      const statements = [`UPDATE photos SET url = ${sqlString(photoPublicUrl)} WHERE id = ${mediaId};`];
      for (const size of SIZES) {
        statements.push(
          `UPDATE content_inventory_media_renditions SET url = ${sqlString(renditionUrlBySize[size].publicUrl)}, b2_key = ${sqlString(renditionUrlBySize[size].key)}, content_type = ${sqlString(contentType)}, status = 'ready', generated_at = ${sqlString(now)}, generated_by = 'club-home-pilot-b2-upload' WHERE media_id = ${mediaId} AND size = ${sqlString(size)};`,
        );
      }
      applyStatements(statements, isRemote);
      console.log(`media_id ${mediaId} (${commonsTitle}): done.`);
    } catch (err) {
      const message = err?.message || String(err);
      console.error(`media_id ${photo.mediaId} (${photo.commonsTitle}) FAILED: ${message}`);
      failures.push({ mediaId: photo.mediaId, commonsTitle: photo.commonsTitle, message });
    }
  }

  if (failures.length) {
    console.error(
      `\n${failures.length}/${PHOTOS.length} photo(s) failed:\n${failures.map((f) => `  - media_id ${f.mediaId} (${f.commonsTitle}): ${f.message}`).join('\n')}\n\nAlready-succeeded photos above were still uploaded and applied to D1. Re-run this script to retry only what's needed -- it's safe, each photo upserts its own rows.`,
    );
    process.exit(1);
  }

  console.log(`\nAll ${PHOTOS.length} photos uploaded and applied.`);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
