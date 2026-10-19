#!/usr/bin/env node
// B2/D1 relationship check (#4469, row 73; reusable for monitoring gap 3, #4683).
// Reads the public photo list a site serves (the rows D1 says are publishable) and confirms each photo
// address returns an image from B2. Public URLs only; no credentials, no database access, no writes.

import { pathToFileURL } from 'node:url';

export const PAGE_SIZE = 100;
export const MAX_PHOTOS = 1000;

export async function listPublicPhotos(base, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const photos = [];
  for (let offset = 0; offset < MAX_PHOTOS; offset += PAGE_SIZE) {
    const response = await fetchImpl(`${base}/api/photos?limit=${PAGE_SIZE}&offset=${offset}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`photo list returned ${response.status}`);
    const body = await response.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    photos.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return photos;
}

export async function checkPhotoAddress(photo, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const result = { id: photo.id, photoId: photo.photo_id ?? null, ok: false, status: null, contentType: null, reason: null };
  try {
    const response = await fetchImpl(photo.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    result.status = response.status;
    result.contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() || null;
    if (response.status < 200 || response.status > 299) result.reason = `http_${response.status}`;
    else if (!result.contentType || !result.contentType.startsWith('image/')) result.reason = 'not_an_image';
    else result.ok = true;
  } catch (error) {
    result.reason = error?.name === 'TimeoutError' ? 'timeout' : 'network_error';
  }
  return result;
}

export async function runRelationshipCheck(base, options = {}) {
  const photos = await listPublicPhotos(base, options);
  const results = [];
  for (const photo of photos) results.push(await checkPhotoAddress(photo, options));
  const failed = results.filter((result) => !result.ok);
  return { base, total: results.length, ok: results.length - failed.length, failed };
}

export function renderReport(report) {
  const lines = [`Base: ${report.base}`, `Public photos listed: ${report.total}`, `Image returned: ${report.ok}`, `Failed: ${report.failed.length}`];
  for (const item of report.failed) lines.push(`- id ${item.id}: ${item.reason}${item.status ? ` (HTTP ${item.status})` : ''}`);
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  const baseIndex = argv.indexOf('--base');
  const base = (baseIndex >= 0 ? argv[baseIndex + 1] : 'https://www.lougehrigfanclub.com').replace(/\/$/, '');
  const failOnMissing = argv.includes('--fail-on-missing');
  const report = await runRelationshipCheck(base);
  console.log(renderReport(report));
  if (failOnMissing && report.failed.length > 0) process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
