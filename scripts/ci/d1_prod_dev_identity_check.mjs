#!/usr/bin/env node
/**
 * #3357 — Fail-closed Production vs Development D1 identity check.
 *
 * Ensures top-level (Production) and env.preview (Development) D1 bindings in
 * wrangler.toml declare distinct database_id values and the expected names.
 * Optionally compares GitHub secret env vars when both Prod and Dev IDs are set.
 *
 * Never prints secret values. Never mutates D1.
 *
 * Exit 0 on pass; non-zero on fail.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROD_NAME = 'lgfc_lite';
export const PROD_ID = '22d0dc3e-ad34-43af-8e6a-2063df1a1e04';
export const DEV_NAME = 'lgfc-litedev';
export const DEV_ID = '35232809-b4c1-4df9-9f39-2f178b13c378';

/**
 * Parse the first [[d1_databases]] block before any [env.*] section (Production).
 * and the [[env.preview.d1_databases]] block (Development).
 */
export function parseProdAndPreviewD1(text = '') {
  const envSplit = text.search(/\n\[\[?env\./);
  const top = envSplit >= 0 ? text.slice(0, envSplit) : text;
  const previewMatch = text.match(
    /\[\[env\.preview\.d1_databases\]\]([\s\S]*?)(?=\n\[\[|\n\[env\.|\n# Rate limiting|$)/,
  );
  const preview = previewMatch ? previewMatch[1] : '';

  const pick = (block) => {
    const name = block.match(/database_name\s*=\s*"([^"]+)"/)?.[1] || '';
    const id = block.match(/database_id\s*=\s*"([^"]+)"/)?.[1] || '';
    const binding = block.match(/binding\s*=\s*"([^"]+)"/)?.[1] || '';
    return { databaseName: name, databaseId: id, binding };
  };

  return { production: pick(top), preview: pick(preview) };
}

export function evaluateIdentities({ production, preview }, env = process.env) {
  const failures = [];

  if (!production.databaseId || !production.databaseName) {
    failures.push('Production [[d1_databases]] missing database_name or database_id');
  }
  if (!preview.databaseId || !preview.databaseName) {
    failures.push('[[env.preview.d1_databases]] missing database_name or database_id');
  }
  if (production.databaseId && preview.databaseId && production.databaseId === preview.databaseId) {
    failures.push('Production and Preview database_id must not be identical');
  }
  if (production.databaseName && production.databaseName !== PROD_NAME) {
    failures.push(`Production database_name must be "${PROD_NAME}" (got "${production.databaseName}")`);
  }
  if (preview.databaseName && preview.databaseName !== DEV_NAME) {
    failures.push(`Preview database_name must be "${DEV_NAME}" (got "${preview.databaseName}")`);
  }
  if (production.databaseId && production.databaseId !== PROD_ID) {
    failures.push(`Production database_id does not match expected Production UUID`);
  }
  if (preview.databaseId && preview.databaseId !== DEV_ID) {
    failures.push(`Preview database_id does not match expected Dev UUID from #3357`);
  }
  if (production.binding && production.binding !== 'DB') {
    failures.push(`Production binding must be "DB" (got "${production.binding}")`);
  }
  if (preview.binding && preview.binding !== 'DB') {
    failures.push(`Preview binding must be "DB" (got "${preview.binding}")`);
  }

  const prodSecretId = env.D1_DATABASE_ID || '';
  const prodSecretName = env.D1_DATABASE_NAME || '';
  const devSecretId = env.D1_DEV_DATABASE_ID || '';
  const devSecretName = env.D1_DEV_DATABASE_NAME || '';
  if (prodSecretId && devSecretId && prodSecretId === devSecretId) {
    failures.push('Env D1_DATABASE_ID and D1_DEV_DATABASE_ID must not be identical');
  }
  if (prodSecretName && devSecretName && prodSecretName === devSecretName) {
    failures.push('Env D1_DATABASE_NAME and D1_DEV_DATABASE_NAME must not be identical');
  }
  if (prodSecretId && production.databaseId && prodSecretId !== production.databaseId) {
    failures.push('Env D1_DATABASE_ID does not match wrangler Production database_id');
  }
  if (prodSecretName && production.databaseName && prodSecretName !== production.databaseName) {
    failures.push('Env D1_DATABASE_NAME does not match wrangler Production database_name');
  }
  if (devSecretId && preview.databaseId && devSecretId !== preview.databaseId) {
    failures.push('Env D1_DEV_DATABASE_ID does not match wrangler Preview database_id');
  }
  if (devSecretName && preview.databaseName && devSecretName !== preview.databaseName) {
    failures.push('Env D1_DEV_DATABASE_NAME does not match wrangler Preview database_name');
  }

  return { ok: failures.length === 0, failures };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const wranglerPath = path.resolve(process.cwd(), argv[0] || 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    console.error(`FAIL: wrangler.toml not found at ${wranglerPath}`);
    return 1;
  }
  const text = fs.readFileSync(wranglerPath, 'utf8');
  const parsed = parseProdAndPreviewD1(text);
  const result = evaluateIdentities(parsed, env);

  console.log(
    JSON.stringify(
      {
        check: 'd1_prod_dev_identity',
        production: {
          name: parsed.production.databaseName,
          id: parsed.production.databaseId,
          binding: parsed.production.binding,
        },
        preview: {
          name: parsed.preview.databaseName,
          id: parsed.preview.databaseId,
          binding: parsed.preview.binding,
        },
        ok: result.ok,
        failures: result.failures,
      },
      null,
      2,
    ),
  );

  if (!result.ok) {
    for (const f of result.failures) console.error(`FAIL: ${f}`);
    return 1;
  }
  console.log('PASS: Production and Preview D1 identities are distinct and expected');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
