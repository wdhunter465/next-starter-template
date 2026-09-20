#!/usr/bin/env node
// Fetches the real Lou Gehrig 1925 photo from its Wikimedia Commons original
// (validated the same way #3552's ingestion path validates any fetched
// original), uploads it to production B2 at the pilot pack's rendition keys
// (media_id 9401, #4183), and updates `photos.url` and
// `content_inventory_media_renditions` for that media_id to the real B2
// URLs -- computed via the app's own publicUrlForRenditionKey() so they
// match exactly what a live rendition would resolve to.
//
// Replaces the pilot pack's Wikimedia hotlink, which isn't on the site's
// enforced CSP img-src allowlist (public/_headers) and so never rendered in
// a browser even though the D1 picture-routing chain itself was correct.
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
const MEDIA_ID = 9401;
const COMMONS_TITLE = 'File:Lou Gehrig 1925.jpg';
const SIZES = ['thumbnail', 'medium'];
const USER_AGENT = 'LGFC-ClubHome-Pilot/1.0 (lougehrigfanclub.com; contact via site)';

async function resolveWikimediaFileUrl(title) {
  const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
  const res = await fetch(infoUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Commons API HTTP ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data.query?.pages ?? {});
  const url = pages[0]?.imageinfo?.[0]?.url;
  if (!url) throw new Error(`Could not resolve a direct file URL for "${title}"`);
  return url;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--apply') ? 'apply' : 'print';
  const isRemote = args.includes('--remote');

  const fileUrl = await resolveWikimediaFileUrl(COMMONS_TITLE);
  const resolvedHost = new URL(fileUrl).hostname.toLowerCase();
  if (resolvedHost !== 'upload.wikimedia.org') {
    throw new Error(`Resolved file URL host "${resolvedHost}" is not upload.wikimedia.org -- refusing to fetch.`);
  }

  const sourceResponse = await fetch(fileUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!sourceResponse.ok) throw new Error(`Fetching ${fileUrl} -> HTTP ${sourceResponse.status}`);

  const contentType = (sourceResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const contentTypeCheck = validateIngestContentType(contentType);
  if (!contentTypeCheck.ok) throw new Error(contentTypeCheck.error);

  const bytes = new Uint8Array(await sourceResponse.arrayBuffer());
  const sizeCheck = validateIngestSize(bytes.byteLength);
  if (!sizeCheck.ok) throw new Error(sizeCheck.error);
  const magicCheck = validateIngestMagicBytes(contentType, bytes);
  if (!magicCheck.ok) throw new Error(magicCheck.error);

  console.log(`Resolved ${fileUrl} -> ${contentType}, ${bytes.byteLength} bytes`);

  if (mode === 'print') {
    console.log('--print: not uploading to B2 or writing SQL. Re-run with --apply --remote.');
    return;
  }

  const b2Check = requireB2(process.env);
  if (!b2Check.ok) {
    throw new Error(`B2 not configured (HTTP ${b2Check.response.status})`);
  }

  const now = new Date().toISOString().replace('Z', '000Z').slice(0, 24);
  const renditionUrlBySize = {};
  for (const size of SIZES) {
    const key = renditionObjectKey(MEDIA_ID, size);
    await putB2Object(b2Check.cfg, { key, body: bytes, contentType });
    const publicUrl = publicUrlForRenditionKey(process.env, b2Check.cfg, key);
    renditionUrlBySize[size] = { key, publicUrl };
    console.log(`Uploaded ${size} rendition -> ${key} -> ${publicUrl}`);
  }

  const photoKey = `club-newspaper/originals/${MEDIA_ID}/original.jpg`;
  await putB2Object(b2Check.cfg, { key: photoKey, body: bytes, contentType });
  const photoPublicUrl = publicUrlForRenditionKey(process.env, b2Check.cfg, photoKey);
  console.log(`Uploaded original -> ${photoKey} -> ${photoPublicUrl}`);

  const statements = [
    `UPDATE photos SET url = ${sqlString(photoPublicUrl)} WHERE id = ${MEDIA_ID};`,
    ...SIZES.map(
      (size) =>
        `UPDATE content_inventory_media_renditions SET url = ${sqlString(renditionUrlBySize[size].publicUrl)}, b2_key = ${sqlString(renditionUrlBySize[size].key)}, content_type = ${sqlString(contentType)}, status = 'ready', generated_at = ${sqlString(now)}, generated_by = 'club-home-pilot-b2-upload' WHERE media_id = ${MEDIA_ID} AND size = ${sqlString(size)};`,
    ),
  ];
  const sql = statements.join('\n');

  const tmpFile = path.join(__dirname, '..', '.club-home-pilot-photo-update.sql');
  writeFileSync(tmpFile, sql, 'utf8');
  const d1Args = isRemote
    ? ['wrangler', 'd1', 'execute', 'lgfc_lite', '--remote', '--yes']
    : ['wrangler', 'd1', 'execute', 'DB', '--local', '--env', 'preview'];
  const result = spawnSync('npx', [...d1Args, '--file', tmpFile], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  try {
    unlinkSync(tmpFile);
  } catch {}
  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});
