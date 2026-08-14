#!/usr/bin/env node
/**
 * #3451 — gated Dev-then-Production load of exactly six Lou Gehrig book records
 * into content_inventory. Product Authority (Bill, 2026-08-14) authorized only
 * these six published library rows. No schema changes, destructive writes,
 * library retirement, B2 writes, or unrelated publication.
 *
 * TARGET=dev  → lgfc-litedev / wrangler env.preview (must succeed before prod)
 * TARGET=prod → lgfc_lite Production (cites #3268 backup/recovery before mutate)
 *
 * Apply gates (both required):
 *   1. CONFIRM_WRITE === "confirm"
 *   2. MODE === "apply"  (default dry-run never writes)
 *
 * Collision: fail closed when a canonical row already exists under one of the
 * six tags with a non-matching title (different content under the authorized tag).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { sqlLiteral } from '../migrations/events-public-content-backfill.mjs';
import {
  buildDiagnosticSnippet,
  extractD1Rows,
  extractDatabaseUuid,
  parseCount,
  parseProdAndPreviewD1,
  parseWranglerJson,
  redactSecrets,
} from './events_public_dev_write_2859.mjs';

export const RESULT_JSON_PATH = 'library-books-content-load-3451-result.json';
export const RESULT_MD_PATH = 'library-books-content-load-3451-result.md';

export const SOURCE_ISSUE = 3451;
export const BACKUP_EVIDENCE_ISSUE = 3268;
export const BACKUP_EVIDENCE_COMMENT = '5252882921';
export const BACKUP_R2_BUCKET = 'lgfc-d1-backups';

export const REQUIRED_COLUMNS = [
  'tag',
  'title',
  'text',
  'media',
  'story_type',
  'allowed_sections',
  'priority',
  'search_text',
  'canonical',
  'source_name',
  'source_url',
  'credit_line',
  'event_date',
  'rotation_group',
  'last_featured',
  'feature_weight',
  'status',
];

export const OPTIONAL_COLUMNS = ['summary', 'perspective_label', 'event_year', 'published_at'];

export const BOOK_RECORDS = [
  {
    tag: 'library-book-luckiest-man-eig',
    title: 'Luckiest Man: The Life and Death of Lou Gehrig',
    author: 'Jonathan Eig',
    publisher: 'Simon & Schuster',
    eventYear: 2005,
    isbn: '9780743245913',
    sourceName: 'Simon & Schuster / Google Books bibliographic record',
    sourceUrl: 'https://books.google.com/books/about/Luckiest_Man.html?id=7SgyXXadMIYC',
    creditLine:
      'Jonathan Eig, Luckiest Man: The Life and Death of Lou Gehrig (Simon & Schuster, 2005)',
    text: 'Jonathan Eig’s extensively researched biography follows Lou Gehrig from his New York childhood and Columbia years through his Yankees career, marriage, ALS diagnosis, retirement, and final years. The book draws on interviews and previously unpublished correspondence to present a detailed portrait of Gehrig’s public achievements and private life.',
    searchGenre: 'biography',
  },
  {
    tag: 'library-book-lou-gehrig-biography-kashatus',
    title: 'Lou Gehrig: A Biography',
    author: 'William C. Kashatus',
    publisher: 'Bloomsbury Academic',
    eventYear: 2004,
    isbn: '9780313328664',
    sourceName: 'Bloomsbury Academic / Google Books bibliographic record',
    sourceUrl: 'https://books.google.com/books?id=xw2ErZdRhNIC',
    creditLine: 'William C. Kashatus, Lou Gehrig: A Biography (Bloomsbury Academic, 2004)',
    text: 'Historian William C. Kashatus surveys Gehrig’s family background, education at Columbia, major-league career, celebrated durability and hitting, illness, and enduring cultural legacy. The biography also considers the literature and film that helped shape Gehrig’s public memory.',
    searchGenre: 'biography',
  },
  {
    tag: 'library-book-luckiest-man-adler',
    title: 'Lou Gehrig: The Luckiest Man',
    author: 'David A. Adler; illustrated by Terry Widener',
    publisher: 'Houghton Mifflin Harcourt',
    eventYear: 1997,
    isbn: '9780152005238',
    sourceName: 'Houghton Mifflin Harcourt / Google Books bibliographic record',
    sourceUrl: 'https://books.google.com/books/about/Lou_Gehrig.html?id=Qg8x9kf30ZcC',
    creditLine:
      'David A. Adler, Lou Gehrig: The Luckiest Man, illustrated by Terry Widener (Houghton Mifflin Harcourt, 1997)',
    text: 'A concise illustrated biography for younger readers, David A. Adler’s book traces Gehrig from childhood through his Yankees career, his record-setting consecutive-games streak, his ALS diagnosis, and the courage associated with his farewell from baseball.',
    searchGenre: 'biography',
  },
  {
    tag: 'library-book-pride-of-the-yankees-gallico',
    title: 'Lou Gehrig: Pride of the Yankees',
    author: 'Paul Gallico',
    publisher: 'Open Road Media',
    eventYear: 2015,
    isbn: '9781504009492',
    sourceName: 'Open Road Media / Google Books bibliographic record',
    sourceUrl: 'https://books.google.com/books/about/Lou_Gehrig.html?id=MceZBgAAQBAJ',
    creditLine: 'Paul Gallico, Lou Gehrig: Pride of the Yankees (1942; Open Road Media edition, 2015)',
    text: 'Sportswriter Paul Gallico’s early biography recounts Gehrig’s rise from a working-class New York family to Yankees stardom, his relationship to the great teams of his era, and the illness that ended his career. The book became a principal source for the classic film The Pride of the Yankees.',
    searchGenre: 'biography',
  },
  {
    tag: 'library-book-iron-horse-robinson',
    title: 'Iron Horse: Lou Gehrig in His Time',
    author: 'Ray Robinson',
    publisher: 'W. W. Norton & Company',
    eventYear: 1990,
    isbn: '9780393028577',
    sourceName: 'W. W. Norton & Company / Publishers Weekly bibliographic record',
    sourceUrl: 'https://www.publishersweekly.com/9780393028577',
    creditLine: 'Ray Robinson, Iron Horse: Lou Gehrig in His Time (W. W. Norton & Company, 1990)',
    text: 'Ray Robinson places Gehrig’s career and personality in the context of his era, covering his immigrant-family background, Columbia years, Yankees success, relationship with Babe Ruth, marriage, public reserve, and final struggle with ALS.',
    searchGenre: 'biography',
  },
  {
    tag: 'library-book-lost-memoir-gaff',
    title: 'Lou Gehrig: The Lost Memoir',
    author: 'Lou Gehrig, with biographical essay by Alan D. Gaff',
    publisher: 'Simon & Schuster',
    eventYear: 2020,
    isbn: '9781982132392',
    sourceName: 'Simon & Schuster official publisher record',
    sourceUrl: 'https://www.simonandschuster.com/books/Lou-Gehrig/Alan-D-Gaff/9781982132392',
    creditLine: 'Lou Gehrig, with Alan D. Gaff, Lou Gehrig: The Lost Memoir (Simon & Schuster, 2020)',
    text: 'This volume republishes a series of autobiographical newspaper columns Gehrig produced in 1927, giving a first-person account of his upbringing, early baseball career, teammates, and life during the Yankees’ championship era. Historian Alan D. Gaff adds a biographical essay placing the recovered memoir in context.',
    searchGenre: 'memoir',
  },
];

export const BOOK_TAGS = BOOK_RECORDS.map((book) => book.tag);

export const ROLLBACK_SQL = `DELETE FROM content_inventory WHERE canonical = 1 AND tag IN (${BOOK_TAGS.map(sqlLiteral).join(', ')});`;

const PUBLISHED_AT_EXPR = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export function parseTarget(env = process.env) {
  const target = String(env.TARGET || '').trim().toLowerCase();
  return target === 'dev' || target === 'prod' ? target : '';
}

export function isApplyMode(env = process.env) {
  return env.MODE === 'apply' && env.CONFIRM_WRITE === 'confirm';
}

export function requireEnv(target, env = process.env) {
  const names = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
  if (target === 'dev') names.push('D1_DEV_DATABASE_NAME', 'D1_DEV_DATABASE_ID');
  if (target === 'prod') names.push('D1_DATABASE_NAME', 'D1_DATABASE_ID');
  return names.filter((name) => !env[name]);
}

export function buildSearchText(book) {
  return [
    book.title,
    book.author,
    book.publisher,
    String(book.eventYear),
    book.isbn,
    'Lou Gehrig',
    'baseball',
    book.searchGenre,
    book.tag,
  ].join(' ');
}

export function buildCanonicalFields(book) {
  return {
    tag: book.tag,
    title: book.title,
    text: book.text,
    media: '[]',
    story_type: 'brief',
    allowed_sections: '["library"]',
    priority: 0,
    search_text: buildSearchText(book),
    canonical: 1,
    source_name: book.sourceName,
    source_url: book.sourceUrl,
    credit_line: book.creditLine,
    event_date: null,
    rotation_group: null,
    last_featured: null,
    feature_weight: 1,
    status: 'published',
    summary: book.text,
    perspective_label: null,
    event_year: book.eventYear,
  };
}

export function columnNamesFromPragma(rows) {
  return new Set((rows || []).map((row) => String(row.name || row.Name || '')).filter(Boolean));
}

export function missingRequiredColumns(columnNames) {
  return REQUIRED_COLUMNS.filter((name) => !columnNames.has(name));
}

export function tagInListSql() {
  return BOOK_TAGS.map(sqlLiteral).join(', ');
}

export function existingBooksQuery() {
  return `SELECT id, tag, title, text, credit_line, source_name, source_url, status, summary, search_text, allowed_sections, canonical, media, story_type, priority, feature_weight, event_year FROM content_inventory WHERE canonical = 1 AND tag IN (${tagInListSql()});`;
}

export function libraryEligibleCountQuery() {
  return `SELECT COUNT(1) AS n FROM content_inventory WHERE status = 'published' AND lower(COALESCE(allowed_sections,'')) LIKE '%library%' AND COALESCE(TRIM(source_name), '') != '' AND COALESCE(TRIM(credit_line), '') != '' AND canonical = 1 AND tag IN (${tagInListSql()});`;
}

export function totalInventoryCountQuery() {
  return 'SELECT COUNT(1) AS n FROM content_inventory;';
}

function fieldsMatch(existing, fields) {
  const comparable = [
    'title',
    'text',
    'credit_line',
    'source_name',
    'source_url',
    'status',
    'summary',
    'search_text',
    'allowed_sections',
    'media',
    'story_type',
  ];
  for (const key of comparable) {
    if (String(existing[key] ?? '') !== String(fields[key] ?? '')) return false;
  }
  if (Number(existing.canonical) !== 1) return false;
  if (Number(existing.priority) !== fields.priority) return false;
  if (Number(existing.feature_weight) !== fields.feature_weight) return false;
  if (Number(existing.event_year ?? 0) !== Number(fields.event_year)) return false;
  return true;
}

export function planBooks(existingRows) {
  const existingByTag = new Map((existingRows || []).map((row) => [row.tag, row]));
  const plans = BOOK_RECORDS.map((book) => {
    const fields = buildCanonicalFields(book);
    const existing = existingByTag.get(book.tag);
    if (!existing) {
      return { action: 'insert', tag: book.tag, fields };
    }
    if (String(existing.title || '') !== book.title) {
      return {
        action: 'conflict',
        tag: book.tag,
        exceptionCode: 'TAG_COLLISION_NON_MATCHING_TITLE',
        existingId: existing.id,
      };
    }
    if (fieldsMatch(existing, fields)) {
      return { action: 'noop', tag: book.tag, id: existing.id, fields };
    }
    const willBecomePublished = fields.status === 'published' && existing.status !== 'published';
    return { action: 'update', tag: book.tag, id: existing.id, fields, willBecomePublished };
  });

  const summary = { insert: 0, update: 0, noop: 0, conflict: 0 };
  for (const plan of plans) summary[plan.action] += 1;
  return { plans, summary };
}

function assignment(column, value) {
  return `${column} = ${sqlLiteral(value)}`;
}

export function buildInsertStatement(fields, columnNames) {
  const columns = [];
  const values = [];
  const push = (column, value) => {
    if (!columnNames.has(column)) return;
    columns.push(column);
    values.push(sqlLiteral(value));
  };
  push('tag', fields.tag);
  push('title', fields.title);
  push('text', fields.text);
  push('media', fields.media);
  push('story_type', fields.story_type);
  push('allowed_sections', fields.allowed_sections);
  push('priority', fields.priority);
  push('search_text', fields.search_text);
  push('canonical', fields.canonical);
  push('source_name', fields.source_name);
  push('source_url', fields.source_url);
  push('credit_line', fields.credit_line);
  push('event_date', fields.event_date);
  push('rotation_group', fields.rotation_group);
  push('last_featured', fields.last_featured);
  push('feature_weight', fields.feature_weight);
  push('status', fields.status);
  push('summary', fields.summary);
  push('perspective_label', fields.perspective_label);
  push('event_year', fields.event_year);
  if (columnNames.has('published_at')) {
    columns.push('published_at');
    values.push(PUBLISHED_AT_EXPR);
  }
  return `INSERT INTO content_inventory (${columns.join(', ')}) VALUES (${values.join(', ')});`;
}

export function buildUpdateStatement(id, fields, columnNames, willBecomePublished) {
  const assignments = [];
  const push = (column, value) => {
    if (!columnNames.has(column)) return;
    assignments.push(assignment(column, value));
  };
  push('title', fields.title);
  push('text', fields.text);
  push('media', fields.media);
  push('story_type', fields.story_type);
  push('allowed_sections', fields.allowed_sections);
  push('priority', fields.priority);
  push('search_text', fields.search_text);
  push('canonical', fields.canonical);
  push('source_name', fields.source_name);
  push('source_url', fields.source_url);
  push('credit_line', fields.credit_line);
  push('event_date', fields.event_date);
  push('rotation_group', fields.rotation_group);
  push('last_featured', fields.last_featured);
  push('feature_weight', fields.feature_weight);
  push('status', fields.status);
  push('summary', fields.summary);
  push('perspective_label', fields.perspective_label);
  push('event_year', fields.event_year);
  if (columnNames.has('updated_at')) assignments.push(`updated_at = ${PUBLISHED_AT_EXPR}`);
  if (willBecomePublished && columnNames.has('published_at')) {
    assignments.push(`published_at = ${PUBLISHED_AT_EXPR}`);
  }
  return `UPDATE content_inventory SET ${assignments.join(', ')} WHERE id = ${Number(id)};`;
}

export function buildStatementsForPlan(plan, columnNames) {
  const statements = [];
  for (const item of plan.plans) {
    if (item.action === 'insert') statements.push(buildInsertStatement(item.fields, columnNames));
    if (item.action === 'update') {
      statements.push(
        buildUpdateStatement(item.id, item.fields, columnNames, item.willBecomePublished),
      );
    }
  }
  return statements;
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- library-books-content-load-3451 -->',
    `## #3451 six-book content_inventory load — ${result.mode} (${result.target})`,
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Target: ${result.target}`,
    `- Database name: ${result.databaseName}`,
    `- Database id: ${result.databaseId}`,
    `- Mode: ${result.mode}`,
    `- Insert: ${result.summary?.insert ?? 0}`,
    `- Update: ${result.summary?.update ?? 0}`,
    `- Noop: ${result.summary?.noop ?? 0}`,
    `- Conflict: ${result.summary?.conflict ?? 0}`,
    `- Pre inventory count: ${result.preInventoryCount ?? 'n/a'}`,
    `- Post inventory count: ${result.postInventoryCount ?? 'n/a'}`,
    `- Library-eligible authorized tags: ${result.libraryEligibleCount ?? 'n/a'} / 6`,
    `- Authorized tags: ${BOOK_TAGS.join(', ')}`,
  ];
  if (result.target === 'prod') {
    lines.push(
      `- Backup/recovery evidence: Issue #${BACKUP_EVIDENCE_ISSUE} Phase 2 R2 bucket \`${BACKUP_R2_BUCKET}\` (comment ${BACKUP_EVIDENCE_COMMENT}) cited before Production mutation.`,
    );
  }
  if (result.exceptions?.length) {
    lines.push('', 'Conflicts:');
    for (const item of result.exceptions) {
      lines.push(`- ${item.tag}: ${item.code}`);
    }
  }
  lines.push('', 'Rollback (authorized six tags only):', '', '```sql', ROLLBACK_SQL, '```');
  if (result.writeOk === false) {
    lines.push('', `Write failed: ${result.writeFailureReason || 'unknown'}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
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

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No write beyond what is explicitly reported above was attempted.');
  process.exitCode = 1;
}

export async function main() {
  const target = parseTarget(process.env);
  if (!target) {
    failClosed('TARGET must be exactly "dev" or "prod".');
    return;
  }

  const missing = requireEnv(target, process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  const redact = (text) =>
    redactSecrets(text, [
      process.env.CLOUDFLARE_API_TOKEN,
      process.env.CLOUDFLARE_ACCOUNT_ID,
      process.env.D1_DEV_DATABASE_NAME,
      process.env.D1_DEV_DATABASE_ID,
      process.env.D1_DATABASE_NAME,
      process.env.D1_DATABASE_ID,
    ]);

  const wranglerPath = path.resolve(process.cwd(), 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    failClosed('wrangler.toml not found — cannot confirm expected database identity.');
    return;
  }
  const identities = parseProdAndPreviewD1(fs.readFileSync(wranglerPath, 'utf8'));
  const production = identities.production;
  const preview = identities.preview;
  if (!production.databaseId || !production.databaseName || !preview.databaseId || !preview.databaseName) {
    failClosed('Development and Production D1 identities are missing or shared — refusing (isolation contract).');
    return;
  }
  if (production.databaseId === preview.databaseId) {
    failClosed('Development and Production D1 identities are shared — refusing (isolation contract).');
    return;
  }

  const expected = target === 'dev' ? preview : production;
  const dbName = target === 'dev' ? process.env.D1_DEV_DATABASE_NAME : process.env.D1_DATABASE_NAME;
  const dbId = target === 'dev' ? process.env.D1_DEV_DATABASE_ID : process.env.D1_DATABASE_ID;

  if (dbName !== expected.databaseName) {
    failClosed(
      `wrong database identity — secret name does not match wrangler.toml ${target} database ("${expected.databaseName}").`,
    );
    return;
  }
  if (dbId !== expected.databaseId) {
    failClosed(`wrong database identity — secret id does not match wrangler.toml ${target} database_id.`);
    return;
  }
  if (target === 'dev' && dbId === production.databaseId) {
    failClosed('D1_DEV_DATABASE_ID matches Production — refusing to proceed.');
    return;
  }
  if (target === 'prod' && dbId === preview.databaseId) {
    failClosed('D1_DATABASE_ID matches Development/Preview — refusing to proceed.');
    return;
  }

  const info = runWrangler(['d1', 'info', dbName, '--json']);
  if (info.error || info.status !== 0) {
    const snippet = buildDiagnosticSnippet(info, redact);
    failClosed(
      `wrangler d1 info failed (exit ${info.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
    );
    return;
  }
  let infoParsed;
  try {
    infoParsed = parseWranglerJson(info.stdout);
  } catch (error) {
    failClosed(`could not parse wrangler d1 info output: ${error.message}`);
    return;
  }
  const remoteUuid = extractDatabaseUuid(infoParsed);
  if (!remoteUuid) {
    failClosed('wrangler d1 info returned no database uuid.');
    return;
  }
  if (remoteUuid !== expected.databaseId) {
    failClosed(`live database uuid does not match expected ${target} database_id — refusing.`);
    return;
  }
  if (target === 'dev' && remoteUuid === production.databaseId) {
    failClosed('live database uuid matches Production — refusing.');
    return;
  }
  if (target === 'prod' && remoteUuid === preview.databaseId) {
    failClosed('live database uuid matches Development/Preview — refusing.');
    return;
  }

  const executeArgs = ['d1', 'execute', dbName, '--remote'];
  if (target === 'dev') executeArgs.push('--env', 'preview');

  function runD1Query(sql, label) {
    const res = runWrangler([...executeArgs, '--command', sql, '--json']);
    if (res.error || res.status !== 0) {
      const snippet = buildDiagnosticSnippet(res, redact);
      failClosed(
        `wrangler d1 execute failed (${label}) (exit ${res.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
      );
      return null;
    }
    try {
      return extractD1Rows(parseWranglerJson(res.stdout));
    } catch (error) {
      failClosed(`could not parse wrangler output (${label}): ${error.message}`);
      return null;
    }
  }

  const pragmaRows = runD1Query('PRAGMA table_info(content_inventory);', 'table_info');
  if (pragmaRows === null) return;
  const columnNames = columnNamesFromPragma(pragmaRows);
  const missingCols = missingRequiredColumns(columnNames);
  if (missingCols.length > 0) {
    failClosed(`schema mismatch — missing required content_inventory columns: ${missingCols.join(', ')}.`);
    return;
  }

  const existingRows = runD1Query(existingBooksQuery(), 'existing authorized tags');
  if (existingRows === null) return;
  const preInventory = runD1Query(totalInventoryCountQuery(), 'pre inventory count');
  if (preInventory === null) return;

  const plan = planBooks(existingRows);
  const applyMode = isApplyMode(process.env);
  const result = {
    checkedAt: new Date().toISOString(),
    target,
    mode: applyMode ? 'apply' : 'dry-run',
    databaseName: expected.databaseName,
    databaseId: expected.databaseId,
    summary: plan.summary,
    exceptions: plan.plans
      .filter((item) => item.action === 'conflict')
      .map((item) => ({ tag: item.tag, code: item.exceptionCode })),
    preInventoryCount: parseCount(preInventory),
    backupEvidence:
      target === 'prod'
        ? {
            issue: BACKUP_EVIDENCE_ISSUE,
            comment: BACKUP_EVIDENCE_COMMENT,
            bucket: BACKUP_R2_BUCKET,
          }
        : null,
  };

  if (plan.summary.conflict > 0) {
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    failClosed(`refusing: ${plan.summary.conflict} TAG_COLLISION_NON_MATCHING_TITLE conflict(s).`);
    return;
  }

  if (!applyMode) {
    const eligible = runD1Query(libraryEligibleCountQuery(), 'library eligible count');
    if (eligible === null) return;
    result.libraryEligibleCount = parseCount(eligible);
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log(
      `OK: dry-run complete (${target}). insert=${plan.summary.insert} update=${plan.summary.update} noop=${plan.summary.noop} conflict=0.`,
    );
    return;
  }

  const statements = buildStatementsForPlan(plan, columnNames);
  if (statements.length === 0) {
    const eligible = runD1Query(libraryEligibleCountQuery(), 'library eligible count');
    if (eligible === null) return;
    result.writeOk = true;
    result.statementCount = 0;
    result.postInventoryCount = result.preInventoryCount;
    result.libraryEligibleCount = parseCount(eligible);
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log(`OK: apply mode, nothing to write (idempotent no-op) on ${target}.`);
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-books-3451-'));
  const tmpFile = path.join(tmpDir, 'load.sql');
  try {
    fs.writeFileSync(tmpFile, `${statements.join('\n')}\n`);
    const writeArgs = [...executeArgs, '-y', '--file', tmpFile, '--json'];
    const writeRes = runWrangler(writeArgs);
    if (writeRes.error || writeRes.status !== 0) {
      const snippet = buildDiagnosticSnippet(writeRes, redact);
      result.writeOk = false;
      result.writeFailureReason = `wrangler d1 execute failed (exit ${writeRes.status ?? 'spawn error'})`;
      fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
      fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
      failClosed(
        `write failed (exit ${writeRes.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
      );
      return;
    }
    result.writeOk = true;
    result.statementCount = statements.length;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const postInventory = runD1Query(totalInventoryCountQuery(), 'post inventory count');
  if (postInventory === null) return;
  const postBooks = runD1Query(existingBooksQuery(), 'post authorized tags');
  if (postBooks === null) return;
  const eligible = runD1Query(libraryEligibleCountQuery(), 'post library eligible count');
  if (eligible === null) return;

  result.postInventoryCount = parseCount(postInventory);
  result.libraryEligibleCount = parseCount(eligible);
  const expectedDelta = plan.summary.insert;
  const actualDelta = result.postInventoryCount - result.preInventoryCount;
  if (actualDelta !== expectedDelta) {
    result.writeOk = false;
    result.writeFailureReason = `unrelated row-count delta: expected +${expectedDelta}, observed +${actualDelta}`;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    failClosed(result.writeFailureReason);
    return;
  }
  if (result.libraryEligibleCount !== 6) {
    result.writeOk = false;
    result.writeFailureReason = `library-eligible authorized tags = ${result.libraryEligibleCount}, expected 6`;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    failClosed(result.writeFailureReason);
    return;
  }

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
  console.log(
    `OK: apply complete (${target}). statements=${statements.length}, postInventoryCount=${result.postInventoryCount}, libraryEligible=6.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    process.exit(process.exitCode ?? 0);
  });
}
