// #5218 -- pure helpers for the edition plan writer: the pool query, the pool mapping, the dry-run report and the
// guards on the write. Nothing here touches a database; the CLI in edition-plan-write.mjs runs the SQL.

import { TARGET } from './inventory-progress-lib.mjs';

export const PLAN_START = '2027-01-01';
export const PLAN_END = '2027-12-31';
export const MARKER = '<!-- edition-plan-write-5218 -->';
export const PRODUCTION_DATABASE = 'lgfc_lite';
export const GO_COMMENT_PATTERN = /^https:\/\/github\.com\/wdhunter465\/next-starter-template\/issues\/5218#issuecomment-\d+$/;

// A story is a canonical, published content_inventory row. Its picture is the first associated photo that is
// publication_eligible and off rights hold, the same test the site and the inventory progress report use.
export const POOL_SQL = `
SELECT ci.id AS id,
       ci.title AS title,
       ci.summary AS summary,
       ci.text AS text,
       ci.last_featured AS last_featured,
       p.url AS image_url,
       COALESCE(NULLIF(trim(cim.alt_text), ''), NULLIF(trim(cim.caption), '')) AS image_alt
  FROM content_inventory ci
  JOIN content_inventory_media cim
    ON cim.story_id = ci.id
   AND cim.id = (
        SELECT m.id
          FROM content_inventory_media m
          JOIN photos pp ON pp.id = m.media_id
         WHERE m.story_id = ci.id
           AND m.media_role IN ('primary_image', 'gallery_image', 'supporting_image')
           AND COALESCE(pp.rights_status, 'unreviewed') NOT IN ('blocked', 'copyright_restricted')
         ORDER BY m.display_order ASC, m.id ASC
         LIMIT 1)
  JOIN photos p ON p.id = cim.media_id
 WHERE ci.canonical = 1
   AND ci.status = 'published'
 ORDER BY ci.id ASC`;

function firstSentences(text, max) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Maps POOL_SQL rows to planner pool items. The story link is not set: no per-story public route is recorded yet. */
export function rowsToPool(rows) {
  return (rows ?? [])
    .filter((row) => row && row.image_url)
    .map((row) => ({
      id: String(row.id),
      title: String(row.title ?? '').trim(),
      caption: String(row.summary ?? '').trim() || firstSentences(row.text, 280),
      post_url: null,
      image_url: String(row.image_url),
      image_alt: String(row.image_alt ?? '').trim() || String(row.title ?? '').trim() || null,
      usage_count: 0,
      last_featured: row.last_featured ?? null,
    }));
}

export function daysInWindow(start, end) {
  const toMs = (value) => {
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return toMs(end) < toMs(start) ? 0 : Math.round((toMs(end) - toMs(start)) / 86_400_000) + 1;
}

/**
 * The write is refused unless every guard holds. The dry run needs none of them.
 * - an explicit --apply
 * - a link to the Go comment on #5218
 * - for the Production database, LGFC_EDITION_PLAN_PRODUCTION=yes
 * - for the Production database, a pool of at least the confirmed target (Product Authority's condition of 2026-11-13)
 *   and at least one story a day, unless --allow-shortfall is given on a non-Production database
 */
export function applyGuardFailures({ apply, goUrl, database, env = {}, poolSize, days, allowShortfall = false }) {
  const failures = [];
  if (!apply) return failures;
  if (!goUrl || !GO_COMMENT_PATTERN.test(goUrl)) failures.push('--confirm-go must be a link to the Go comment on issue 5218');
  const production = database === PRODUCTION_DATABASE;
  if (production && env.LGFC_EDITION_PLAN_PRODUCTION !== 'yes') {
    failures.push('LGFC_EDITION_PLAN_PRODUCTION=yes is required to write to the Production database');
  }
  if (production && poolSize < TARGET) {
    failures.push(`pool has ${poolSize} stories; the Go takes effect at ${TARGET} approved stories with a cleared picture`);
  }
  if (production && allowShortfall) failures.push('--allow-shortfall is not allowed on the Production database');
  if (!allowShortfall && poolSize < days) {
    failures.push(`pool has ${poolSize} stories for ${days} days; use --allow-shortfall on a non-Production database to write anyway`);
  }
  return failures;
}

export function dryRunReport({ plan, rows, poolSize, start, end, planVersion, database, sampleSize = 6 }) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.surface}/${row.platform}`;
    const entry = byKey.get(key) ?? { total: 0, planned: 0, skipped: 0 };
    entry.total += 1;
    if (row.status === 'planned') entry.planned += 1;
    else entry.skipped += 1;
    byKey.set(key, entry);
  }
  const shortfalls = plan.summary.shortfalls;
  const lines = [
    MARKER,
    '## Edition plan dry run',
    '',
    `Database: \`${database}\` (read only). Window: ${start} to ${end}. Plan version: \`${planVersion}\`. Nothing was written.`,
    '',
    `- Pool: ${poolSize} published stories with a cleared picture`,
    `- Rows to write: ${rows.length}`,
    `- Website items used: ${plan.summary.website_items_used}; social items used: ${plan.summary.social_items_used}`,
    `- Shortfall days: ${shortfalls.length}${shortfalls.length ? ` (first: ${shortfalls[0].date} ${shortfalls[0].surface} ${shortfalls[0].reason})` : ''}`,
    `- Budget-deferred social days: ${plan.summary.budget_deferred_days.length}`,
    '',
    '| Surface / platform | Rows | Planned | Skipped |',
    '| --- | ---: | ---: | ---: |',
    ...[...byKey.entries()].sort().map(([key, v]) => `| ${key} | ${v.total} | ${v.planned} | ${v.skipped} |`),
    '',
    'Tasks by month (Zapier budget):',
    ...Object.entries(plan.summary.tasks_by_month).sort().map(([month, tasks]) => `- ${month}: ${tasks}`),
    '',
    'Sample rows:',
    '',
    '| Date | Surface | Platform | Item | Status |',
    '| --- | --- | --- | --- | --- |',
    ...rows.slice(0, sampleSize).map((r) => `| ${r.edition_date} | ${r.surface} | ${r.platform} | ${r.content_item_id ?? ''} | ${r.status} |`),
  ];
  return lines.join('\n');
}

export function parseArgs(argv, today = new Date().toISOString().slice(0, 10)) {
  const options = {
    database: 'lgfc_lite',
    target: 'remote',
    start: PLAN_START,
    end: PLAN_END,
    planVersion: `plan-${today}`,
    out: 'edition-plan-dry-run.md',
    apply: false,
    goUrl: '',
    allowShortfall: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--database') options.database = argv[++i];
    else if (arg === '--local') options.target = 'local';
    else if (arg === '--remote') options.target = 'remote';
    else if (arg === '--start') options.start = argv[++i];
    else if (arg === '--end') options.end = argv[++i];
    else if (arg === '--plan-version') options.planVersion = argv[++i];
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--confirm-go') options.goUrl = argv[++i];
    else if (arg === '--allow-shortfall') options.allowShortfall = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}
