#!/usr/bin/env node
/**
 * B2 photo inventory audit (#5537). READ-ONLY: lists objects and reads the first bytes of some of
 * them. It writes nothing to B2, D1 or GitHub; the report goes to stdout, a file and the Actions
 * step summary.
 *
 * Standard being checked (#5526, PR #5527): JPEG, long edge at most 4000 px, normally a few MB, and
 * never over the 10 MiB upload limit.
 *
 * Pass 1 (no downloads): extension, prefix and size from the object listing.
 * Pass 2 (small reads): for the largest JPEG, PNG and WebP objects, read the first 256 KiB and parse
 * the pixel size, to find a long edge over 4000 px.
 *
 * Env: B2_ENDPOINT (https://s3.<region>.backblazeb2.com), B2_BUCKET, B2_KEY_ID, B2_APP_KEY.
 * Options: --dimension-reads N (default 500, 0 skips pass 2), --out FILE, --prefix PREFIX.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_LONG_EDGE_PX = 4000;
export const UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
// A 4000 px JPEG at quality 0.9 is normally 1 to 3 MB. Above this a file is probably not resized.
export const LIKELY_NOT_RESIZED_BYTES = 6 * 1024 * 1024;
export const HEAD_BYTES = 256 * 1024;

const JPEG_EXT = new Set(['jpg', 'jpeg']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff', 'bmp', 'heic', 'heif', 'avif']);
const DIMENSION_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function extensionOf(key) {
  const name = String(key).split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function prefixOf(key) {
  const parts = String(key).split('/');
  return parts.length > 1 ? parts[0] : '(root)';
}

export function sizeBucket(bytes) {
  const mib = bytes / (1024 * 1024);
  if (mib < 0.25) return '< 0.25 MB';
  if (mib < 1) return '0.25 to 1 MB';
  if (mib < 3) return '1 to 3 MB';
  if (mib < 6) return '3 to 6 MB';
  if (mib <= 10) return '6 to 10 MB';
  return '> 10 MB';
}
export const SIZE_BUCKETS = ['< 0.25 MB', '0.25 to 1 MB', '1 to 3 MB', '3 to 6 MB', '6 to 10 MB', '> 10 MB'];

// ---- pixel size from the first bytes -------------------------------------------------------

const u16be = (b, o) => (b[o] << 8) | b[o + 1];
const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u24le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

export function parseDimensions(bytes) {
  const b = bytes;
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { format: 'png', width: u32be(b, 16), height: u32be(b, 20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xff) {
        i += 1;
        continue;
      }
      if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { format: 'jpeg', height: u16be(b, i + 5), width: u16be(b, i + 7) };
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2;
        continue;
      }
      const length = u16be(b, i + 2);
      if (length < 2) return null;
      i += 2 + length;
    }
    return null;
  }
  const ascii = (o, n) => String.fromCharCode(...b.slice(o, o + n));
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4);
    if (kind === 'VP8X') return { format: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
    if (kind === 'VP8 ') return { format: 'webp', width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff };
    if (kind === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

// ---- report --------------------------------------------------------------------------------

/**
 * @param {Array<{key:string,size:number}>} objects
 * @param {Map<string,{width:number,height:number,format:string}>} dimensions  keys already read
 */
export function buildReport(objects, dimensions = new Map(), options = {}) {
  const byExtension = {};
  const byPrefix = {};
  const histogram = Object.fromEntries(SIZE_BUCKETS.map((b) => [b, 0]));
  const nonJpegImages = [];
  const overLimit = [];
  const likelyNotResized = [];
  const overLongEdge = [];
  const nonImages = {};
  let totalBytes = 0;

  for (const { key, size } of objects) {
    const ext = extensionOf(key);
    const prefix = prefixOf(key);
    totalBytes += size;
    byExtension[ext || '(none)'] = (byExtension[ext || '(none)'] || 0) + 1;
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
    if (!IMAGE_EXT.has(ext)) {
      nonImages[ext || '(none)'] = (nonImages[ext || '(none)'] || 0) + 1;
      continue;
    }
    histogram[sizeBucket(size)] += 1;
    if (!JPEG_EXT.has(ext)) nonJpegImages.push({ key, size, ext });
    if (size > UPLOAD_LIMIT_BYTES) overLimit.push({ key, size });
    else if (size > LIKELY_NOT_RESIZED_BYTES) likelyNotResized.push({ key, size });
    const dim = dimensions.get(key);
    if (dim && Math.max(dim.width, dim.height) > MAX_LONG_EDGE_PX) {
      overLongEdge.push({ key, size, width: dim.width, height: dim.height });
    }
  }

  const bySizeDesc = (a, b) => b.size - a.size;
  const images = objects.filter((o) => IMAGE_EXT.has(extensionOf(o.key)));
  return {
    generated_at: options.generatedAt ?? new Date().toISOString(),
    bucket: options.bucket ?? null,
    standard: { format: 'jpeg', max_long_edge_px: MAX_LONG_EDGE_PX, upload_limit_bytes: UPLOAD_LIMIT_BYTES, likely_not_resized_bytes: LIKELY_NOT_RESIZED_BYTES },
    totals: { objects: objects.length, images: images.length, bytes: totalBytes, dimensions_read: dimensions.size },
    by_extension: byExtension,
    by_prefix: byPrefix,
    non_image_extensions: nonImages,
    size_histogram: histogram,
    non_jpeg_images: nonJpegImages.sort(bySizeDesc),
    over_upload_limit: overLimit.sort(bySizeDesc),
    likely_not_resized: likelyNotResized.sort(bySizeDesc),
    over_long_edge: overLongEdge.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height)),
    largest: [...images].sort(bySizeDesc).slice(0, 50),
  };
}

const mb = (n) => `${(n / (1024 * 1024)).toFixed(2)} MB`;

export function renderMarkdown(report, limit = 40) {
  const lines = [];
  const t = report.totals;
  lines.push('# B2 photo inventory audit (read-only)', '');
  lines.push(`Generated ${report.generated_at}. Standard: JPEG, long edge at most ${report.standard.max_long_edge_px} px, upload limit ${mb(report.standard.upload_limit_bytes)}.`, '');
  lines.push(`- Objects: ${t.objects} (images: ${t.images}), total ${mb(t.bytes)}`);
  lines.push(`- Pixel sizes read for ${t.dimensions_read} images (pass 2 reads only the first 256 KiB of the largest JPEG, PNG and WebP files)`);
  lines.push(`- **Non-JPEG images: ${report.non_jpeg_images.length}**`);
  lines.push(`- **Over the 10 MiB upload limit: ${report.over_upload_limit.length}**`);
  lines.push(`- Over ${mb(report.standard.likely_not_resized_bytes)} (probably not resized): ${report.likely_not_resized.length}`);
  lines.push(`- **Long edge over ${report.standard.max_long_edge_px} px (among those read): ${report.over_long_edge.length}**`, '');
  lines.push('## By extension', '', '| Extension | Objects |', '| --- | ---: |');
  for (const [ext, n] of Object.entries(report.by_extension).sort((a, b) => b[1] - a[1])) lines.push(`| ${ext} | ${n} |`);
  lines.push('', '## By top-level prefix', '', '| Prefix | Objects |', '| --- | ---: |');
  for (const [p, n] of Object.entries(report.by_prefix).sort((a, b) => b[1] - a[1]).slice(0, 25)) lines.push(`| ${p} | ${n} |`);
  lines.push('', '## Image size histogram', '', '| Size | Images |', '| --- | ---: |');
  for (const bucket of SIZE_BUCKETS) lines.push(`| ${bucket} | ${report.size_histogram[bucket]} |`);
  const section = (title, rows, fmt) => {
    lines.push('', `## ${title} (${rows.length})`, '');
    if (!rows.length) lines.push('None.');
    for (const r of rows.slice(0, limit)) lines.push(`- ${fmt(r)}`);
    if (rows.length > limit) lines.push(`- ... and ${rows.length - limit} more (full list in the JSON artifact)`);
  };
  section('Non-JPEG images', report.non_jpeg_images, (r) => `\`${r.key}\` (${r.ext}, ${mb(r.size)})`);
  section('Over the 10 MiB upload limit', report.over_upload_limit, (r) => `\`${r.key}\` (${mb(r.size)})`);
  section('Probably not resized (over 6 MB)', report.likely_not_resized, (r) => `\`${r.key}\` (${mb(r.size)})`);
  section(`Long edge over ${report.standard.max_long_edge_px} px`, report.over_long_edge, (r) => `\`${r.key}\` (${r.width} x ${r.height}, ${mb(r.size)})`);
  lines.push('');
  return lines.join('\n');
}

// ---- B2 access (aws CLI, as the other ops scripts do) ----------------------------------------

export function listObjects({ endpoint, bucket, prefix = '', exec }) {
  const objects = [];
  let token = '';
  for (;;) {
    const args = ['s3api', 'list-objects-v2', '--endpoint-url', endpoint, '--bucket', bucket, '--max-keys', '1000'];
    if (prefix) args.push('--prefix', prefix);
    if (token) args.push('--continuation-token', token);
    const response = JSON.parse(exec('aws', args));
    for (const o of response.Contents ?? []) objects.push({ key: o.Key, size: Number(o.Size) || 0 });
    if (response.IsTruncated && response.NextContinuationToken) token = response.NextContinuationToken;
    else break;
  }
  return objects;
}

export function readHead({ endpoint, bucket, key, exec, tmp }) {
  const file = join(tmp, 'head.bin');
  exec('aws', ['s3api', 'get-object', '--endpoint-url', endpoint, '--bucket', bucket, '--key', key, '--range', `bytes=0-${HEAD_BYTES - 1}`, file]);
  return new Uint8Array(readFileSync(file));
}

export async function audit({ endpoint, bucket, prefix = '', dimensionReads = 500, exec, log = () => {} }) {
  const objects = listObjects({ endpoint, bucket, prefix, exec });
  log(`Listed ${objects.length} objects`);
  const dimensions = new Map();
  if (dimensionReads > 0) {
    const tmp = mkdtempSync(join(tmpdir(), 'b2-audit-'));
    const candidates = objects
      .filter((o) => DIMENSION_EXT.has(extensionOf(o.key)))
      .sort((a, b) => b.size - a.size)
      .slice(0, dimensionReads);
    for (const { key } of candidates) {
      try {
        const dim = parseDimensions(readHead({ endpoint, bucket, key, exec, tmp }));
        if (dim) dimensions.set(key, dim);
      } catch (error) {
        log(`Could not read ${key}: ${String(error?.message ?? error).slice(0, 120)}`);
      }
    }
    log(`Read pixel sizes for ${dimensions.size} of ${candidates.length} candidates`);
  }
  return buildReport(objects, dimensions, { bucket });
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const endpoint = process.env.B2_ENDPOINT;
  const bucket = process.env.B2_BUCKET;
  if (!endpoint || !bucket || !process.env.B2_KEY_ID || !process.env.B2_APP_KEY) {
    console.error('ERROR: B2_ENDPOINT, B2_BUCKET, B2_KEY_ID and B2_APP_KEY are required');
    process.exit(2);
  }
  const region = /^https:\/\/s3\.([a-z0-9-]+)\.backblazeb2\.com\/?$/.exec(endpoint)?.[1];
  if (!region) {
    console.error('ERROR: B2_ENDPOINT must look like https://s3.<region>.backblazeb2.com');
    process.exit(2);
  }
  process.env.AWS_DEFAULT_REGION = region;
  process.env.AWS_ACCESS_KEY_ID = process.env.B2_KEY_ID;
  process.env.AWS_SECRET_ACCESS_KEY = process.env.B2_APP_KEY;
  process.env.AWS_EC2_METADATA_DISABLED = 'true';
  const exec = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const report = await audit({
    endpoint,
    bucket,
    prefix: arg('--prefix', ''),
    dimensionReads: Number(arg('--dimension-reads', '500')),
    exec,
    log: (m) => console.error(m),
  });
  const out = arg('--out', 'b2-inventory-audit.json');
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  const markdown = renderMarkdown(report);
  writeFileSync(out.replace(/\.json$/, '.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  console.log(markdown);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`ERROR: ${String(error?.message ?? error)}`);
    process.exit(1);
  });
}
