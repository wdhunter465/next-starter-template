#!/usr/bin/env node
/**
 * Dry run of the calendar import (#4889): reads an ICS file, prints what would be imported and what is skipped
 * and why. Writes nothing. The scheduled job and the apply step need Product Authority's Go, the calendar
 * credential, and workflow approval (see the Issue).
 * Usage: node scripts/calendar/ics-import-dry-run.mjs <feed.ics> [source-name]
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { planImport } from './ics-import-lib.mjs';

export function dryRun(icsText, source = 'lgfc-calendar') {
  const { rows, skipped } = planImport(icsText, source);
  return { source, would_import: rows, skipped, counts: { import: rows.length, skipped: skipped.length } };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [file, source] = process.argv.slice(2);
  if (!file) { console.error('usage: ics-import-dry-run.mjs <feed.ics> [source-name]'); process.exit(2); }
  console.log(JSON.stringify(dryRun(readFileSync(file, 'utf8'), source), null, 2));
}
