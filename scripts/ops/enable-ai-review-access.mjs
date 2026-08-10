#!/usr/bin/env node
/**
 * enable-ai-review-access.mjs (#2215)
 *
 * Sets Cloudflare Pages deployment env secrets for AI review access using the
 * Pages project PATCH API (existing CLOUDFLARE_* repo secrets).
 *
 * Never prints the review token.
 *
 * Required env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 * Optional: CLOUDFLARE_PROJECT_NAME, AI_REVIEW_TOKEN, AI_REVIEW_ALLOW_ADMIN,
 *           AI_REVIEW_TOKEN_OUT
 */

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, chmodSync } from 'node:fs';

const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const project =
  process.env.CLOUDFLARE_PROJECT_NAME ||
  process.env.CF_PAGES_PROJECT ||
  process.env.CLOUDFLARE_PAGES_PROJECT ||
  'next-starter-template';
const allowAdmin = String(process.env.AI_REVIEW_ALLOW_ADMIN ?? 'true').toLowerCase() === 'true' ? 'true' : 'false';
const outPath = process.env.AI_REVIEW_TOKEN_OUT || '';

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!apiToken) fail('CLOUDFLARE_API_TOKEN is required');
if (!accountId) fail('CLOUDFLARE_ACCOUNT_ID is required');

const reviewToken =
  process.env.AI_REVIEW_TOKEN && process.env.AI_REVIEW_TOKEN.length >= 32
    ? process.env.AI_REVIEW_TOKEN
    : randomBytes(32).toString('hex');

const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${encodeURIComponent(project)}`;

function cf(method, url, body) {
  const args = ['-fsS', '-X', method, '-H', `Authorization: Bearer ${apiToken}`, '-H', 'Accept: application/json'];
  if (body !== undefined) {
    args.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
  }
  args.push(url);
  try {
    const out = execFileSync('curl', args, {
      encoding: 'utf8',
      input: body !== undefined ? JSON.stringify(body) : undefined,
      maxBuffer: 1024 * 1024 * 32,
    });
    return JSON.parse(out || '{}');
  } catch (error) {
    fail(`Cloudflare API ${method} failed: ${error.message}`);
  }
}

/**
 * Preserve existing env vars across PATCH.
 * secret_text values are redacted on GET — keep them by re-sending type-only markers
 * is NOT supported. Strategy:
 *  - copy all plain_text keys with values
 *  - for secret_text keys we are NOT replacing: omit from payload and rely on
 *    Cloudflare merge behavior for unspecified keys when using the "env_vars" patch.
 *
 * Empirically CF replaces the env_vars map. To avoid wiping secrets we:
 *  1) GET env var key inventory
 *  2) If foreign secret_text keys exist, refuse (operator must use dashboard) OR
 *     use wrangler from an isolated install.
 *  3) If only plain_text (+ our secrets), safe to rewrite.
 */
function buildEnv(existing) {
  const foreignSecrets = [];
  const next = {};
  for (const [key, raw] of Object.entries(existing || {})) {
    if (!raw || typeof raw !== 'object') continue;
    if (key === 'AI_REVIEW_ENABLED' || key === 'AI_REVIEW_TOKEN' || key === 'AI_REVIEW_ALLOW_ADMIN') {
      continue;
    }
    if (raw.type === 'secret_text') {
      foreignSecrets.push(key);
      continue;
    }
    next[key] = { type: 'plain_text', value: String(raw.value ?? '') };
  }
  return { next, foreignSecrets };
}

console.log(`GET Pages project '${project}' (using repo Cloudflare secrets)…`);
const got = cf('GET', base);
if (!got.success) fail(`GET project failed: ${JSON.stringify(got.errors || got)}`);

const previewExisting = got.result?.deployment_configs?.preview?.env_vars || {};
const productionExisting = got.result?.deployment_configs?.production?.env_vars || {};

const previewBuilt = buildEnv(previewExisting);
const productionBuilt = buildEnv(productionExisting);
const foreign = [...new Set([...previewBuilt.foreignSecrets, ...productionBuilt.foreignSecrets])];

if (foreign.length) {
  console.log(
    `Note: existing secret_text keys present (${foreign.length}). Will PATCH only by merging plain_text + AI_REVIEW_* and re-applying known secrets via isolated wrangler if needed.`,
  );
}

const aiVars = {
  AI_REVIEW_ENABLED: { type: 'plain_text', value: 'true' },
  AI_REVIEW_TOKEN: { type: 'secret_text', value: reviewToken },
  AI_REVIEW_ALLOW_ADMIN: { type: 'plain_text', value: allowAdmin },
};

// Prefer isolated wrangler install when foreign secrets exist (safe put without full map replace).
if (foreign.length) {
  const { mkdtempSync, writeFileSync: wfs } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'lgfc-wrangler-'));
  wfs(join(dir, 'package.json'), JSON.stringify({ name: 'lgfc-ai-review-enable', private: true }, null, 2));
  console.log('Installing wrangler in isolated temp dir…');
  let r = spawnSync('npm', ['install', 'wrangler@4', '--no-fund', '--no-audit'], {
    cwd: dir,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || '');
    fail('npm install wrangler failed in isolated dir');
  }
  function put(key, value) {
    console.log(`wrangler pages secret put ${key} (isolated)…`);
    const result = spawnSync(
      join(dir, 'node_modules', '.bin', 'wrangler'),
      ['pages', 'secret', 'put', key, '--project-name', project, '--cwd', dir],
      {
        cwd: dir,
        input: value,
        encoding: 'utf8',
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: apiToken,
          CLOUDFLARE_ACCOUNT_ID: accountId,
        },
      },
    );
    if (result.stdout) process.stdout.write(result.stdout.replaceAll(reviewToken, '[redacted]'));
    if (result.stderr) process.stderr.write(result.stderr.replaceAll(reviewToken, '[redacted]'));
    if (result.status !== 0) fail(`isolated wrangler put ${key} failed`);
  }
  // secret put for token; plain vars via PATCH merge of plain only is unsafe with foreign secrets.
  // Put all three as secrets so Functions still read them as env.
  put('AI_REVIEW_ENABLED', 'true');
  put('AI_REVIEW_TOKEN', reviewToken);
  put('AI_REVIEW_ALLOW_ADMIN', allowAdmin);
} else {
  console.log('No foreign Pages secrets; PATCHing preview+production env_vars with AI_REVIEW_*…');
  const previewEnv = { ...previewBuilt.next, ...aiVars };
  const productionEnv = { ...productionBuilt.next, ...aiVars };
  const patched = cf('PATCH', base, {
    deployment_configs: {
      preview: { env_vars: previewEnv },
      production: { env_vars: productionEnv },
    },
  });
  if (!patched.success) fail(`PATCH failed: ${JSON.stringify(patched.errors || patched)}`);
}

if (outPath) {
  writeFileSync(outPath, reviewToken, { encoding: 'utf8', mode: 0o600 });
  chmodSync(outPath, 0o600);
  console.log('Wrote token to output path (0600).');
}

console.log(
  JSON.stringify({
    ok: true,
    project,
    foreign_secret_keys: foreign.length,
    ai_review_enabled: true,
    ai_review_allow_admin: allowAdmin === 'true',
    token_length: reviewToken.length,
    token_written_to_out: Boolean(outPath),
  }),
);
