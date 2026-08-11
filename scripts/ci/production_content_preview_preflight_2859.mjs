#!/usr/bin/env node
/**
 * #2859 Preview evidence preflight — corrected for shared D1 and Backblaze B2 (#3343).
 *
 * PR #3334's original design assumed an isolated Preview D1 database and a "PREVIEW_R2_*"
 * bucket existed to check. Neither assumption held: this repo's own canonical isolation
 * record (`scripts/ci/preview-isolation-manifest.json`, audit #2496, and
 * `docs/reference/platform/component-environment-isolation.md`, Last Reviewed 2026-07-21)
 * classifies the D1 database as `production-shared` — Preview and Production bind the
 * exact same `lgfc_lite` database and `database_id`. There is no separate Preview D1
 * database to provision an identity for (#3341, closed not_planned; #3343).
 *
 * Given that, this script deliberately does NOT attempt any D1 check. Reading the shared
 * `lgfc_lite` database and labeling the result "Preview evidence" would misrepresent real
 * Production member/auth/PII data as something lower-risk than it is — that is the
 * "workaround" #3343 explicitly says not to invent. The absence of a D1 check here is a
 * deliberate, permanent design decision, not a gap to fill by relaxing this file.
 *
 * The storage half is rebuilt against this repo's actual Backblaze B2 integration
 * (`functions/_lib/b2.ts`, `.github/workflows/b2-d1-daily-sync.yml`) instead of Cloudflare
 * R2, which PR #3334 incorrectly modeled on #3268's D1-backup-bucket precedent. B2 stores
 * public-facing media (photos, memorabilia), not private member data, and this repo's own
 * isolation manifest already classifies read-only B2 listing as safe (`b2-runtime-list`,
 * classification `read-only`). Like D1, there is no separate Preview B2 bucket recorded
 * anywhere in this repo, so this reads the one bucket that actually exists — the same one
 * Production uses — and reports it honestly as shared evidence, not fabricated
 * Preview-isolated evidence.
 *
 * Performs exactly one read-only check: a single bounded `ListObjectsV2` call (max 1000
 * keys, one page) against the Backblaze B2 bucket, using the same path-style request shape
 * as `functions/_lib/b2.ts`'s own `listB2Objects()`. Only the object count and truncation
 * flag are recorded — individual object keys/filenames are never persisted. There is no
 * `PutObject`/`DeleteObject`/D1-write code path anywhere in this file.
 *
 * XML counting is local (not imported from `b2.ts`) because `b2.ts` imports `./aws4fetch`
 * without a file extension, which resolves in the Workers/Next pipeline but fails under
 * plain Node used by scripts/ci/** (#3346 live run ERR_MODULE_NOT_FOUND). Same approach as
 * `d1_backup_r2_phase1_preflight_3268.mjs`.
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY — the existing, already-approved
 *   Backblaze B2 credentials this repo's own `.github/workflows/b2-d1-daily-sync.yml`
 *   already uses in production. No new secret is introduced by this script.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AwsClient } from '../../functions/_lib/aws4fetch.ts';
import { redactSecrets, extractS3ErrorCode } from './d1_backup_r2_phase1_preflight_3268.mjs';

export const RESULT_JSON_PATH = 'production-content-preview-preflight-2859-result.json';
export const RESULT_MD_PATH = 'production-content-preview-preflight-2859-result.md';

export function requireEnv(env = process.env) {
  return ['B2_ENDPOINT', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY'].filter((name) => !env[name]);
}

export function extractIsTruncated(xml) {
  const match = String(xml || '').match(/<IsTruncated>\s*(true|false)\s*<\/IsTruncated>/i);
  return Boolean(match && match[1].toLowerCase() === 'true');
}

/**
 * Count ListObjectsV2 <Contents> entries without retaining keys (privacy-safe).
 * Self-contained duplicate of the count half of b2.ts parseListObjectsV2Xml.
 */
export function countListObjectsV2Contents(xml) {
  const parts = String(xml || '').split('<Contents>');
  return Math.max(0, parts.length - 1);
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- production-content-preview-preflight-2859 -->',
    '## #2859 Preview evidence preflight — corrected for shared D1 and Backblaze B2 (#3343)',
    '',
    `- Checked at: ${result.checkedAt}`,
    '',
    '### D1 — no evidence collected (by design, not a failure)',
    '',
    "Per #3341/#3343: this repo's own canonical isolation record (`scripts/ci/preview-isolation-manifest.json`, `docs/reference/platform/component-environment-isolation.md`) classifies Preview D1 as `production-shared` — Preview and Production use the same `lgfc_lite` database and `database_id`. No isolated Preview D1 database exists to check. This script does not read `lgfc_lite` and label it \"Preview evidence,\" since that would misrepresent real Production member/auth/PII data. **D1 evidence for #2859 criterion 7 remains an open infrastructure/Product decision** (provision a genuinely isolated Preview D1 database, or accept this evidence gap) — not something this preflight can safely resolve on its own.",
    '',
    '### Backblaze B2 — reachability (object count only, no keys/filenames recorded)',
    '',
    "This checks the one Backblaze B2 bucket this repository actually uses — the same bucket Production reads and writes via `functions/_lib/b2.ts` and `.github/workflows/b2-d1-daily-sync.yml`. No separate Preview B2 bucket is recorded anywhere in this repo either, so this is shared-bucket evidence, reported honestly as such rather than as fabricated Preview-isolated evidence.",
    '',
    `- Reachable: ${result.b2.reachable ? 'YES' : 'NO'}${result.b2.failureReason ? ` (${result.b2.failureReason})` : ''}`,
    result.b2.reachable
      ? `- Object count (first page, max 1000): ${result.b2.objectCount}${result.b2.truncated ? '+' : ''}`
      : '',
    '',
    '### What this does and does not establish',
    '',
    "This confirms Backblaze B2 read reachability only — the same low-risk, already-accepted read-only access pattern this repo's own runtime code (`b2-runtime-list`, classified `read-only`) already performs. It does **not** establish isolated Preview evidence for either D1 or B2 (neither has a separate Preview identity today), does not satisfy #2859 criterion 3 (real D1/B2 population), and does not advance #2780's entry gate. Gate 1 remains HOLD; Gate 2 remains NO-GO.",
  ].filter((line) => line !== '');
  return lines.join('\n');
}

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No write of any kind was attempted.');
  process.exitCode = 1;
}

export async function main() {
  const missing = requireEnv(process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  const endpoint = process.env.B2_ENDPOINT.replace(/\/$/, '');
  const bucket = process.env.B2_BUCKET;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APP_KEY;
  const redact = (text) => redactSecrets(text, [endpoint, bucket, accessKeyId, secretAccessKey]);

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken: undefined,
    service: 's3',
    region: undefined,
    cache: undefined,
    retries: 2,
    initRetryMs: undefined,
  });

  const pathBucket = bucket.split('/').map(encodeURIComponent).join('/');
  const qs = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
  const listUrl = `${endpoint}/${pathBucket}?${qs.toString()}`;

  const b2 = { reachable: false, objectCount: null, truncated: false, failureReason: '' };
  try {
    const res = await aws.fetch(listUrl, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      const code = extractS3ErrorCode(text);
      b2.failureReason = code ? `HTTP ${res.status}: ${code}` : `HTTP ${res.status}`;
    } else {
      const xml = await res.text();
      b2.reachable = true;
      b2.objectCount = countListObjectsV2Contents(xml);
      b2.truncated = extractIsTruncated(xml);
    }
  } catch (error) {
    b2.failureReason = redact(error.message || 'fetch failed');
  }

  const result = { checkedAt: new Date().toISOString(), b2 };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  console.log(`OK: B2 reachable=${b2.reachable}, objectCount=${b2.objectCount ?? 'n/a'}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
