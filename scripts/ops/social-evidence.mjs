#!/usr/bin/env node
/**
 * social-evidence.mjs (#5201, child of #5197; design docs/reference/operations/social-post-audit-design.md)
 *
 * The one place that builds, validates and appends a social post evidence record, so every posting
 * path (the X job, the Zapier read-back, an ad hoc post) writes the same shape.
 *
 * Pure: no network call, no file write, no D1 write, no secret. Day documents are plain objects;
 * appendToDay returns a new document and never changes or removes an existing record.
 *
 * Day file path: data/social-audit/<year>/<month>/<date>.json (by New York date).
 */

import { createHash } from 'node:crypto';

export const SCHEMA = 'social_post_evidence/1';
export const DAY_SCHEMA = 'social_audit_day/1';
export const PLATFORMS = ['x', 'facebook', 'instagram', 'pinterest'];
export const STATUSES = ['handed_off', 'confirmed', 'failed', 'missing', 'not_eligible'];
export const ORIGINS = ['queue', 'ad_hoc'];
export const OUTCOMES = ['ok', 'error', 'handed_off'];

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const OFFSET_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const AD_HOC_ID = /^adhoc-\d{4}-\d{2}-\d{2}-\d+$/;

export function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function nyParts(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`,
  };
}

/** The New York calendar date (YYYY-MM-DD) of an ISO instant. */
export function newYorkDate(iso) {
  return nyParts(Date.parse(iso)).date;
}

/** An ISO instant as New York local time with its offset, for example 2026-11-12T10:14:02-05:00. */
export function toNewYorkIso(iso) {
  const ms = Date.parse(iso);
  const { date, time } = nyParts(ms);
  const wallAsUtc = Date.parse(`${date}T${time}Z`);
  const offsetMin = Math.round((wallAsUtc - Math.floor(ms / 1000) * 1000) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${date}T${time}${sign}${hh}:${mm}`;
}

/** data/social-audit/<year>/<month>/<date>.json for a YYYY-MM-DD date. */
export function dayFilePath(date) {
  if (!DATE_ONLY.test(String(date))) throw new Error(`date must be YYYY-MM-DD, got ${date}`);
  const [year, month] = date.split('-');
  return `data/social-audit/${year}/${month}/${date}.json`;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

/** Every problem with a record, as strings. An empty array means the record is valid. */
export function validateEvidenceRecord(record) {
  const problems = [];
  if (!isObject(record)) return ['record is not an object'];

  if (record.schema !== SCHEMA) problems.push(`schema must be ${SCHEMA}`);
  if (!isNonEmptyString(record.post_id)) problems.push('post_id is required');
  if (!PLATFORMS.includes(record.platform)) problems.push(`platform must be one of ${PLATFORMS.join(', ')}`);
  if (!isPositiveInt(record.version)) problems.push('version must be a positive integer');
  if (!STATUSES.includes(record.status)) problems.push(`status must be one of ${STATUSES.join(', ')}`);
  if (!ORIGINS.includes(record.origin ?? 'queue')) problems.push(`origin must be one of ${ORIGINS.join(', ')}`);

  if (isPositiveInt(record.version) && record.version > 1 && record.supersedes !== record.version - 1) {
    problems.push('a version above 1 must set supersedes to the previous version');
  }

  const origin = record.origin ?? 'queue';
  if (isNonEmptyString(record.post_id)) {
    if (origin === 'ad_hoc') {
      if (!AD_HOC_ID.test(record.post_id)) problems.push('an ad hoc post_id must look like adhoc-YYYY-MM-DD-<n>');
      if (!isNonEmptyString(record.note)) problems.push('an ad hoc post needs a note saying who asked for it and why');
    } else if (record.post_id.startsWith('adhoc-')) {
      problems.push('a post_id starting with adhoc- must have origin ad_hoc');
    }
  }

  if (!OFFSET_ISO.test(String(record.scheduled_for ?? ''))) {
    problems.push('scheduled_for must be an ISO time with an offset');
  }

  if (!isNonEmptyString(record.text)) {
    problems.push('text is required');
  } else if (record.text_sha256 !== sha256Hex(record.text)) {
    problems.push('text_sha256 does not match text');
  }

  const photo = record.photo;
  if (!isObject(photo)) {
    problems.push('photo is required');
  } else {
    if (photo.photo_id === undefined || photo.photo_id === null) problems.push('photo.photo_id is required');
    if (!isNonEmptyString(photo.variant)) problems.push('photo.variant is required');
    if (!SHA256.test(String(photo.image_sha256 ?? ''))) problems.push('photo.image_sha256 must be a SHA-256 hex digest');
    if (!isPositiveInt(photo.width) || !isPositiveInt(photo.height)) problems.push('photo.width and photo.height must be positive integers');
    if (typeof photo.alt_text !== 'string') problems.push('photo.alt_text is required');
  }

  const attempts = record.attempts;
  if (!Array.isArray(attempts)) {
    problems.push('attempts must be an array');
  } else {
    attempts.forEach((a, i) => {
      if (!isObject(a)) {
        problems.push(`attempts[${i}] is not an object`);
        return;
      }
      if (!UTC_ISO.test(String(a.at_utc ?? ''))) problems.push(`attempts[${i}].at_utc must be a UTC ISO time ending in Z`);
      if (!isNonEmptyString(a.by)) problems.push(`attempts[${i}].by is required`);
      if (!OUTCOMES.includes(a.outcome)) problems.push(`attempts[${i}].outcome must be one of ${OUTCOMES.join(', ')}`);
      if (a.outcome === 'error' && !isNonEmptyString(a.detail)) problems.push(`attempts[${i}] is an error and needs detail`);
    });
  }

  const hasAttempt = (outcome) => Array.isArray(attempts) && attempts.some((a) => a?.outcome === outcome);
  const platformRecord = record.platform_record;
  switch (record.status) {
    case 'confirmed':
      if (!isObject(platformRecord) || !isNonEmptyString(platformRecord.post_id) || !UTC_ISO.test(String(platformRecord.created_at_utc ?? ''))) {
        problems.push('a confirmed record needs platform_record.post_id and platform_record.created_at_utc');
      }
      break;
    case 'failed':
      if (!hasAttempt('error')) problems.push('a failed record needs at least one attempt with outcome error');
      break;
    case 'missing':
      if (!hasAttempt('handed_off')) problems.push('a missing record needs a handed_off attempt');
      break;
    case 'handed_off':
      if (!hasAttempt('handed_off')) problems.push('a handed_off record needs a handed_off attempt');
      break;
    case 'not_eligible':
      if (!isNonEmptyString(record.note)) problems.push('a not_eligible record needs a note with the reason');
      break;
    default:
      break;
  }

  if (isObject(platformRecord) && platformRecord.created_at_utc) {
    if (!UTC_ISO.test(platformRecord.created_at_utc)) {
      problems.push('platform_record.created_at_utc must be a UTC ISO time ending in Z');
    } else if (platformRecord.created_at_new_york !== toNewYorkIso(platformRecord.created_at_utc)) {
      problems.push('platform_record.created_at_new_york does not match created_at_utc');
    }
  }

  const verified = record.verified;
  if (!isObject(verified) || !DATE_ONLY.test(String(verified.on ?? '')) || !isNonEmptyString(verified.by) || !isNonEmptyString(verified.method)) {
    problems.push('verified needs on (YYYY-MM-DD), by and method');
  }

  if (record.anomalies !== undefined && !Array.isArray(record.anomalies)) problems.push('anomalies must be an array');

  return problems;
}

/**
 * Builds a record. `post` is a queue entry (id, publish_at, text, photo_id, alt_text). `photo`
 * supplies what was measured on the bytes sent: image_url, image_sha256, image_bytes, width, height
 * and optionally variant (default "original"). Throws when the result is not valid.
 */
export function buildEvidenceRecord({
  post,
  platform,
  status,
  attempts = [],
  platformRecord = null,
  handoff,
  anomalies,
  note,
  photo,
  verified,
  origin = 'queue',
  version = 1,
}) {
  const record = {
    schema: SCHEMA,
    post_id: post.id,
    platform,
    origin,
    version,
    ...(version > 1 ? { supersedes: version - 1 } : {}),
    scheduled_for: post.publish_at,
    text: post.text,
    text_sha256: sha256Hex(post.text),
    photo: {
      photo_id: post.photo_id,
      variant: photo?.variant ?? 'original',
      image_url: photo?.image_url,
      image_sha256: photo?.image_sha256,
      image_bytes: photo?.image_bytes,
      width: photo?.width,
      height: photo?.height,
      alt_text: post.alt_text,
    },
    status,
    attempts,
    platform_record: platformRecord
      ? {
          ...platformRecord,
          ...(platformRecord.created_at_utc && !platformRecord.created_at_new_york
            ? { created_at_new_york: toNewYorkIso(platformRecord.created_at_utc) }
            : {}),
        }
      : null,
    ...(handoff ? { handoff } : {}),
    ...(anomalies && anomalies.length ? { anomalies } : {}),
    ...(note ? { note } : {}),
    verified,
  };
  const problems = validateEvidenceRecord(record);
  if (problems.length) throw new Error(`invalid evidence record: ${problems.join('; ')}`);
  return record;
}

/** A new, empty day document for a YYYY-MM-DD date. */
export function emptyDay(date) {
  if (!DATE_ONLY.test(String(date))) throw new Error(`date must be YYYY-MM-DD, got ${date}`);
  return { schema: DAY_SCHEMA, date, records: [] };
}

/** The next version number for a post on a platform in a day document (1 when there is none). */
export function nextVersion(dayDoc, postId, platform) {
  const versions = (dayDoc?.records ?? [])
    .filter((r) => r.post_id === postId && r.platform === platform)
    .map((r) => r.version);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

/** The latest version of each post and platform in a day document. */
export function latestRecords(dayDoc) {
  const latest = new Map();
  for (const r of dayDoc?.records ?? []) {
    const key = `${r.post_id}|${r.platform}`;
    const seen = latest.get(key);
    if (!seen || r.version > seen.version) latest.set(key, r);
  }
  return [...latest.values()];
}

/**
 * Returns a new day document with the record appended. Existing records are never changed or
 * removed. A record must be valid, belong to the document's New York date, and carry the next
 * version for its post and platform (a retry or correction is a new version).
 */
export function appendToDay(dayDoc, record) {
  const problems = validateEvidenceRecord(record);
  if (problems.length) throw new Error(`invalid evidence record: ${problems.join('; ')}`);

  const date = dayDoc?.date ?? newYorkDate(record.scheduled_for);
  const base = dayDoc ?? emptyDay(date);
  if (base.schema !== DAY_SCHEMA || !Array.isArray(base.records)) throw new Error('not a social_audit_day/1 document');
  if (newYorkDate(record.scheduled_for) !== base.date) {
    throw new Error(`record is for ${newYorkDate(record.scheduled_for)} but the day document is ${base.date}`);
  }

  const expected = nextVersion(base, record.post_id, record.platform);
  if (record.version !== expected) {
    const dup = base.records.some((r) => r.post_id === record.post_id && r.platform === record.platform && r.version === record.version);
    throw new Error(dup
      ? `version ${record.version} of ${record.post_id}/${record.platform} already exists; append the next version`
      : `version must be ${expected} for ${record.post_id}/${record.platform}, got ${record.version}`);
  }

  return { ...base, records: [...base.records.map((r) => structuredClone(r)), structuredClone(record)] };
}
