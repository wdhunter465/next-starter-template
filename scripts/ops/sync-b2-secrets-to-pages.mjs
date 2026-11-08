#!/usr/bin/env node
/**
 * sync-b2-secrets-to-pages.mjs (#5131)
 *
 * Copies the four B2 settings from GitHub Actions secrets into Cloudflare Pages
 * secrets for one environment, so the Pages Functions can sign image links for the
 * private B2 bucket. The GitHub pair is the one the daily b2-s3-smoke-test uses.
 *
 * Dry run by default (APPLY != "true"): validates the values and reads the current
 * Pages state, and writes nothing. Apply writes with `wrangler pages secret put`, which
 * is additive (it never replaces other Pages secrets).
 *
 * Never prints a key id value, an application key, or any secret. It prints yes/no and
 * length facts, the bucket name and the endpoint host (neither is a secret).
 *
 * Required env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, B2_ENDPOINT, B2_BUCKET,
 *   B2_KEY_ID, B2_APP_KEY
 * Optional: CLOUDFLARE_PROJECT_NAME (default next-starter-template),
 *   B2_TARGET_ENV (production|preview, default production), APPLY (true|false)
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** https origin of a B2 S3 endpoint; tolerates a bare host, http:// and a trailing path. */
export function normalizeEndpoint(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed.replace(/^http:\/\//i, 'https://') : `https://${trimmed}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return '';
  }
}

/**
 * Yes/no facts about the GitHub values, and the reasons an apply must be refused.
 * Pure: takes strings, returns facts, never echoes a key or a secret.
 */
export function checkB2Values({ endpoint, bucket, keyId, appKey }) {
  const normalized = normalizeEndpoint(endpoint);
  const host = normalized ? new URL(normalized).hostname : '';
  const region = host.match(/^s3\.([^.]+)\.backblazeb2\.com$/)?.[1] ?? null;
  const id = String(keyId ?? '').trim();
  const key = String(appKey ?? '').trim();
  const name = String(bucket ?? '').trim();

  const facts = {
    endpoint_normalized_host_shape_ok: region !== null,
    region,
    bucket_looks_like_bucket_id: /^[0-9a-f]{24}$/.test(name),
    bucket_contains_slash: name.includes('/'),
    bucket_present: name.length > 0,
    key_id_length: id.length,
    key_id_looks_like_master_account_id: /^[0-9a-f]{12}$/.test(id),
    key_id_looks_like_application_key_id: /^00\d[0-9a-f]{12}\d{10}$/.test(id) || (id.length === 25 && id.startsWith('00')),
    app_key_length: key.length,
    app_key_looks_like_a_key_id: /^00\d[0-9a-f]{12}\d+$/.test(key) && key.length <= 26,
    app_key_present: key.length > 0,
  };

  const refusals = [];
  if (!facts.endpoint_normalized_host_shape_ok) refusals.push('B2_ENDPOINT is not an s3.<region>.backblazeb2.com host');
  if (!facts.bucket_present) refusals.push('B2_BUCKET is empty');
  if (facts.bucket_looks_like_bucket_id) refusals.push('B2_BUCKET looks like a bucket id, not the bucket name');
  if (facts.bucket_contains_slash) refusals.push('B2_BUCKET contains a slash');
  if (facts.key_id_looks_like_master_account_id) refusals.push('B2_KEY_ID looks like the master key (12-character account id)');
  if (id.length === 0) refusals.push('B2_KEY_ID is empty');
  if (!facts.app_key_present) refusals.push('B2_APP_KEY is empty');
  if (facts.app_key_looks_like_a_key_id) refusals.push('B2_APP_KEY looks like a key id, not an application key secret');
  return { facts, refusals, normalizedEndpoint: normalized };
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function curlJson(args, input) {
  try {
    const out = execFileSync('curl', args, { encoding: 'utf8', input, maxBuffer: 1024 * 1024 * 32 });
    return JSON.parse(out || '{}');
  } catch (error) {
    return { success: false, errors: [{ message: String(error.message).split('\n')[0] }] };
  }
}

/** b2_authorize_account with the GitHub pair: proves the pair is valid and lists capabilities. No secret printed. */
function authorizeB2(keyId, appKey) {
  const basic = Buffer.from(`${keyId}:${appKey}`).toString('base64');
  const res = curlJson([
    '-sS',
    '-H',
    `Authorization: Basic ${basic}`,
    'https://api.backblazeb2.com/b2api/v3/b2_authorize_account',
  ]);
  if (res?.apiInfo || res?.allowed || res?.accountId) {
    const allowed = res.allowed ?? res.apiInfo?.storageApi ?? {};
    const caps = allowed.capabilities ?? [];
    return {
      authorized: true,
      has_readFiles: caps.includes('readFiles'),
      has_listFiles: caps.includes('listFiles'),
      has_writeFiles: caps.includes('writeFiles'),
      restricted_to_bucket_name: allowed.buckets?.[0]?.name ?? allowed.bucketName ?? null,
    };
  }
  return { authorized: false, b2_error_code: res?.code ?? null, b2_status: res?.status ?? null };
}

export async function main(env = process.env) {
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const project = env.CLOUDFLARE_PROJECT_NAME || 'next-starter-template';
  const targetEnv = String(env.B2_TARGET_ENV || 'production').toLowerCase();
  const apply = String(env.APPLY || 'false').toLowerCase() === 'true';
  if (!apiToken) fail('CLOUDFLARE_API_TOKEN is required');
  if (!accountId) fail('CLOUDFLARE_ACCOUNT_ID is required');
  if (targetEnv !== 'production' && targetEnv !== 'preview') fail('B2_TARGET_ENV must be production or preview');

  const check = checkB2Values({
    endpoint: env.B2_ENDPOINT,
    bucket: env.B2_BUCKET,
    keyId: env.B2_KEY_ID,
    appKey: env.B2_APP_KEY,
  });

  const keyId = String(env.B2_KEY_ID ?? '').trim();
  const appKey = String(env.B2_APP_KEY ?? '').trim();
  const b2 = keyId && appKey ? authorizeB2(keyId, appKey) : { authorized: false };

  // Current Pages state: names and types only; plain values for the two non-secret settings.
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}`;
  const got = curlJson(['-fsS', '-H', `Authorization: Bearer ${apiToken}`, '-H', 'Accept: application/json', base]);
  const existing = got?.result?.deployment_configs?.[targetEnv]?.env_vars ?? {};
  const pages = {};
  for (const name of ['B2_ENDPOINT', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY', 'PUBLIC_B2_BASE_URL']) {
    const v = existing[name];
    pages[name] = v
      ? { present: true, type: v.type, ...(v.type === 'plain_text' && (name === 'B2_ENDPOINT' || name === 'B2_BUCKET') ? { value: String(v.value ?? '') } : {}) }
      : { present: false };
  }

  const refusals = [...check.refusals];
  if (!b2.authorized) refusals.push('the GitHub B2 key pair was refused by Backblaze (b2_authorize_account)');
  else if (!b2.has_readFiles) refusals.push('the GitHub B2 key has no readFiles capability');

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    project,
    target_env: targetEnv,
    pages_api_ok: Boolean(got?.success),
    github_values: check.facts,
    github_pair_vs_backblaze: b2,
    pages_current: pages,
    refusals,
  };

  if (!apply) {
    console.log(JSON.stringify({ ...report, applied: false }, null, 2));
    return;
  }
  if (refusals.length > 0) {
    console.log(JSON.stringify({ ...report, applied: false }, null, 2));
    fail(`refusing to write: ${refusals.join('; ')}`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'lgfc-wrangler-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'lgfc-b2-secrets-sync', private: true }, null, 2));
  const install = spawnSync('npm', ['install', 'wrangler@4', '--no-fund', '--no-audit'], { cwd: dir, encoding: 'utf8' });
  if (install.status !== 0) fail('npm install wrangler failed in isolated dir');

  const values = {
    B2_ENDPOINT: check.normalizedEndpoint,
    B2_BUCKET: String(env.B2_BUCKET).trim(),
    B2_KEY_ID: keyId,
    B2_APP_KEY: appKey,
  };
  for (const [key, value] of Object.entries(values)) {
    console.log(`wrangler pages secret put ${key} --env ${targetEnv} …`);
    const result = spawnSync(
      join(dir, 'node_modules', '.bin', 'wrangler'),
      ['pages', 'secret', 'put', key, '--project-name', project, '--env', targetEnv, '--cwd', dir],
      {
        cwd: dir,
        input: value,
        encoding: 'utf8',
        env: { ...env, CLOUDFLARE_API_TOKEN: apiToken, CLOUDFLARE_ACCOUNT_ID: accountId },
      },
    );
    const scrub = (text) => String(text ?? '').split(appKey).join('[redacted]').split(keyId).join('[redacted]');
    if (result.stdout) process.stdout.write(scrub(result.stdout));
    if (result.stderr) process.stderr.write(scrub(result.stderr));
    if (result.status !== 0) fail(`wrangler put ${key} failed`);
  }
  console.log(JSON.stringify({ ...report, applied: true, keys_written: Object.keys(values) }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => fail(String(error?.message ?? error)));
}
