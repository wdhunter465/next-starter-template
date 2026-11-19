#!/usr/bin/env node
/**
 * social-evidence-adhoc.mjs (#5331)
 *
 * Builds one origin: ad_hoc social_post_evidence/1 record and, with --apply, sends it to
 * POST /api/social/evidence. Dry run is the default and performs no network call.
 *
 * Usage:
 *   node scripts/ops/social-evidence-adhoc.mjs --platform x --status confirmed --text "..." \
 *     --photo-id 123 --image-url https://... --image-sha256 <64 hex> --image-bytes 12345 \
 *     --width 1200 --height 800 --alt-text "..." --platform-post-id abc \
 *     --platform-created-at-utc 2026-11-18T15:00:00Z --note "Bill asked for ... because ..."
 *
 * Env for --apply: SCHEDULED_CONTENT_BRIDGE_TOKEN, optional BASE_URL.
 */

import { pathToFileURL } from 'node:url';
import { buildEvidenceRecord, newYorkDate, toNewYorkIso } from './social-evidence.mjs';

export const DEFAULT_BASE_URL = 'https://www.lougehrigfanclub.com';
const AD_HOC_ID = /^adhoc-\d{4}-\d{2}-\d{2}-(\d+)$/;

function takeValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

export function parseArgs(argv) {
  const options = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--base-url') options.baseUrl = takeValue(argv, i++, arg);
    else if (arg === '--date') options.date = takeValue(argv, i++, arg);
    else if (arg === '--sequence') options.sequence = Number(takeValue(argv, i++, arg));
    else if (arg === '--now') options.now = takeValue(argv, i++, arg);
    else if (arg === '--platform') options.platform = takeValue(argv, i++, arg);
    else if (arg === '--status') options.status = takeValue(argv, i++, arg);
    else if (arg === '--text') options.text = takeValue(argv, i++, arg);
    else if (arg === '--scheduled-for') options.scheduledFor = takeValue(argv, i++, arg);
    else if (arg === '--photo-id') options.photoId = Number(takeValue(argv, i++, arg));
    else if (arg === '--image-url') options.imageUrl = takeValue(argv, i++, arg);
    else if (arg === '--image-sha256') options.imageSha256 = takeValue(argv, i++, arg);
    else if (arg === '--image-bytes') options.imageBytes = Number(takeValue(argv, i++, arg));
    else if (arg === '--width') options.width = Number(takeValue(argv, i++, arg));
    else if (arg === '--height') options.height = Number(takeValue(argv, i++, arg));
    else if (arg === '--alt-text') options.altText = takeValue(argv, i++, arg);
    else if (arg === '--variant') options.variant = takeValue(argv, i++, arg);
    else if (arg === '--platform-post-id') options.platformPostId = takeValue(argv, i++, arg);
    else if (arg === '--platform-url') options.platformUrl = takeValue(argv, i++, arg);
    else if (arg === '--platform-created-at-utc') options.platformCreatedAtUtc = takeValue(argv, i++, arg);
    else if (arg === '--attempt-at-utc') options.attemptAtUtc = takeValue(argv, i++, arg);
    else if (arg === '--attempt-by') options.attemptBy = takeValue(argv, i++, arg);
    else if (arg === '--attempt-outcome') options.attemptOutcome = takeValue(argv, i++, arg);
    else if (arg === '--detail') options.detail = takeValue(argv, i++, arg);
    else if (arg === '--verified-by') options.verifiedBy = takeValue(argv, i++, arg);
    else if (arg === '--verified-method') options.verifiedMethod = takeValue(argv, i++, arg);
    else if (arg === '--note') options.note = takeValue(argv, i++, arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.sequence !== undefined && (!Number.isInteger(options.sequence) || options.sequence < 1)) {
    throw new Error('--sequence must be a positive integer');
  }
  return options;
}

function requireOption(options, key, name = key) {
  const value = options[key];
  if (value === undefined || value === null || value === '') throw new Error(`${name} is required`);
  return value;
}

function cleanBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function nextAdHocPostId(date, existingIds = []) {
  let next = 1;
  for (const id of existingIds) {
    const match = AD_HOC_ID.exec(String(id));
    if (match && id.startsWith(`adhoc-${date}-`)) next = Math.max(next, Number(match[1]) + 1);
  }
  return `adhoc-${date}-${next}`;
}

function attemptForStatus(status, options, nowIso) {
  if (status === 'not_eligible') return [];
  const outcome =
    options.attemptOutcome ?? (status === 'confirmed' ? 'ok' : status === 'failed' ? 'error' : 'handed_off');
  const attempt = {
    at_utc: options.attemptAtUtc ?? nowIso,
    by: options.attemptBy ?? 'ad hoc logging command',
    outcome,
  };
  if (options.detail) attempt.detail = options.detail;
  if (outcome === 'error' && !attempt.detail) throw new Error('--detail is required when the attempt outcome is error');
  return [attempt];
}

export function buildAdHocRecord(options) {
  const nowIso = new Date(options.now ? Date.parse(options.now) : Date.now()).toISOString();
  const date = options.date ?? newYorkDate(nowIso);
  const sequence = options.sequence ?? 1;
  const postId = `adhoc-${date}-${sequence}`;
  const status = requireOption(options, 'status', '--status');

  for (const key of ['platform', 'text', 'photoId', 'imageUrl', 'imageSha256', 'imageBytes', 'width', 'height', 'altText', 'note']) {
    requireOption(options, key, `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }

  const platformRecord =
    status === 'confirmed'
      ? {
          post_id: requireOption(options, 'platformPostId', '--platform-post-id'),
          url: options.platformUrl ?? null,
          created_at_utc: options.platformCreatedAtUtc ?? nowIso,
        }
      : null;

  const record = buildEvidenceRecord({
    origin: 'ad_hoc',
    post: {
      id: postId,
      publish_at: options.scheduledFor ?? toNewYorkIso(nowIso),
      text: options.text,
      photo_id: options.photoId,
      alt_text: options.altText,
    },
    platform: options.platform,
    status,
    attempts: attemptForStatus(status, options, nowIso),
    platformRecord,
    photo: {
      variant: options.variant ?? 'original',
      image_url: options.imageUrl,
      image_sha256: options.imageSha256,
      image_bytes: options.imageBytes,
      width: options.width,
      height: options.height,
    },
    verified: {
      on: newYorkDate(nowIso),
      by: options.verifiedBy ?? 'ad hoc logging command',
      method: options.verifiedMethod ?? 'manual ad hoc evidence entry',
    },
    note: options.note,
  });
  return record;
}

export async function findNextAdHocPostId({ date, baseUrl, token, fetchImpl = fetch }) {
  for (let n = 1; n < 1000; n += 1) {
    const id = `adhoc-${date}-${n}`;
    const res = await fetchImpl(`${baseUrl}/api/social/evidence?post_id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`could not read ${id}: HTTP ${res.status} ${body.error ?? ''}`.trim());
    if ((body.rows ?? []).length === 0) return id;
  }
  throw new Error(`no free ad hoc id found for ${date}`);
}

export async function run(env = process.env, argv = process.argv.slice(2), fetchImpl = fetch) {
  const options = parseArgs(argv);
  const baseUrl = cleanBaseUrl(options.baseUrl ?? env.BASE_URL);
  const token = String(env.SCHEDULED_CONTENT_BRIDGE_TOKEN ?? '').trim();
  const nowIso = new Date(options.now ? Date.parse(options.now) : Date.now()).toISOString();
  const date = options.date ?? newYorkDate(nowIso);

  if (options.apply) {
    if (!token) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required with --apply');
    if (options.sequence === undefined) {
      const nextId = await findNextAdHocPostId({ date, baseUrl, token, fetchImpl });
      options.sequence = Number(AD_HOC_ID.exec(nextId)?.[1]);
    }
  }

  const record = buildAdHocRecord({ ...options, now: nowIso, date });
  const target = `${baseUrl}/api/social/evidence`;
  if (!options.apply) return { mode: 'dry-run', target, record };

  const res = await fetchImpl(target, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`evidence endpoint returned HTTP ${res.status}: ${body.error ?? 'unexpected response'}`);
  return { mode: 'apply', target, record, response: body };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(`ERROR: ${String(error?.message ?? error)}`);
      process.exit(1);
    });
}
