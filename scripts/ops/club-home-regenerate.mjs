/**
 * club-home-regenerate.mjs (#4906)
 *
 * Calls POST /api/scheduled-content/club-home-regenerate. Dry run unless --apply. Exit code 1 only when the call
 * fails (a skip for the launch freeze or too few stories is exit 0 with the reason printed). On failure the
 * previous active edition stays live; the workflow opens an Operations Issue.
 *
 * Usage: SCHEDULED_CONTENT_BRIDGE_TOKEN=... [BASE_URL=...] node scripts/ops/club-home-regenerate.mjs [--apply]
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
  const base = `Eligible stories: ${data.eligible_stories}. Active edition: ${data.active_edition_id ?? data.previous_edition_id ?? 'none'}.`;
  if (data.applied) return `Regenerated: new edition ${data.edition_id} (was ${data.previous_edition_id ?? 'none'}), ${data.placements} placements. ${base}`;
  if (data.skipped) return `Skipped (${data.skipped}). ${base}`;
  return `Dry run: nothing changed. ${base}`;
}

export async function main(env = process.env, argv = process.argv.slice(2), fetchImpl = fetch) {
  const options = parseArgs(argv);
  const token = env.SCHEDULED_CONTENT_BRIDGE_TOKEN;
  if (!token) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required');
  const res = await fetchImpl(`${env.BASE_URL || DEFAULT_BASE_URL}/api/scheduled-content/club-home-regenerate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply: options.apply }),
    signal: AbortSignal.timeout(60_000),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 200 || !data.ok) {
    console.error(`Club Home regeneration failed (${res.status}): ${data.error ?? 'unexpected response'}`);
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
