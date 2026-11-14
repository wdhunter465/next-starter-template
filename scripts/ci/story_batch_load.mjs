#!/usr/bin/env node
/**
 * #5244: load a batch of stories into the D1 story inventory (content_inventory) as PENDING ONLY.
 *
 * Standing Go (Product Authority, 2026-11-14, #5225 and #5224): Claude Code may load stories as pending.
 * That covers loading `draft` rows. It does not cover approving, publishing, or any other write.
 *
 * What it does: reads one batch file under data/stories/, validates every story, and inserts each as a
 * canonical `draft` row with INSERT OR IGNORE by tag. It never updates or deletes a row and never writes to B2.
 * Existing tags are skipped, so a re-run is safe.
 *
 * TARGET=dev  -> lgfc-litedev / wrangler env.preview (load and check here first)
 * TARGET=prod -> lgfc_lite Production
 *
 * Apply gates (both required): CONFIRM_WRITE === "confirm" and MODE === "apply". The default is a dry run.
 * Database identity guards refuse a dev run against Production and the reverse (same contract as #3451).
 *
 * Rollback: DELETE the loaded tags where status = 'draft' (printed in the result; see buildRollbackSql).
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
  parseProdAndPreviewD1,
  parseWranglerJson,
  redactSecrets,
} from './events_public_dev_write_2859.mjs';

export const RESULT_JSON_PATH = 'story-batch-load-result.json';
export const RESULT_MD_PATH = 'story-batch-load-result.md';
export const SOURCE_ISSUE = 5244;
export const STANDING_GO = 'Product Authority standing Go on #5225, 2026-11-14 (pending only)';
export const STORY_TYPES = ['primary', 'secondary', 'brief'];
export const MAX_STORIES_PER_BATCH = 100;
export const BATCH_DIR = 'data/stories';

const TAG_RE = /^[a-z0-9][a-z0-9-]{2,79}$/;
const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

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
  'feature_weight',
  'status',
  'review_notes',
];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** Validate a parsed batch. Returns { errors, stories } where stories are normalized. Pure. */
export function validateBatch(batch) {
  const errors = [];
  const stories = [];
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) {
    return { errors: ['batch must be an object with batch_id and stories'], stories };
  }
  if (batch.example === true) errors.push('this is an example batch (example: true) and is never loaded');
  if (!nonEmpty(batch.batch_id)) errors.push('batch_id is required');
  if (!Array.isArray(batch.stories) || batch.stories.length === 0) {
    errors.push('stories must be a non-empty array');
    return { errors, stories };
  }
  if (batch.stories.length > MAX_STORIES_PER_BATCH) {
    errors.push(`a batch holds at most ${MAX_STORIES_PER_BATCH} stories`);
  }
  const seen = new Set();
  batch.stories.forEach((raw, index) => {
    const label = `stories[${index}]${raw && raw.tag ? ` (${raw.tag})` : ''}`;
    const problems = [];
    if (!raw || typeof raw !== 'object') {
      errors.push(`${label} must be an object`);
      return;
    }
    if (!nonEmpty(raw.tag) || !TAG_RE.test(raw.tag)) problems.push('tag must be a lowercase slug of 3 to 80 characters (a-z, 0-9, hyphen)');
    if (nonEmpty(raw.tag)) {
      if (seen.has(raw.tag)) problems.push('duplicate tag in this batch');
      seen.add(raw.tag);
    }
    if (!nonEmpty(raw.title) || raw.title.length > 200) problems.push('title is required (200 characters at most)');
    if (!nonEmpty(raw.text) || raw.text.length > 20000) problems.push('text is required (20000 characters at most)');
    if (nonEmpty(raw.text) && /<\s*script/i.test(raw.text)) problems.push('text must be plain text without script tags');
    const storyType = raw.story_type === undefined ? 'brief' : raw.story_type;
    if (!STORY_TYPES.includes(storyType)) problems.push(`story_type must be one of ${STORY_TYPES.join(', ')}`);
    if (!nonEmpty(raw.credit_line)) problems.push('credit_line is required');
    if (raw.source_url !== undefined && raw.source_url !== null && !URL_RE.test(String(raw.source_url))) {
      problems.push('source_url must be an http(s) URL');
    }
    if (raw.event_date !== undefined && raw.event_date !== null && !DATE_RE.test(String(raw.event_date))) {
      problems.push('event_date must be YYYY, YYYY-MM or YYYY-MM-DD');
    }

    const verification = raw.verification;
    let verificationStatus = 'unverified';
    let sources = [];
    if (verification !== undefined) {
      if (!verification || typeof verification !== 'object') {
        problems.push('verification must be an object');
      } else {
        verificationStatus = verification.status ?? 'unverified';
        if (!['three_source_verified', 'unverified'].includes(verificationStatus)) {
          problems.push('verification.status must be three_source_verified or unverified');
        }
        sources = Array.isArray(verification.sources) ? verification.sources : [];
        if (verificationStatus === 'three_source_verified') {
          const urls = sources.map((s) => (s && typeof s.url === 'string' ? s.url.trim() : '')).filter((u) => URL_RE.test(u));
          if (new Set(urls).size < 3) problems.push('three_source_verified needs at least three distinct source URLs');
        }
      }
    }

    // Eig credit rule (#5226): an excerpt from Luckiest Man carries the credit, and the page when it is known.
    if (raw.excerpt_of !== undefined && raw.excerpt_of !== null) {
      const ex = raw.excerpt_of;
      if (!ex || typeof ex !== 'object' || !nonEmpty(ex.work) || !nonEmpty(ex.author)) {
        problems.push('excerpt_of needs work and author');
      } else if (nonEmpty(raw.credit_line)) {
        const credit = raw.credit_line.toLowerCase();
        if (!credit.includes(ex.author.toLowerCase())) problems.push(`credit_line must credit ${ex.author}`);
        if (!credit.includes(ex.work.toLowerCase())) problems.push(`credit_line must name ${ex.work}`);
        const hasPage = ex.page !== undefined && ex.page !== null && String(ex.page).trim() !== '';
        if (hasPage && !credit.includes(String(ex.page).toLowerCase())) problems.push(`credit_line must give page ${ex.page}`);
      }
    }

    if (problems.length > 0) {
      errors.push(`${label}: ${problems.join('; ')}`);
      return;
    }
    stories.push({
      tag: raw.tag,
      title: raw.title.trim(),
      text: raw.text.trim(),
      story_type: storyType,
      credit_line: raw.credit_line.trim(),
      source_name: nonEmpty(raw.source_name) ? raw.source_name.trim() : null,
      source_url: nonEmpty(raw.source_url) ? String(raw.source_url).trim() : null,
      event_date: nonEmpty(raw.event_date) ? String(raw.event_date).trim() : null,
      verification_status: verificationStatus,
      verification_sources: sources.map((s) => String(s && s.url ? s.url : '').trim()).filter(Boolean),
    });
  });
  return { errors, stories };
}

export function buildReviewNotes(story) {
  const head = `Pending load (#${SOURCE_ISSUE}; ${STANDING_GO}).`;
  if (story.verification_status === 'three_source_verified') {
    return `${head} Three-source verified: ${story.verification_sources.join(' ; ')}`;
  }
  return `${head} UNVERIFIED: needs the three-source check (#5224) before approval.`;
}

export function buildSearchText(story) {
  return `${story.title} ${story.text}`.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 4000);
}

/** One idempotent INSERT. Draft, canonical, never published. */
export function buildInsertStatement(story, columnNames) {
  const missing = REQUIRED_COLUMNS.filter((c) => !columnNames.has(c));
  if (missing.length > 0) throw new Error(`content_inventory is missing columns: ${missing.join(', ')}`);
  const values = {
    tag: story.tag,
    title: story.title,
    text: story.text,
    media: '[]',
    story_type: story.story_type,
    allowed_sections: '["library"]',
    priority: 0,
    search_text: buildSearchText(story),
    canonical: 1,
    source_name: story.source_name,
    source_url: story.source_url,
    credit_line: story.credit_line,
    event_date: story.event_date,
    feature_weight: 1,
    status: 'draft',
    review_notes: buildReviewNotes(story),
  };
  const columns = Object.keys(values);
  return `INSERT OR IGNORE INTO content_inventory (${columns.join(', ')}) VALUES (${columns.map((c) => sqlLiteral(values[c])).join(', ')});`;
}

export function planBatch(stories, existingTags) {
  const existing = new Set(existingTags);
  return {
    toInsert: stories.filter((s) => !existing.has(s.tag)),
    skipped: stories.filter((s) => existing.has(s.tag)),
  };
}

export function buildExistingTagsQuery(stories) {
  const list = stories.map((s) => sqlLiteral(s.tag)).join(', ');
  return `SELECT tag FROM content_inventory WHERE canonical = 1 AND tag IN (${list});`;
}

export function buildRollbackSql(stories) {
  const list = stories.map((s) => sqlLiteral(s.tag)).join(', ');
  return `DELETE FROM content_inventory WHERE canonical = 1 AND status = 'draft' AND tag IN (${list});`;
}

export function parseTarget(env = process.env) {
  const target = String(env.TARGET || '').trim().toLowerCase();
  return target === 'dev' || target === 'prod' ? target : null;
}

export function isApplyMode(env = process.env) {
  return env.MODE === 'apply' && env.CONFIRM_WRITE === 'confirm';
}

/** The batch file must live directly under data/stories/ and be a .json file. */
export function resolveBatchPath(input, cwd = process.cwd()) {
  const rel = String(input || '').trim();
  if (!rel) return { error: 'BATCH_FILE is required' };
  const abs = path.resolve(cwd, rel);
  const dir = path.resolve(cwd, BATCH_DIR);
  if (path.dirname(abs) !== dir || !abs.endsWith('.json')) {
    return { error: `BATCH_FILE must be a .json file directly under ${BATCH_DIR}/` };
  }
  return { abs };
}

export function buildResultMarkdown(result) {
  const lines = [
    `<!-- story-batch-load-${SOURCE_ISSUE} -->`,
    `## Story batch load (#${SOURCE_ISSUE}): ${result.mode}, target ${result.target}`,
    '',
    `- Batch: \`${result.batchId}\` (${result.storyCount} stories)`,
    `- Authority: ${STANDING_GO}`,
    `- To insert as draft: ${result.toInsert.length}; already present (skipped): ${result.skipped.length}`,
    `- Written: ${result.writeOk === true ? `yes, ${result.insertedCount ?? 0} new draft rows` : result.mode === 'apply' ? 'NO (see run log)' : 'no (dry run)'}`,
    '',
  ];
  if (result.toInsert.length) lines.push('Inserted or to insert:', ...result.toInsert.map((t) => `- \`${t}\``), '');
  if (result.skipped.length) lines.push('Skipped (tag already present):', ...result.skipped.map((t) => `- \`${t}\``), '');
  lines.push('Rollback (removes only the draft rows of this batch):', '```sql', result.rollbackSql, '```');
  return lines.join('\n');
}

function failClosed(message) {
  console.error(`FAIL (closed): ${message}`);
  process.exitCode = 1;
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

export async function main() {
  const target = parseTarget(process.env);
  if (!target) return failClosed('TARGET must be exactly "dev" or "prod".');
  const resolved = resolveBatchPath(process.env.BATCH_FILE);
  if (resolved.error) return failClosed(resolved.error);
  if (!fs.existsSync(resolved.abs)) return failClosed(`batch file not found: ${process.env.BATCH_FILE}`);
  let batch;
  try {
    batch = JSON.parse(fs.readFileSync(resolved.abs, 'utf8'));
  } catch (error) {
    return failClosed(`batch file is not valid JSON: ${error.message}`);
  }
  const { errors, stories } = validateBatch(batch);
  if (errors.length > 0) return failClosed(`batch is invalid:\n  - ${errors.join('\n  - ')}`);

  const required = target === 'dev'
    ? ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DEV_DATABASE_NAME', 'D1_DEV_DATABASE_ID']
    : ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_NAME', 'D1_DATABASE_ID'];
  const missing = required.filter((name) => !String(process.env[name] || '').trim());
  if (missing.length > 0) return failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);

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
  if (!fs.existsSync(wranglerPath)) return failClosed('wrangler.toml not found: cannot confirm expected database identity.');
  const { production, preview } = parseProdAndPreviewD1(fs.readFileSync(wranglerPath, 'utf8'));
  if (!production.databaseId || !production.databaseName || !preview.databaseId || !preview.databaseName) {
    return failClosed('Development and Production D1 identities are missing or shared: refusing (isolation contract).');
  }
  if (production.databaseId === preview.databaseId) {
    return failClosed('Development and Production D1 identities are shared: refusing (isolation contract).');
  }
  const expected = target === 'dev' ? preview : production;
  const dbName = target === 'dev' ? process.env.D1_DEV_DATABASE_NAME : process.env.D1_DATABASE_NAME;
  const dbId = target === 'dev' ? process.env.D1_DEV_DATABASE_ID : process.env.D1_DATABASE_ID;
  if (dbName !== expected.databaseName) return failClosed(`wrong database identity: secret name does not match wrangler.toml ${target} database.`);
  if (dbId !== expected.databaseId) return failClosed(`wrong database identity: secret id does not match wrangler.toml ${target} database_id.`);
  if (target === 'dev' && dbId === production.databaseId) return failClosed('the dev database id matches Production: refusing.');
  if (target === 'prod' && dbId === preview.databaseId) return failClosed('the prod database id matches Development/Preview: refusing.');

  const info = runWrangler(['d1', 'info', dbName, '--json']);
  if (info.error || info.status !== 0) {
    return failClosed(`wrangler d1 info failed (exit ${info.status ?? 'spawn error'}). ${buildDiagnosticSnippet(info, redact)}`);
  }
  let remoteUuid;
  try {
    remoteUuid = extractDatabaseUuid(parseWranglerJson(info.stdout));
  } catch (error) {
    return failClosed(`could not parse wrangler d1 info output: ${error.message}`);
  }
  if (!remoteUuid || remoteUuid !== expected.databaseId) {
    return failClosed(`live database uuid does not match the expected ${target} database_id: refusing.`);
  }
  if (target === 'dev' && remoteUuid === production.databaseId) return failClosed('live database matches Production: refusing.');
  if (target === 'prod' && remoteUuid === preview.databaseId) return failClosed('live database matches Development/Preview: refusing.');

  const executeArgs = ['d1', 'execute', dbName, '--remote'];
  if (target === 'dev') executeArgs.push('--env', 'preview');
  const runD1Query = (sql, label) => {
    const res = runWrangler([...executeArgs, '--command', sql, '--json']);
    if (res.error || res.status !== 0) {
      failClosed(`wrangler d1 execute failed (${label}) (exit ${res.status ?? 'spawn error'}). ${buildDiagnosticSnippet(res, redact)}`);
      return null;
    }
    try {
      return extractD1Rows(parseWranglerJson(res.stdout));
    } catch (error) {
      failClosed(`could not parse wrangler output (${label}): ${error.message}`);
      return null;
    }
  };

  const pragma = runD1Query('PRAGMA table_info(content_inventory);', 'table_info');
  if (pragma === null) return;
  const columnNames = new Set(pragma.map((row) => row.name));
  const existing = runD1Query(buildExistingTagsQuery(stories), 'existing tags');
  if (existing === null) return;
  const plan = planBatch(stories, existing.map((row) => row.tag));
  const applyMode = isApplyMode(process.env);
  const result = {
    checkedAt: new Date().toISOString(),
    target,
    mode: applyMode ? 'apply' : 'dry-run',
    batchId: batch.batch_id,
    storyCount: stories.length,
    toInsert: plan.toInsert.map((s) => s.tag),
    skipped: plan.skipped.map((s) => s.tag),
    rollbackSql: buildRollbackSql(stories),
  };

  if (!applyMode) {
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log(`OK: dry run on ${target}. ${plan.toInsert.length} to insert as draft, ${plan.skipped.length} already present. Nothing was written.`);
    return;
  }

  if (plan.toInsert.length > 0) {
    const sql = plan.toInsert.map((s) => buildInsertStatement(s, columnNames)).join('\n');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-batch-'));
    const tmpFile = path.join(tmpDir, 'load.sql');
    try {
      fs.writeFileSync(tmpFile, `${sql}\n`);
      const write = runWrangler([...executeArgs, '-y', '--file', tmpFile, '--json']);
      if (write.error || write.status !== 0) {
        result.writeOk = false;
        fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
        fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
        return failClosed(`write failed (exit ${write.status ?? 'spawn error'}). ${buildDiagnosticSnippet(write, redact)}`);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
  const after = runD1Query(buildExistingTagsQuery(stories), 'post-write tags');
  if (after === null) return;
  const present = new Set(after.map((row) => row.tag));
  const missingAfter = stories.filter((s) => !present.has(s.tag)).map((s) => s.tag);
  result.writeOk = missingAfter.length === 0;
  result.insertedCount = plan.toInsert.length;
  result.missingAfter = missingAfter;
  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
  if (!result.writeOk) return failClosed(`some tags are still missing after the write: ${missingAfter.join(', ')}`);
  console.log(`OK: apply on ${target}. ${plan.toInsert.length} draft rows inserted, ${plan.skipped.length} skipped, all ${stories.length} tags present.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => failClosed(error instanceof Error ? error.message : String(error)));
}
