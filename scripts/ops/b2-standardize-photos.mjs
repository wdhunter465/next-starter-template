#!/usr/bin/env node
/**
 * B2 photo standardization (#5541, follows the audit in #5537). Brings stored photos to the upload
 * standard of #5526: JPEG, long edge at most 4000 px, under the 10 MiB limit.
 *
 * Default is a DRY RUN: it downloads each image, works out what would change, and writes nothing to
 * B2 or D1. With --apply it also
 *   1. saves the original of every changed object to --backup-dir (the workflow uploads it as an artifact),
 *   2. JPEG already at the right key: overwrites the object in place (same key, same URL),
 *   3. PNG / WebP: writes `<name>.jpg`, repoints the D1 `photos` row (photo_id and url) to it, checks the
 *      row now points there, and only then deletes the old object (so the daily sync cannot re-add it).
 *
 * Transparent PNGs are flattened onto white. Anything that cannot be standardized is listed under "Needs attention" with the reason, so the person
 * can see the current photo and re-upload it. Objects with no D1 `photos` row are never touched when
 * applying (logos and site assets live in the same bucket).
 *
 * Env: B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY. With --apply also CLOUDFLARE_API_TOKEN,
 * CLOUDFLARE_ACCOUNT_ID and D1_DATABASE_NAME (or D1_DATABASE_ID).
 * Options: --apply, --prefix P, --limit N (first N objects, for a trial), --backup-dir DIR, --out FILE.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extensionOf, listObjects, MAX_LONG_EDGE_PX, UPLOAD_LIMIT_BYTES } from './b2-inventory-audit.mjs';

export const QUALITY_STEPS = [90, 85, 80, 70, 60];
export const TARGET_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);

export function jpgKeyFor(key) {
  const dot = key.lastIndexOf('.');
  const slash = key.lastIndexOf('/');
  return `${dot > slash ? key.slice(0, dot) : key}.jpg`;
}

/** Decide what to do with one object from its facts. Pure. */
export function planFor({ key, bytes, format, width, height, objectKeys, d1Matched }) {
  const ext = extensionOf(key);
  const longEdge = Math.max(width, height);
  const isJpegKey = ext === 'jpg' || ext === 'jpeg';
  const compliant = isJpegKey && format === 'jpeg' && longEdge <= MAX_LONG_EDGE_PX && bytes <= UPLOAD_LIMIT_BYTES;
  if (compliant) return { action: 'ok' };
  if (d1Matched === false) return { action: 'skip', flag: 'No photos row in D1: left alone (site asset or unsynced file)' };
  if (isJpegKey && format === 'jpeg') return { action: 'rewrite', newKey: key };
  const newKey = jpgKeyFor(key);
  if (objectKeys.has(newKey) && newKey !== key) return { action: 'flag', flag: `Cannot convert: ${newKey} already exists in B2` };
  return { action: 'convert', newKey };
}

const sq = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** SQL that repoints a photos row from one key to another. instr(), not LIKE: `_` is a LIKE wildcard. */
export function repointSql(oldKey, newKey) {
  const enc = (k) => k.split('/').map(encodeURIComponent).join('/');
  return (
    `UPDATE photos SET ` +
    `url = replace(replace(url, ${sq(enc(oldKey))}, ${sq(enc(newKey))}), ${sq(oldKey)}, ${sq(newKey)}), ` +
    `photo_id = CASE WHEN photo_id = ${sq(oldKey)} THEN ${sq(newKey)} ELSE photo_id END ` +
    `WHERE photo_id = ${sq(oldKey)} OR instr(url, ${sq(oldKey)}) > 0 OR instr(url, ${sq(enc(oldKey))}) > 0;`
  );
}

export function d1CountSql(key) {
  const enc = key.split('/').map(encodeURIComponent).join('/');
  return `SELECT count(*) AS n FROM photos WHERE photo_id = ${sq(key)} OR instr(url, ${sq(key)}) > 0 OR instr(url, ${sq(enc)}) > 0;`;
}

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    throw new Error('sharp is not installed (run npm ci first)');
  }
}

/** Convert to a capped JPEG, lowering quality until it fits. Returns null buffer when it cannot. */
export async function convertBuffer(sharp, input) {
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  let last = null;
  for (const quality of QUALITY_STEPS) {
    const { data, info } = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_LONG_EDGE_PX, height: MAX_LONG_EDGE_PX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    last = { data, info, quality };
    if (data.length <= TARGET_MAX_BYTES) break;
  }
  return { format: meta.format, width, height, out: last };
}

/** Run an aws call, retrying twice; errors carry the tail of stderr, not the command line. */
export function execRetry(exec, cmd, args, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return exec(cmd, args);
    } catch (error) {
      last = error;
    }
  }
  const detail = String(last?.stderr || last?.message || last).trim().split('\n').pop().slice(-200);
  throw new Error(detail);
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

export async function run({ endpoint, bucket, prefix = '', limit = 0, apply = false, backupDir, exec, d1, log = () => {} }) {
  const sharp = await loadSharp();
  let objects = listObjects({ endpoint, bucket, prefix, exec }).filter((o) => IMAGE_EXT.has(extensionOf(o.key)));
  if (limit > 0) objects = objects.slice(0, limit);
  const objectKeys = new Set(listObjects({ endpoint, bucket, prefix: '', exec }).map((o) => o.key));
  const tmp = mkdtempSync(join(tmpdir(), 'b2-std-'));
  const rows = [];
  for (const { key, size } of objects) {
    const row = { key, before: size, action: 'ok', flag: null };
    try {
      const src = join(tmp, 'src.bin');
      execRetry(exec, 'aws', ['s3api', 'get-object', '--endpoint-url', endpoint, '--bucket', bucket, '--key', key, src]);
      const input = readFileSync(src);
      const probe = await sharp(input, { failOn: 'none' }).metadata();
      const swap = (probe.orientation ?? 1) >= 5;
      const w = swap ? probe.height : probe.width;
      const h = swap ? probe.width : probe.height;
      const flattened = probe.format !== 'jpeg' && probe.hasAlpha ? (await sharp(input, { failOn: 'none' }).stats()).isOpaque === false : false;
      let d1Matched;
      if (apply && d1) d1Matched = d1.count(key) > 0;
      const plan = planFor({ key, bytes: size, format: probe.format, width: w, height: h, objectKeys, d1Matched });
      if (flattened) row.note = 'transparency flattened onto white';
      Object.assign(row, { action: plan.action, flag: plan.flag ?? null, newKey: plan.newKey, from: `${w}x${h} ${probe.format}` });
      if (plan.action === 'rewrite' || plan.action === 'convert') {
        const c = await convertBuffer(sharp, input);
        const bytes = c.out.data.length;
        row.to = `${c.out.info.width}x${c.out.info.height} jpeg q${c.out.quality}`;
        row.after = bytes;
        if (bytes > UPLOAD_LIMIT_BYTES) {
          row.action = 'flag';
          row.flag = `Still ${mb(bytes)} after conversion at quality ${c.out.quality}`;
        } else if (apply) {
          if (backupDir) {
            const dest = join(backupDir, key);
            mkdirSync(dirname(dest), { recursive: true });
            writeFileSync(dest, input);
          }
          const outFile = join(tmp, 'out.jpg');
          writeFileSync(outFile, c.out.data);
          const newKey = plan.newKey;
          exec('aws', ['s3api', 'put-object', '--endpoint-url', endpoint, '--bucket', bucket, '--key', newKey, '--body', outFile, '--content-type', 'image/jpeg']);
          if (plan.action === 'convert') {
            d1.run(repointSql(key, newKey));
            if (d1.count(newKey) < 1) throw new Error('D1 row did not move to the new key; old object kept');
            exec('aws', ['s3api', 'delete-object', '--endpoint-url', endpoint, '--bucket', bucket, '--key', key]);
          }
          row.applied = true;
        }
      }
    } catch (error) {
      row.action = 'flag';
      row.flag = `Could not process: ${String(error?.message ?? error).slice(0, 220)}`;
    }
    rows.push(row);
    log(`${row.action.padEnd(8)} ${key}${row.flag ? `  [${row.flag}]` : ''}`);
  }
  return { apply, bucket, rows };
}

export function renderMarkdown(result) {
  const rows = result.rows;
  const by = (a) => rows.filter((r) => r.action === a);
  const saved = rows.reduce((n, r) => n + (r.after && r.before ? r.before - r.after : 0), 0);
  const lines = [
    `# B2 photo standardization (${result.apply ? 'APPLIED' : 'dry run, nothing written'})`,
    '',
    `Checked ${rows.length} images. Already compliant: ${by('ok').length}. ` +
      `${result.apply ? 'Rewritten in place' : 'Would rewrite in place'}: ${by('rewrite').length}. ` +
      `${result.apply ? 'Converted to .jpg' : 'Would convert to .jpg'}: ${by('convert').length}. ` +
      `Left alone: ${by('skip').length}. **Needs attention: ${by('flag').length}.** ` +
      `Space ${result.apply ? 'saved' : 'saved if applied'}: ${mb(Math.max(saved, 0))}.`,
    '',
  ];
  const table = (title, list, cols) => {
    if (!list.length) return;
    lines.push(`## ${title} (${list.length})`, '', '| File | ' + cols.map((c) => c[0]).join(' | ') + ' |', '| --- | ' + cols.map(() => '---').join(' | ') + ' |');
    for (const r of list) lines.push(`| \`${r.key}\` | ${cols.map((c) => c[1](r)).join(' | ')} |`);
    lines.push('');
  };
  table('Needs attention: re-upload these', by('flag'), [['Reason', (r) => r.flag], ['Current', (r) => `${r.from ?? '?'}, ${mb(r.before)}`]]);
  table('Rewritten in place', by('rewrite'), [['From', (r) => `${r.from}, ${mb(r.before)}`], ['To', (r) => `${r.to}, ${mb(r.after ?? 0)}`]]);
  table('Converted to JPEG', by('convert'), [['New key', (r) => `\`${r.newKey}\``], ['From', (r) => `${r.from}, ${mb(r.before)}`], ['To', (r) => `${r.to}, ${mb(r.after ?? 0)}`]]);
  table('Left alone', by('skip'), [['Reason', (r) => r.flag]]);
  return `${lines.join('\n')}\n`;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function makeD1(exec) {
  const db = process.env.D1_DATABASE_NAME || process.env.D1_DATABASE_ID;
  if (!db) throw new Error('D1_DATABASE_NAME (or D1_DATABASE_ID) is required with --apply');
  const wrangler = (args) => exec('npx', ['--no-install', 'wrangler', 'd1', 'execute', db, '--remote', ...args]);
  return {
    run: (sql) => wrangler(['--command', sql]),
    count: (key) => {
      const out = wrangler(['--json', '--command', d1CountSql(key)]);
      return Number(JSON.parse(out.slice(out.indexOf('[')))[0]?.results?.[0]?.n ?? 0);
    },
  };
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
  const apply = process.argv.includes('--apply');
  const result = await run({
    endpoint,
    bucket,
    prefix: arg('--prefix', ''),
    limit: Number(arg('--limit', '0')),
    apply,
    backupDir: arg('--backup-dir', ''),
    exec,
    d1: apply ? makeD1(exec) : null,
    log: (m) => console.error(m),
  });
  const out = arg('--out', 'b2-standardize.json');
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  const markdown = renderMarkdown(result);
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
