#!/usr/bin/env node
/**
 * #3268 Phase 1 — read-only R2 backup-bucket investigation preflight.
 *
 * Now that Bill has provisioned `lgfc-d1-backups` (Standard storage, public access
 * disabled) and its least-privilege S3-compatible credentials, this answers Phase 1
 * items 4-5's R2 half: confirm the bucket exists and is reachable, and prove the
 * scoped credential can read it. It performs exactly one bounded, read-only
 * `ListObjectsV2` call (max 1000 keys, single page — sufficient to confirm
 * reachability and get a rough object count for what is expected to be a mostly-empty
 * new bucket; NOT a full inventory) and, best-effort, `wrangler r2 bucket list` using
 * the existing Cloudflare API token to independently corroborate the bucket's
 * account-level metadata (creation date, location) if that token has R2 scope.
 *
 * This script never runs PutObject, DeleteObject, or any bucket-admin mutation — there
 * is no write code path here. It reuses `AwsClient` from `functions/_lib/aws4fetch.ts`
 * (the same S3 SigV4 signer already used for the existing, already-shipped, read-only
 * B2 `ListObjectsV2` integration in `functions/_lib/b2.ts` — see
 * docs/reference/platform/component-environment-isolation.md, which classifies that
 * B2 read as **read-only**). The XML parsing here is a small, self-contained
 * duplicate of `b2.ts`'s `parseListObjectsV2Xml` rather than a cross-import, because
 * `b2.ts` itself imports `./aws4fetch` without a file extension, which only resolves
 * inside the Next.js/Workers build pipeline, not under plain Node module resolution
 * used by scripts/ci/**.
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ACCOUNT_ID
 *   Optionally CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID (aliases CF_API_TOKEN/
 *   CF_ACCOUNT_ID accepted) for the best-effort `wrangler r2 bucket list` corroboration —
 *   its absence or failure does not fail this preflight closed, since the S3-level read
 *   is the primary, required evidence.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AwsClient } from '../../functions/_lib/aws4fetch.ts';

export const RESULT_JSON_PATH = 'd1-backup-r2-phase1-preflight-3268-result.json';
export const RESULT_MD_PATH = 'd1-backup-r2-phase1-preflight-3268-result.md';

function aliasEnv(primary, aliases) {
  if (process.env[primary]) return;
  for (const name of aliases) {
    if (process.env[name]) {
      process.env[primary] = process.env[name];
      return;
    }
  }
}

export function requireR2Env(env = process.env) {
  return ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ACCOUNT_ID'].filter(
    (name) => !env[name],
  );
}

function decodeXmlInner(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractXmlTag(block, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = block.match(re);
  return m ? decodeXmlInner(m[1].trim()) : '';
}

/**
 * Extracts only the short, generic `<Code>` field (e.g. "AccessDenied", "NoSuchBucket",
 * "SignatureDoesNotMatch") from an S3-compatible XML error response. Deliberately does not
 * return the full body: S3/R2 error XML commonly echoes back the bucket name (and sometimes
 * the request path) in fields like `<BucketName>`/`<Resource>`, which would leak the
 * R2_BUCKET_NAME secret into this preflight's public #3268 issue-comment result.
 */
export function extractS3ErrorCode(xml) {
  const m = String(xml || '').match(/<Code>([\s\S]*?)<\/Code>/);
  return m ? m[1].trim() : '';
}

/** Parses a bounded, single-page ListObjectsV2 XML response into { keys, isTruncated }. */
export function parseListObjectsV2Page(xml) {
  const keys = [];
  const parts = String(xml || '').split('<Contents>');
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].split('</Contents>')[0];
    const key = extractXmlTag(block, 'Key');
    if (key) keys.push(key);
  }
  const truncMatch = String(xml || '').match(/<IsTruncated>\s*(true|false)\s*<\/IsTruncated>/i);
  const isTruncated = Boolean(truncMatch && truncMatch[1].toLowerCase() === 'true');
  return { keys, isTruncated };
}

function resolveWranglerCmd() {
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(local)) return [local];
  return ['npx', '--no-install', 'wrangler'];
}

function runWrangler(args) {
  const cmd = resolveWranglerCmd();
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], { encoding: 'utf8', env: process.env });
}

/**
 * Extracts non-sensitive account-level bucket metadata from `wrangler r2 bucket list --json`.
 * Returns null when the response shape can't be interpreted as a bucket list at all (distinct
 * from `{ found: false }`, which means a real, parseable list was checked and the bucket
 * genuinely isn't in it — conflating the two would misreport "could not confirm" as "confirmed
 * absent").
 */
export function extractR2BucketListing(parsed, bucketName) {
  const records = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.result)
      ? parsed.result
      : Array.isArray(parsed?.buckets)
        ? parsed.buckets
        : null;
  if (!records) return null;
  const match = records.find((b) => b && typeof b === 'object' && b.name === bucketName);
  if (!match) return { found: false };
  return {
    found: true,
    creationDate: match.creation_date ?? match.creationDate ?? null,
    location: match.location ?? null,
    storageClass: match.storage_class ?? match.storageClass ?? null,
  };
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- d1-backup-r2-phase1-preflight-3268 -->',
    '## #3268 Phase 1 — R2 backup bucket investigation preflight (read-only)',
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Bucket: \`${result.bucketName}\``,
    `- One or more R2 secret values had leading/trailing whitespace (trimmed before use, values never logged): ${result.hadUntrimmedCredential ? 'YES' : 'NO'}`,
    `- S3 \`ListObjectsV2\` read: ${result.listOk ? 'OK' : 'FAILED'}`,
    result.listOk
      ? `  - object count in this page: ${result.objectCount} (single page, max 1000 keys — not a full inventory)${result.isTruncated ? ' — more objects exist beyond this page' : ''}`
      : `  - reason: ${result.listFailureReason ?? 'unknown'}`,
    `- \`wrangler r2 bucket list\` corroboration: ${result.wranglerConfirmed ? 'OK' : 'not confirmed'}`,
    result.wranglerConfirmed
      ? `  - found in account bucket list: ${result.wranglerBucket?.found ? 'YES' : 'NO'}${result.wranglerBucket?.found ? `, creation_date: ${result.wranglerBucket.creationDate ?? 'unknown'}, location: ${result.wranglerBucket.location ?? 'unknown'}, storage_class: ${result.wranglerBucket.storageClass ?? 'unknown'}` : ''}`
      : `  - reason: ${result.wranglerFailureReason ?? 'CLOUDFLARE_API_TOKEN may lack R2 scope, or the CLI does not support this subcommand'}`,
    '',
    '### What this preflight confirms and does not confirm',
    '',
    '- Confirms: the bucket is reachable with the provisioned least-privilege S3 credential, using a read-only `ListObjectsV2` call only.',
    '- Does NOT confirm "public access disabled" directly — the S3 API used here has no bucket-ACL-read operation exposed by R2; that setting is a Cloudflare-dashboard/account-level fact Bill has stated, not independently re-derived by this script.',
    '- Does NOT write, upload, or delete any object.',
  ];
  return lines.join('\n');
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No write, upload, or delete was attempted; this script has no such code path.');
  process.exitCode = 1;
}

export async function main() {
  aliasEnv('CLOUDFLARE_API_TOKEN', ['CF_API_TOKEN']);
  aliasEnv('CLOUDFLARE_ACCOUNT_ID', ['CF_ACCOUNT_ID']);

  const missing = requireR2Env(process.env);
  if (missing.length > 0) {
    failClosed(`missing required R2 credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  // Defensive trim: leading/trailing whitespace or a stray newline in a copy-pasted secret
  // value (a common mistake when setting a GitHub Actions secret from a dashboard UI) would
  // silently produce a malformed hostname/credential and could plausibly explain a TLS
  // handshake failure at Cloudflare's edge rather than a clean HTTP error. Track whether
  // trimming actually changed anything (a safe, non-leaking boolean) so that fact -- not the
  // value -- can be reported if it's ever relevant.
  const rawAccountId = process.env.R2_ACCOUNT_ID ?? '';
  const rawBucketName = process.env.R2_BUCKET_NAME ?? '';
  const rawAccessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
  const rawSecretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';
  const accountId = rawAccountId.trim();
  const bucketName = rawBucketName.trim();
  const accessKeyId = rawAccessKeyId.trim();
  const secretAccessKey = rawSecretAccessKey.trim();
  const hadUntrimmedCredential =
    accountId !== rawAccountId ||
    bucketName !== rawBucketName ||
    accessKeyId !== rawAccessKeyId ||
    secretAccessKey !== rawSecretAccessKey;

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  });

  let listOk = false;
  let listFailureReason = '';
  let objectCount = null;
  let isTruncated = false;

  try {
    const pathBucket = bucketName.split('/').map(encodeURIComponent).join('/');
    const qs = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
    const url = `${endpoint}/${pathBucket}?${qs.toString()}`;
    const res = await aws.fetch(url, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      const code = extractS3ErrorCode(text);
      listFailureReason = code ? `HTTP ${res.status}: ${code}` : `HTTP ${res.status} (no S3 error code in response body)`;
    } else {
      const xml = await res.text();
      const page = parseListObjectsV2Page(xml);
      objectCount = page.keys.length;
      isTruncated = page.isTruncated;
      listOk = true;
    }
  } catch (error) {
    // error.cause.code carries a short, generic reason code (ENOTFOUND, ECONNREFUSED,
    // ETIMEDOUT, a TLS error code, etc.) for Node's uninformative generic "fetch failed"
    // message. Deliberately NOT surfacing error.cause.message here: for DNS failures in
    // particular, Node's underlying error message embeds the literal hostname being resolved
    // (e.g. "getaddrinfo ENOTFOUND <account-id>.r2.cloudflarestorage.com"), which would leak
    // the R2_ACCOUNT_ID secret into this result -- and this result is posted to the public
    // #3268 issue comment, where GitHub's log-output secret masking does not apply (masking
    // only redacts what's echoed to the Actions run log, not content a script posts directly
    // to the GitHub API via `gh issue comment --body-file`).
    listFailureReason = [error.message, error.cause?.code].filter(Boolean).join(' — ');
  }

  if (!listOk) {
    // Write the (already leak-checked) failure evidence before failing closed, so the workflow's
    // "Record result" step posts the real, safe reason instead of falling back to its generic
    // "did not complete, see logs" message -- matching this preflight's own "surface real
    // evidence" design rather than hiding a diagnosable failure behind a dead end.
    const failureResult = {
      checkedAt: new Date().toISOString(),
      bucketName,
      listOk: false,
      listFailureReason: listFailureReason || 'R2 ListObjectsV2 did not succeed.',
      objectCount: null,
      isTruncated: false,
      wranglerConfirmed: false,
      wranglerFailureReason: 'Not attempted: R2 read-only check failed first.',
      wranglerBucket: null,
      hadUntrimmedCredential,
    };
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(failureResult, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(failureResult)}\n`);
    failClosed(failureResult.listFailureReason);
    return;
  }

  let wranglerConfirmed = false;
  let wranglerFailureReason = '';
  let wranglerBucket = null;

  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    const listing = runWrangler(['r2', 'bucket', 'list', '--json']);
    if (listing.error || listing.status !== 0) {
      wranglerFailureReason = `wrangler r2 bucket list did not succeed (exit ${listing.status ?? 'spawn error'}).`;
    } else {
      try {
        const parsed = JSON.parse(listing.stdout);
        wranglerBucket = extractR2BucketListing(parsed, bucketName);
        if (wranglerBucket === null) {
          wranglerFailureReason = 'wrangler r2 bucket list returned a response shape this script could not interpret as a bucket list.';
        } else {
          wranglerConfirmed = true;
        }
      } catch (error) {
        wranglerFailureReason = `could not parse "wrangler r2 bucket list --json" output: ${error.message}`;
      }
    }
  } else {
    wranglerFailureReason = 'CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not set for this run; R2 evidence above stands on its own.';
  }

  const result = {
    checkedAt: new Date().toISOString(),
    bucketName,
    listOk,
    listFailureReason: listOk ? null : listFailureReason,
    objectCount,
    isTruncated,
    wranglerConfirmed,
    wranglerFailureReason: wranglerConfirmed ? null : wranglerFailureReason,
    wranglerBucket: wranglerConfirmed ? wranglerBucket : null,
    hadUntrimmedCredential,
  };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  writeOutput('list_ok', String(listOk));
  writeOutput('object_count', String(objectCount ?? ''));

  console.log(`OK: R2 ListObjectsV2 succeeded, ${objectCount} object(s) in this page.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
