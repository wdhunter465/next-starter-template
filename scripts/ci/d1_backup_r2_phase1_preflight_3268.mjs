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
 * The first two live runs (2026-08-10) both failed with an identical
 * ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE against the S3-compatible endpoint, and Bill
 * confirmed from the Cloudflare dashboard that R2 is active, the account ID matches, the
 * endpoint format is correct, and the bucket exists with public access disabled -- ruling
 * out account/dashboard-side misconfiguration. This version adds two raw `tls.connect()`
 * handshake attempts (no HTTP, no credentials) run unconditionally before the S3 read, to
 * isolate whether the failure is specific to `fetch()`/undici's TLS negotiation versus a
 * genuine network/certificate problem that would affect every client. It also runs
 * `wrangler r2 bucket list` unconditionally (previously skipped whenever the S3 read failed
 * first), since it hits a different host (`api.cloudflare.com`) and is independent evidence
 * either way.
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
import tls from 'node:tls';
import dns from 'node:dns';
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

/**
 * Given a { NAME: trimmedValue } map, returns the names whose trimmed value is an empty
 * string -- i.e. present but blank/whitespace-only. Used to fail closed after trimming
 * (requireR2Env's presence check alone does not catch a whitespace-only value, since a
 * non-empty string is truthy).
 */
export function findBlankAfterTrim(trimmedValuesByName) {
  return Object.entries(trimmedValuesByName)
    .filter(([, value]) => value === '')
    .map(([name]) => name);
}

/**
 * Replaces every literal occurrence of any given secret value in `text` with `[REDACTED]`.
 * This is the general safety net for any diagnostic text this preflight captures from an
 * external tool (openssl, curl, wrangler stderr) whose exact output shape isn't fully under
 * this script's control: rather than trying to predict which fields a tool might echo a
 * secret back in, this strips every known secret value wherever it literally appears, so any
 * such text can be safely included in the public #3268 issue-comment result. Values shorter
 * than 6 characters are skipped to avoid mass-redacting trivially common short substrings.
 */
export function redactSecrets(text, secretValues) {
  let out = String(text ?? '');
  for (const secret of secretValues ?? []) {
    if (typeof secret === 'string' && secret.length >= 6) {
      out = out.split(secret).join('[REDACTED]');
    }
  }
  return out;
}

/**
 * Safe, non-leaking structural checks on the constructed R2 endpoint: does the hostname end
 * with the exact suffix Cloudflare documents for non-jurisdictional R2 S3 access, and does the
 * account-ID label look like a real Cloudflare account ID (32-character lowercase hex)? Reports
 * only the suffix match, the label's length, and whether it's valid hex -- never the label
 * value itself.
 */
export function validateEndpointStructure(hostname) {
  const suffix = '.r2.cloudflarestorage.com';
  const suffixOk = typeof hostname === 'string' && hostname.endsWith(suffix) && hostname.length > suffix.length;
  const label = suffixOk ? hostname.slice(0, hostname.length - suffix.length) : '';
  return {
    suffixOk,
    labelLength: label.length,
    labelIsHex32: /^[0-9a-f]{32}$/i.test(label),
  };
}

/**
 * Resolves `hostname` via DNS without ever surfacing the hostname itself or the resolved
 * addresses -- only the address family/families seen and how many addresses resolved. Enough
 * to confirm "DNS resolution works and returns N addresses of family X" as independent
 * evidence from the TLS-layer checks, without adding any new secret-leak surface.
 */
export function summarizeDnsResult(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return { addressCount: 0, families: [] };
  }
  const families = [...new Set(addresses.map((a) => (a?.family === 6 ? 'IPv6' : 'IPv4')))].sort();
  return { addressCount: addresses.length, families };
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
 * Attempts a bare TLS handshake (no HTTP request at all) against `hostname:443` with the given
 * extra `tls.connect()` options (e.g. `{ ALPNProtocols: [...] }`, `{ minVersion, maxVersion }`),
 * using Node's `tls` module directly -- a different underlying implementation from the global
 * `fetch()` (undici). A TLS handshake completes or fails entirely at the connection layer,
 * before any HTTP headers/body/signing are ever sent, so this isolates whether a
 * `fetch()`-level failure is specific to undici's TLS negotiation (its ALPN offer, TLS version
 * range, or cipher preferences) versus a genuine network/DNS/certificate problem that would
 * affect every client equally, regardless of implementation.
 *
 * Resolves `{ ok, alpnProtocol, protocolVersion, cipherName, code }` -- never throws, and never
 * includes `hostname` or any error `.message` in the result (Node's TLS/DNS error messages can
 * embed the literal hostname, which would leak the R2_ACCOUNT_ID secret into this preflight's
 * public issue-comment result; only the short `.code` is safe to surface).
 */
export function attemptTlsHandshake(hostname, tlsOptions, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const options = { host: hostname, port: 443, servername: hostname, timeout: timeoutMs, ...tlsOptions };

    let socket;
    try {
      socket = tls.connect(options, () => {
        const cipher = socket.getCipher ? socket.getCipher() : null;
        settle({
          ok: true,
          alpnProtocol: socket.alpnProtocol || null,
          protocolVersion: socket.getProtocol ? socket.getProtocol() : null,
          cipherName: cipher?.name ?? null,
          code: null,
        });
        socket.end();
      });
    } catch (error) {
      settle({ ok: false, alpnProtocol: null, protocolVersion: null, cipherName: null, code: error.code ?? 'SYNC_THROW' });
      return;
    }

    socket.on('error', (error) => {
      settle({ ok: false, alpnProtocol: null, protocolVersion: null, cipherName: null, code: error.code ?? 'UNKNOWN' });
    });
    socket.on('timeout', () => {
      settle({ ok: false, alpnProtocol: null, protocolVersion: null, cipherName: null, code: 'ETIMEDOUT' });
      socket.destroy();
    });
  });
}

/**
 * Resolves `hostname` via `dns.lookup` and returns only the safe DNS-layer summary
 * (`summarizeDnsResult`'s shape) plus a failure code when resolution itself fails -- never the
 * hostname or the resolved addresses. Independent evidence from the TLS-layer checks: DNS
 * resolution succeeding (or failing) tells us whether the problem is before or at the TLS
 * handshake.
 */
export function resolveHostnameSafe(hostname) {
  return new Promise((resolve) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        resolve({ ok: false, addressCount: 0, families: [], code: error.code ?? 'UNKNOWN' });
        return;
      }
      resolve({ ok: true, ...summarizeDnsResult(addresses), code: null });
    });
  });
}

/**
 * Shells out to the system `openssl s_client` binary -- a completely independent TLS
 * implementation from both undici and Node's own `tls` module -- as a third independent client
 * against the same host. Pipes empty stdin (`-quiet`, no interactive session) and applies a
 * hard timeout via the `timeout` coreutil, since `s_client` can otherwise hang. Captures only
 * the connection outcome and the "Verify return code" line if present; the raw combined
 * output, which openssl always echoes the hostname/servername into, is redacted through
 * `redact` before being kept for the diagnostic bundle.
 */
export function runOpensslDiagnostic(hostname, redact) {
  const result = spawnSync(
    'timeout',
    ['12', 'openssl', 's_client', '-connect', `${hostname}:443`, '-servername', hostname, '-quiet'],
    { encoding: 'utf8', input: '' },
  );
  const combined = redact(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  const verifyMatch = combined.match(/Verify return code:\s*(\d+)\s*\(([^)]*)\)/);
  return {
    ranOk: !result.error,
    exitCode: result.status ?? null,
    timedOut: result.status === 124,
    verifyReturnCode: verifyMatch ? Number(verifyMatch[1]) : null,
    verifyReturnMessage: verifyMatch ? verifyMatch[2] : null,
  };
}

/**
 * Shells out to `curl` -- a fourth, widely-used independent HTTP/TLS client -- against the
 * same host. Reports only curl's numeric exit code (a small, well-documented, non-leaking
 * integer -- e.g. 35 = SSL connect error, 6 = couldn't resolve host, 28 = timeout) and, when
 * curl did connect, the HTTP status it saw. Never captures curl's own stdout/stderr text,
 * which could otherwise echo the URL/hostname back on error.
 */
export function runCurlDiagnostic(hostname) {
  const result = spawnSync(
    'curl',
    ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '12', `https://${hostname}/`],
    { encoding: 'utf8' },
  );
  const httpCode = result.status === 0 ? (result.stdout || '').trim() : null;
  return { ranOk: !result.error, exitCode: result.status ?? null, httpCode };
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

function formatTlsAttempt(label, attempt) {
  if (!attempt) return `  - ${label}: not attempted`;
  if (attempt.ok) {
    return `  - ${label}: OK (ALPN: ${attempt.alpnProtocol ?? 'none negotiated'}, protocol: ${attempt.protocolVersion ?? 'unknown'}, cipher: ${attempt.cipherName ?? 'unknown'})`;
  }
  return `  - ${label}: FAILED (code: ${attempt.code ?? 'unknown'})`;
}

function formatDnsResult(dnsResult) {
  if (!dnsResult) return '  - DNS resolution: not attempted';
  if (!dnsResult.ok) return `  - DNS resolution: FAILED (code: ${dnsResult.code ?? 'unknown'})`;
  return `  - DNS resolution: OK (${dnsResult.addressCount} address(es), families: ${dnsResult.families.join(', ') || 'none'})`;
}

function formatEndpointStructure(structure) {
  if (!structure) return '  - Endpoint structure: not checked';
  return `  - Endpoint structure: suffix matches \`.r2.cloudflarestorage.com\`: ${structure.suffixOk ? 'YES' : 'NO'}; account-ID label length: ${structure.labelLength}; label is 32-char hex: ${structure.labelIsHex32 ? 'YES' : 'NO'}`;
}

function formatOpensslResult(result) {
  if (!result) return '  - `openssl s_client` (independent TLS client): not attempted';
  if (!result.ranOk) return '  - `openssl s_client` (independent TLS client): could not run (binary/timeout coreutil unavailable)';
  if (result.timedOut) return '  - `openssl s_client` (independent TLS client): TIMED OUT (12s)';
  if (result.verifyReturnCode !== null) {
    return `  - \`openssl s_client\` (independent TLS client): exit ${result.exitCode}, verify return code ${result.verifyReturnCode} (${result.verifyReturnMessage})`;
  }
  return `  - \`openssl s_client\` (independent TLS client): exit ${result.exitCode}, no verify return code seen (connection likely did not reach the TLS verify stage)`;
}

function formatCurlResult(result) {
  if (!result) return '  - `curl` (independent HTTP/TLS client): not attempted';
  if (!result.ranOk) return '  - `curl` (independent HTTP/TLS client): could not run (binary unavailable)';
  if (result.httpCode) return `  - \`curl\` (independent HTTP/TLS client): exit 0, HTTP ${result.httpCode}`;
  return `  - \`curl\` (independent HTTP/TLS client): exit ${result.exitCode} (see https://curl.se/libcurl/c/libcurl-errors.html for exit-code meaning; e.g. 35 = SSL connect error, 6 = couldn't resolve host, 28 = timeout)`;
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- d1-backup-r2-phase1-preflight-3268 -->',
    '## #3268 Phase 1 — R2 backup bucket investigation preflight (read-only)',
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Bucket: \`${result.bucketName}\``,
    `- One or more R2 secret values had leading/trailing whitespace (trimmed before use, values never logged): ${result.hadUntrimmedCredential ? 'YES' : 'NO'}`,
    formatEndpointStructure(result.endpointStructure),
    formatDnsResult(result.dnsResult),
    '- Raw TLS handshake diagnostics (no HTTP request, no credentials; isolates fetch()/undici-specific behavior from a genuine network/certificate problem):',
    formatTlsAttempt('default ALPN (Node/undici default offer)', result.tlsDefault),
    formatTlsAttempt('http/1.1-only ALPN', result.tlsHttp1Only),
    formatTlsAttempt('TLS 1.2 forced', result.tlsForced12),
    formatTlsAttempt('TLS 1.3 forced', result.tlsForced13),
    '- Independent client diagnostics (different implementations from Node/undici entirely):',
    formatOpensslResult(result.opensslResult),
    formatCurlResult(result.curlResult),
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

  // requireR2Env() above only checks presence, so a whitespace-only secret value passes it
  // (a non-empty string is truthy) and would trim to an empty string here -- silently producing
  // an invalid endpoint like "https://.r2.cloudflarestorage.com" and a confusing downstream
  // TLS/DNS failure instead of a clear one. Fail closed now, by name only, never by value.
  const blankAfterTrim = findBlankAfterTrim({
    R2_ACCOUNT_ID: accountId,
    R2_BUCKET_NAME: bucketName,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
  });
  if (blankAfterTrim.length > 0) {
    failClosed(`required R2 credential(s) present but blank/whitespace-only after trimming: ${blankAfterTrim.join(', ')} (values are never logged).`);
    return;
  }

  const hostname = `${accountId}.r2.cloudflarestorage.com`;
  const redact = (text) => redactSecrets(text, [accountId, bucketName, accessKeyId, secretAccessKey]);

  const endpointStructure = validateEndpointStructure(hostname);
  const dnsResult = await resolveHostnameSafe(hostname);

  // Raw TLS handshake diagnostics run first and unconditionally: they isolate whether a
  // fetch()-level failure below is specific to undici's TLS negotiation (a different
  // implementation from Node's tls module) versus a genuine network/DNS/certificate problem
  // that would affect every client equally. No HTTP request, no credentials involved --
  // pure connection-layer evidence. Four variants: default, http/1.1-only, and each TLS
  // version pinned individually, to isolate a version-specific negotiation issue from an
  // ALPN-specific one.
  const tlsDefault = await attemptTlsHandshake(hostname, undefined);
  const tlsHttp1Only = await attemptTlsHandshake(hostname, { ALPNProtocols: ['http/1.1'] });
  const tlsForced12 = await attemptTlsHandshake(hostname, { minVersion: 'TLSv1.2', maxVersion: 'TLSv1.2' });
  const tlsForced13 = await attemptTlsHandshake(hostname, { minVersion: 'TLSv1.3', maxVersion: 'TLSv1.3' });

  // Two independent clients entirely outside Node (openssl's own TLS stack, and curl's),
  // against the same host -- if either succeeds where Node's tls module and fetch() both
  // fail, that narrows the fault to something Node-specific on this runner; if all fail
  // identically, that points at the network path or the edge itself.
  const opensslResult = runOpensslDiagnostic(hostname, redact);
  const curlResult = runCurlDiagnostic(hostname);

  // wrangler r2 bucket list hits a completely different host (api.cloudflare.com, via
  // Cloudflare's own REST API) than the S3-compatible endpoint below -- run it unconditionally
  // too (previously gated behind the S3 check's success, silently discarding this evidence on
  // every failed run) so a single preflight run always yields the maximum diagnostic value.
  let wranglerConfirmed = false;
  let wranglerFailureReason = '';
  let wranglerBucket = null;
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    const listing = runWrangler(['r2', 'bucket', 'list', '--json']);
    if (listing.error || listing.status !== 0) {
      // Capture wrangler's actual stderr (redacted) instead of just the exit code, so a
      // credential/API-token-scope problem is distinguishable from a network/TLS problem on
      // this different host.
      const stderrSnippet = redact((listing.stderr || '').trim()).slice(0, 500);
      wranglerFailureReason = `wrangler r2 bucket list did not succeed (exit ${listing.status ?? 'spawn error'})${stderrSnippet ? `: ${stderrSnippet}` : '.'}`;
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
    wranglerFailureReason = 'CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID not set for this run.';
  }

  const endpoint = `https://${hostname}`;
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

  const result = {
    checkedAt: new Date().toISOString(),
    bucketName,
    hadUntrimmedCredential,
    endpointStructure,
    dnsResult,
    tlsDefault,
    tlsHttp1Only,
    tlsForced12,
    tlsForced13,
    opensslResult,
    curlResult,
    listOk,
    listFailureReason: listOk ? null : listFailureReason || 'R2 ListObjectsV2 did not succeed.',
    objectCount,
    isTruncated,
    wranglerConfirmed,
    wranglerFailureReason: wranglerConfirmed ? null : wranglerFailureReason,
    wranglerBucket: wranglerConfirmed ? wranglerBucket : null,
  };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  writeOutput('list_ok', String(listOk));
  writeOutput('object_count', String(objectCount ?? ''));

  if (!listOk) {
    // The workflow's "Record result" step posts result.md (written above) either way, so the
    // real, full diagnostic bundle -- including the TLS handshake evidence and wrangler
    // corroboration -- is always what gets reported, never a generic "see logs" fallback.
    failClosed(result.listFailureReason);
    return;
  }

  console.log(`OK: R2 ListObjectsV2 succeeded, ${objectCount} object(s) in this page.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
