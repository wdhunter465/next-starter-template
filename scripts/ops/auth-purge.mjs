/**
 * auth-purge.mjs (#5303)
 *
 * Calls POST /api/scheduled-content/auth-purge: removes expired member sessions (7 days past expiry) and
 * sign-in attempt rows older than 7 days. Dry run unless --apply. A failure here never affects sign-in.
 *
 * Usage:
 *   SCHEDULED_CONTENT_BRIDGE_TOKEN=... [BASE_URL=https://www.lougehrigfanclub.com] node scripts/ops/auth-purge.mjs [--apply]
 * Exit code: 0 on success, 1 when the call fails.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://www.lougehrigfanclub.com';

export function parseArgs(argv) {
  const options = { apply: false };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export function renderReport(data) {
  if (!data.applied) return `Dry run: ${data.sessions_due} expired sessions and ${data.attempts_due} old sign-in attempts would be deleted.`;
  return `Applied: deleted ${data.sessions_deleted} expired sessions and ${data.attempts_deleted} old sign-in attempts; ${data.remaining} remaining.`;
}

export async function main(env = process.env, argv = process.argv.slice(2), fetchImpl = fetch) {
  const options = parseArgs(argv);
  const token = env.SCHEDULED_CONTENT_BRIDGE_TOKEN;
  if (!token) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required');
  const res = await fetchImpl(`${env.BASE_URL || DEFAULT_BASE_URL}/api/scheduled-content/auth-purge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply: options.apply }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 200 || !data.ok) {
    console.error(`Auth purge failed (${res.status}): ${data.error ?? 'unexpected response'}`);
    return 1;
  }
  console.log(renderReport(data));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
