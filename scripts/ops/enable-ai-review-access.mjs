#!/usr/bin/env node
/**
 * enable-ai-review-access.mjs (#2215 / #3289)
 *
 * Sets Cloudflare Pages deployment env secrets for AI review access using the
 * Pages project PATCH API (existing CLOUDFLARE_* repo secrets).
 *
 * Never prints the review token.
 *
 * Required env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 * Optional: CLOUDFLARE_PROJECT_NAME, AI_REVIEW_TOKEN, AI_REVIEW_ALLOW_ADMIN
 *           (defaults false — opt-in only per docs/ops/ai/AI-REVIEW-ACCESS.md),
 *           AI_REVIEW_ENABLED (true|false; default true for enable path — #2215),
 *           AI_REVIEW_TARGET_ENV (preview|production; default preview — #3289),
 *           AI_REVIEW_TOKEN_OUT
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, chmodSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveTargetEnv(raw = process.env.AI_REVIEW_TARGET_ENV) {
  const trimmed = String(raw ?? '').trim().toLowerCase();
  const value = trimmed || 'preview';
  if (value === 'production' || value === 'preview') return value;
  return null;
}

export function resolveEnabledFlag(raw = process.env.AI_REVIEW_ENABLED) {
  const value = String(raw ?? 'true').trim().toLowerCase();
  if (value === 'true' || value === 'false') return value;
  return null;
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
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
export function buildEnv(existing) {
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

export async function main(env = process.env) {
  const apiToken = env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN;
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID;
  const project =
    env.CLOUDFLARE_PROJECT_NAME ||
    env.CF_PAGES_PROJECT ||
    env.CLOUDFLARE_PAGES_PROJECT ||
    'next-starter-template';
  const allowAdmin = String(env.AI_REVIEW_ALLOW_ADMIN ?? 'false').toLowerCase() === 'true' ? 'true' : 'false';
  const outPath = env.AI_REVIEW_TOKEN_OUT || '';
  const targetEnv = resolveTargetEnv(env.AI_REVIEW_TARGET_ENV);
  const enabled = resolveEnabledFlag(env.AI_REVIEW_ENABLED);

  if (!apiToken) fail('CLOUDFLARE_API_TOKEN is required');
  if (!accountId) fail('CLOUDFLARE_ACCOUNT_ID is required');
  if (!targetEnv) {
    fail('AI_REVIEW_TARGET_ENV must be "preview" or "production" (default preview).');
  }
  if (!enabled) {
    fail('AI_REVIEW_ENABLED must be "true" or "false" (default true).');
  }
  // Disable path always forces admin off (#2215 closeout).
  const effectiveAllowAdmin = enabled === 'false' ? 'false' : allowAdmin;

  const suppliedToken = Boolean(env.AI_REVIEW_TOKEN && env.AI_REVIEW_TOKEN.length >= 32);
  const reviewToken = suppliedToken ? env.AI_REVIEW_TOKEN : randomBytes(32).toString('hex');
  const tokenRotated = !suppliedToken;

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

  console.log(
    `GET Pages project '${project}' (using repo Cloudflare secrets; target env=${targetEnv})…`,
  );
  const got = cf('GET', base);
  if (!got.success) fail(`GET project failed: ${JSON.stringify(got.errors || got)}`);

  const previewExisting = got.result?.deployment_configs?.preview?.env_vars || {};
  const productionExisting = got.result?.deployment_configs?.production?.env_vars || {};

  const previewBuilt = buildEnv(previewExisting);
  const productionBuilt = buildEnv(productionExisting);
  const targetBuilt = targetEnv === 'preview' ? previewBuilt : productionBuilt;
  const foreign = [...new Set(targetBuilt.foreignSecrets)];

  if (foreign.length) {
    console.log(
      `Note: existing secret_text keys present on ${targetEnv} (${foreign.length}). Will re-apply AI_REVIEW_* via isolated wrangler --env ${targetEnv}.`,
    );
  }

  const aiVars = {
    AI_REVIEW_ENABLED: { type: 'plain_text', value: enabled },
    AI_REVIEW_TOKEN: { type: 'secret_text', value: reviewToken },
    AI_REVIEW_ALLOW_ADMIN: { type: 'plain_text', value: effectiveAllowAdmin },
  };

  // Prefer isolated wrangler install when foreign secrets exist (safe put without full map replace).
  if (foreign.length) {
    const dir = mkdtempSync(join(tmpdir(), 'lgfc-wrangler-'));
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'lgfc-ai-review-enable', private: true }, null, 2));
    console.log('Installing wrangler in isolated temp dir…');
    const install = spawnSync('npm', ['install', 'wrangler@4', '--no-fund', '--no-audit'], {
      cwd: dir,
      encoding: 'utf8',
    });
    if (install.status !== 0) {
      process.stderr.write(install.stderr || '');
      fail('npm install wrangler failed in isolated dir');
    }
    function put(key, value) {
      console.log(`wrangler pages secret put ${key} --env ${targetEnv} (isolated)…`);
      const result = spawnSync(
        join(dir, 'node_modules', '.bin', 'wrangler'),
        ['pages', 'secret', 'put', key, '--project-name', project, '--env', targetEnv, '--cwd', dir],
        {
          cwd: dir,
          input: value,
          encoding: 'utf8',
          env: {
            ...env,
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
    put('AI_REVIEW_ENABLED', enabled);
    put('AI_REVIEW_TOKEN', reviewToken);
    put('AI_REVIEW_ALLOW_ADMIN', effectiveAllowAdmin);
  } else {
    console.log(`No foreign Pages secrets on ${targetEnv}; PATCHing ${targetEnv} env_vars with AI_REVIEW_*…`);
    const nextEnv = { ...targetBuilt.next, ...aiVars };
    const patched = cf('PATCH', base, {
      deployment_configs: {
        [targetEnv]: { env_vars: nextEnv },
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
      target_env: targetEnv,
      foreign_secret_keys: foreign.length,
      ai_review_enabled: enabled === 'true',
      ai_review_allow_admin: effectiveAllowAdmin === 'true',
      token_length: reviewToken.length,
      token_written_to_out: Boolean(outPath),
      token_rotated: tokenRotated,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    fail(error?.message || String(error));
  });
}
