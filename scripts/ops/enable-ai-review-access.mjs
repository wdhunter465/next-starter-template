#!/usr/bin/env node
/**
 * enable-ai-review-access.mjs (#2215)
 *
 * Sets Cloudflare Pages secrets for AI review access without PATCHing the full
 * env_vars map (avoids wiping redacted existing secrets).
 *
 * Uses: `wrangler pages secret put` (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID).
 * Never prints the review token.
 *
 * Optional:
 *   AI_REVIEW_TOKEN       — reuse; else generate 32-byte hex
 *   AI_REVIEW_ALLOW_ADMIN — default "true"
 *   AI_REVIEW_TOKEN_OUT   — write token to path mode 0600 for `gh secret set`
 *   CLOUDFLARE_PROJECT_NAME — default next-starter-template
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
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

function putSecret(key, value) {
  console.log(`Setting Pages secret ${key}…`);
  const result = spawnSync(
    'npx',
    ['--yes', 'wrangler', 'pages', 'secret', 'put', key, '--project-name', project],
    {
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
  if (result.status !== 0) {
    fail(`wrangler pages secret put ${key} failed (exit ${result.status})`);
  }
}

putSecret('AI_REVIEW_ENABLED', 'true');
putSecret('AI_REVIEW_TOKEN', reviewToken);
putSecret('AI_REVIEW_ALLOW_ADMIN', allowAdmin);

if (outPath) {
  writeFileSync(outPath, reviewToken, { encoding: 'utf8', mode: 0o600 });
  chmodSync(outPath, 0o600);
  console.log('Wrote token to output path (0600).');
}

console.log(
  JSON.stringify({
    ok: true,
    project,
    method: 'wrangler pages secret put',
    ai_review_enabled: true,
    ai_review_allow_admin: allowAdmin === 'true',
    token_length: reviewToken.length,
    token_written_to_out: Boolean(outPath),
    note: 'Redeploy or retry latest deployment so Functions pick up new secrets.',
  }),
);
