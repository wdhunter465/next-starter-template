#!/usr/bin/env node
/**
 * b2-cors-rules.mjs (#5131)
 *
 * Reads, and optionally sets, the CORS rules of the private B2 bucket so the admin
 * rendition tool (which loads a signed image link into a canvas with
 * crossOrigin="anonymous") can read it from www.lougehrigfanclub.com. Plain <img> tags do
 * not need CORS; only the in-browser fetch does.
 *
 * Dry run by default (APPLY != "true"): prints the current rules and the rule that would be
 * added or replaced; writes nothing. Apply uses b2_update_bucket and keeps every existing
 * rule whose name is not ours. Needs the writeBuckets capability on the key.
 *
 * Never prints a key id, an application key or an authorization token.
 *
 * Required env: B2_KEY_ID, B2_APP_KEY. Optional: APPLY (true|false).
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const OUR_RULE = Object.freeze({
  corsRuleName: 'lgfc-site-images',
  allowedOrigins: ['https://www.lougehrigfanclub.com', 'https://lougehrigfanclub.com'],
  allowedOperations: ['s3_get', 's3_head', 'b2_download_file_by_name'],
  allowedHeaders: ['range'],
  exposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
  maxAgeSeconds: 3600,
});

/** Our rule replaces a rule with the same name; every other existing rule is kept. */
export function mergeCorsRules(existing, ours = OUR_RULE) {
  const kept = (Array.isArray(existing) ? existing : []).filter((rule) => rule?.corsRuleName !== ours.corsRuleName);
  return [...kept, { ...ours, allowedOrigins: [...ours.allowedOrigins], allowedOperations: [...ours.allowedOperations] }];
}

/** True when an existing rule already equals ours (nothing to change). */
export function hasOurRule(existing, ours = OUR_RULE) {
  const found = (Array.isArray(existing) ? existing : []).find((rule) => rule?.corsRuleName === ours.corsRuleName);
  if (!found) return false;
  const same = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
  return (
    same(found.allowedOrigins, ours.allowedOrigins) &&
    same(found.allowedOperations, ours.allowedOperations) &&
    same(found.allowedHeaders, ours.allowedHeaders) &&
    same(found.exposeHeaders, ours.exposeHeaders) &&
    Number(found.maxAgeSeconds) === ours.maxAgeSeconds
  );
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function curl(args, input) {
  try {
    const out = execFileSync('curl', ['-sS', ...args], { encoding: 'utf8', input, maxBuffer: 1024 * 1024 * 16 });
    return JSON.parse(out || '{}');
  } catch (error) {
    return { status: 0, code: 'curl_failed', message: String(error.message).split('\n')[0] };
  }
}

export async function main(env = process.env) {
  const keyId = String(env.B2_KEY_ID ?? '').trim();
  const appKey = String(env.B2_APP_KEY ?? '').trim();
  const apply = String(env.APPLY || 'false').toLowerCase() === 'true';
  if (!keyId || !appKey) fail('B2_KEY_ID and B2_APP_KEY are required');

  const auth = curl([
    '-H',
    `Authorization: Basic ${Buffer.from(`${keyId}:${appKey}`).toString('base64')}`,
    'https://api.backblazeb2.com/b2api/v3/b2_authorize_account',
  ]);
  const storage = auth?.apiInfo?.storageApi;
  if (!storage?.apiUrl || !auth.authorizationToken) fail(`b2_authorize_account failed (${auth?.code ?? 'unknown'})`);
  const caps = storage.capabilities ?? [];
  const bucketId = storage.bucketId;
  const accountId = auth.accountId;
  if (!bucketId) fail('the key is not restricted to one bucket; refusing to guess which bucket to change');

  const headers = ['-H', `Authorization: ${auth.authorizationToken}`, '-H', 'Content-Type: application/json'];
  const listed = curl([...headers, '-X', 'POST', '--data-binary', '@-', `${storage.apiUrl}/b2api/v3/b2_list_buckets`], JSON.stringify({ accountId, bucketId }));
  const bucket = listed?.buckets?.[0];
  if (!bucket) fail(`b2_list_buckets failed (${listed?.code ?? 'unknown'})`);

  const existing = bucket.corsRules ?? [];
  const merged = mergeCorsRules(existing);
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    bucket_name: bucket.bucketName,
    key_has_writeBuckets: caps.includes('writeBuckets'),
    existing_rules: existing.map((r) => ({
      name: r.corsRuleName,
      origins: r.allowedOrigins,
      operations: r.allowedOperations,
      headers: r.allowedHeaders,
      maxAgeSeconds: r.maxAgeSeconds,
    })),
    our_rule_already_present: hasOurRule(existing),
    rule_to_set: OUR_RULE,
  };

  if (!apply) {
    console.log(JSON.stringify({ ...report, applied: false }, null, 2));
    return;
  }
  if (!report.key_has_writeBuckets) {
    console.log(JSON.stringify({ ...report, applied: false }, null, 2));
    fail('the key has no writeBuckets capability');
  }
  if (report.our_rule_already_present) {
    console.log(JSON.stringify({ ...report, applied: false, note: 'rule already present; nothing to change' }, null, 2));
    return;
  }

  const updated = curl(
    [...headers, '-X', 'POST', '--data-binary', '@-', `${storage.apiUrl}/b2api/v3/b2_update_bucket`],
    JSON.stringify({ accountId, bucketId, corsRules: merged, ifRevisionIs: bucket.revision }),
  );
  if (!updated?.bucketId) fail(`b2_update_bucket failed (${updated?.code ?? 'unknown'}: ${updated?.message ?? ''})`);
  console.log(
    JSON.stringify(
      { ...report, applied: true, rules_after: (updated.corsRules ?? []).map((r) => r.corsRuleName), bucket_type: updated.bucketType },
      null,
      2,
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => fail(String(error?.message ?? error)));
}
