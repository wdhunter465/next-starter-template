#!/usr/bin/env node
// Near-duplicate sweep of every published photo (#4707).
// Reads the public photo list and the public image bytes only. The perceptual hash is computed in
// memory, so a photo with no stored hash is still compared. Nothing is written to Production.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { computePerceptualHash, hammingDistanceHex } from '../../functions/_lib/perceptual-hash.ts';

export const NEAR_DUPLICATE_MAX_DISTANCE = 10;
export const ISSUE_TITLE = 'OPS — Near-duplicate published photos';
const RENDITION_SIZES = new Set(['thumbnail', 'small', 'medium', 'large', 'original', 'social', 'social-square', 'social-link']);
const DEFAULT_BASE = 'https://www.lougehrigfanclub.com';
const PAGE_SIZE = 100;
const MAX_PHOTOS = 1000;

export function originalKey(url) {
  const path = new URL(url, 'https://local.invalid').pathname.split('/').filter(Boolean);
  const kept = [];
  for (const part of path) {
    const extension = part.match(/\.[a-z0-9]+$/i)?.[0] ?? '';
    const stem = part.slice(0, part.length - extension.length).toLowerCase();
    if (RENDITION_SIZES.has(stem)) continue;
    const stripped = stem.replace(/-(thumbnail|small|medium|large|original|social)$/i, '');
    kept.push(stripped === stem ? part : `${stripped}${extension}`);
  }
  return kept.join('/') || String(url);
}

export function fileNameOf(url) {
  const path = new URL(url, 'https://local.invalid').pathname.split('/').filter(Boolean);
  return path.at(-1) || String(url);
}

export function pairKey(leftId, rightId) {
  const [low, high] = [Number(leftId), Number(rightId)].sort((a, b) => a - b);
  return `${low}:${high}`;
}

export function reviewedKeys(allowlist) {
  const pairs = Array.isArray(allowlist?.pairs) ? allowlist.pairs : [];
  return new Set(pairs.map((pair) => pairKey(pair.ids[0], pair.ids[1])));
}

export async function ensureHashes(photos, hashImage = computePerceptualHash) {
  const ready = [];
  for (const photo of photos) {
    if (photo.hash) {
      ready.push(photo);
      continue;
    }
    if (!photo.bytes || photo.bytes.length === 0) continue;
    ready.push({ ...photo, hash: await hashImage(photo.bytes) });
  }
  return ready;
}

export function findNearDuplicates(photos, { maxDistance = NEAR_DUPLICATE_MAX_DISTANCE, allowlist = { pairs: [] } } = {}) {
  const groups = new Map();
  for (const photo of photos) {
    if (!photo.hash) continue;
    const key = originalKey(photo.url || photo.filename || String(photo.id));
    const group = groups.get(key) || [];
    group.push(photo);
    groups.set(key, group);
  }
  const representatives = [...groups.values()].map((group) =>
    [...group].sort((a, b) => (b.bytes?.length || b.size || 0) - (a.bytes?.length || a.size || 0) || Number(a.id) - Number(b.id))[0],
  );
  const reviewed = reviewedKeys(allowlist);
  const pairs = [];
  for (let i = 0; i < representatives.length; i += 1) {
    for (let j = i + 1; j < representatives.length; j += 1) {
      const left = representatives[i];
      const right = representatives[j];
      const distance = hammingDistanceHex(left.hash, right.hash);
      if (distance > maxDistance) continue;
      const key = pairKey(left.id, right.id);
      if (reviewed.has(key)) continue;
      const leftSize = left.bytes?.length || left.size || 0;
      const rightSize = right.bytes?.length || right.size || 0;
      pairs.push({
        key,
        distance,
        largerId: leftSize === rightSize ? Math.min(Number(left.id), Number(right.id)) : leftSize > rightSize ? Number(left.id) : Number(right.id),
        left: describe(left, leftSize),
        right: describe(right, rightSize),
      });
    }
  }
  return pairs.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key));
}

function describe(photo, size) {
  return { id: Number(photo.id), filename: photo.filename || fileNameOf(photo.url || ''), size };
}

export function renderReport(pairs) {
  if (pairs.length === 0) return 'Near-duplicate published photos: none.';
  const lines = [`Near-duplicate published photos: ${pairs.length}`];
  for (const pair of pairs) {
    lines.push(`- ${pair.left.id} ${pair.left.filename} (${pair.left.size} bytes) and ${pair.right.id} ${pair.right.filename} (${pair.right.size} bytes); distance ${pair.distance}; larger id ${pair.largerId}`);
  }
  return lines.join('\n');
}

export function loadAllowlist(path = join(dirname(fileURLToPath(import.meta.url)), 'duplicate-photo-reviewed.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function listPublicPhotos(base, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  const photos = [];
  for (let offset = 0; offset < MAX_PHOTOS; offset += PAGE_SIZE) {
    const response = await fetchImpl(`${base}/api/photos?limit=${PAGE_SIZE}&offset=${offset}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`photo list returned ${response.status}`);
    const body = await response.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    photos.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return photos;
}

async function downloadPhoto(photo, fetchImpl, timeoutMs) {
  const response = await fetchImpl(photo.url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { id: photo.id, url: photo.url, filename: fileNameOf(photo.url), bytes, size: bytes.length, hash: photo.hash || null };
}

export async function openDuplicateIssue({ title, body, fetchImpl = fetch }) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) return { opened: false, reason: 'no GitHub credentials' };
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'lgfc-duplicate-photo-sweep', 'Content-Type': 'application/json' };
  const listed = await fetchImpl(`https://api.github.com/repos/${repository}/issues?state=open&per_page=100`, { headers });
  if (!listed.ok) throw new Error(`list issues failed: ${listed.status}`);
  const existing = (await listed.json()).find((issue) => issue.title === title && !issue.pull_request);
  if (existing) {
    const comment = await fetchImpl(`https://api.github.com/repos/${repository}/issues/${existing.number}/comments`, { method: 'POST', headers, body: JSON.stringify({ body }) });
    if (!comment.ok) throw new Error(`comment failed: ${comment.status}`);
    return { opened: false, updated: existing.number };
  }
  const created = await fetchImpl(`https://api.github.com/repos/${repository}/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, body, labels: ['team:operations', 'ops-exception'] }),
  });
  if (!created.ok) throw new Error(`create issue failed: ${created.status}`);
  const issue = await created.json();
  return { opened: true, number: issue.number };
}

export async function runSweep(photos, { allowlist = { pairs: [] }, hashImage = computePerceptualHash, openIssue = openDuplicateIssue } = {}) {
  const hashed = await ensureHashes(photos, hashImage);
  const pairs = findNearDuplicates(hashed, { allowlist });
  const report = renderReport(pairs);
  let outcome = null;
  if (pairs.length > 0) outcome = await openIssue({ title: ISSUE_TITLE, body: `${report}\n\nThe hash is a signal for a person, not proof. Do not remove, merge, or hide a photo from this report. Add a reviewed pair to scripts/ops/duplicate-photo-reviewed.json.` });
  return { pairs, report, outcome };
}

export async function main(argv = process.argv.slice(2)) {
  const baseIndex = argv.indexOf('--base');
  const base = (baseIndex >= 0 ? argv[baseIndex + 1] : DEFAULT_BASE).replace(/\/$/, '');
  const listed = await listPublicPhotos(base);
  const photos = [];
  for (const photo of listed) {
    if (!photo?.url) continue;
    const downloaded = await downloadPhoto(photo, fetch, 20_000);
    if (downloaded) photos.push(downloaded);
  }
  const result = await runSweep(photos, { allowlist: loadAllowlist() });
  console.log(result.report);
  if (result.outcome) console.log(JSON.stringify(result.outcome));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
