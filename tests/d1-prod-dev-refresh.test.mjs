import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

import {
  CONFIRM_DEV_RESET_TOKEN,
  CONFIRM_TOKEN,
  DEV_ID,
  DEV_NAME,
  PROD_ID,
  PROD_NAME,
  buildDevLoadSql,
  isInternalDumpTable,
  parseInsertDump,
  parseSqlValueToken,
  runRefreshPipeline,
  splitSqlArgs,
  validateManualInputs,
  validateSourceTargetIdentities,
} from '../scripts/ci/d1_prod_dev_refresh.mjs';
import { loadManifest } from '../scripts/ci/d1_prod_dev_sanitize.mjs';

describe('d1 prod/dev refresh (#3359)', () => {
  const manifest = loadManifest(process.cwd());

  it('requires confirm + reason; remote needs RESET token', () => {
    expect(validateManualInputs({ confirm: 'nope', reason: 'x', dryRun: true }).ok).toBe(false);
    expect(
      validateManualInputs({
        confirm: CONFIRM_TOKEN,
        reason: 'test',
        dryRun: true,
      }).ok,
    ).toBe(true);
    expect(
      validateManualInputs({
        confirm: CONFIRM_TOKEN,
        reason: 'test',
        dryRun: false,
        allowRemoteDestructive: true,
        confirmDevReset: 'wrong',
      }).ok,
    ).toBe(false);
    expect(
      validateManualInputs({
        confirm: CONFIRM_TOKEN,
        reason: 'test',
        dryRun: false,
        allowRemoteDestructive: true,
        confirmDevReset: CONFIRM_DEV_RESET_TOKEN,
      }).ok,
    ).toBe(true);
  });

  it('fails closed when source and target IDs collide', () => {
    const result = validateSourceTargetIdentities({
      D1_DATABASE_NAME: PROD_NAME,
      D1_DATABASE_ID: PROD_ID,
      D1_DEV_DATABASE_NAME: DEV_NAME,
      D1_DEV_DATABASE_ID: PROD_ID,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('identical'))).toBe(true);
  });

  it('fails closed when Dev ID is wrong', () => {
    const result = validateSourceTargetIdentities({
      D1_DATABASE_NAME: PROD_NAME,
      D1_DATABASE_ID: PROD_ID,
      D1_DEV_DATABASE_NAME: DEV_NAME,
      D1_DEV_DATABASE_ID: '00000000-0000-0000-0000-000000000000',
    });
    expect(result.ok).toBe(false);
  });

  it('parses INSERT dump, sanitizes, and omits excluded auth tables from load SQL', () => {
    const sql = `
INSERT INTO "members" ("id", "email", "role", "created_at", "updated_at", "first_name", "last_name", "screen_name", "email_opt_in") VALUES (9, 'real-member@secret.example', 'member', '2026-01-01', '2026-01-01', 'Real', 'Person', 'rp', 1);
INSERT INTO "login_attempts" ("id", "ip", "email", "ok", "created_at") VALUES (1, '203.0.113.9', 'real-member@secret.example', 0, '2026-01-01');
INSERT INTO "footer_quotes" ("id", "quote", "attribution", "status", "created_at", "updated_at") VALUES (1, 'Hello', 'Lou', 'published', '2026-01-01', '2026-01-01');
INSERT INTO "photos" ("id", "url", "is_memorabilia", "description", "created_at", "photo_id", "title", "year", "era", "type", "game_context", "location", "people", "teams", "tags", "source", "rights_notes", "is_featured", "is_matchup_eligible") VALUES (1, 'https://cdn.example/p.jpg', 1, null, '2026-01-01', 'p1', 't', null, null, null, null, null, 'Jane Doe', null, null, null, null, 0, 1);
`;
    const parsed = parseInsertDump(sql, manifest.schema_fingerprint);
    expect(parsed.ok).toBe(true);
    expect(parsed.dataset.members).toHaveLength(1);
    expect(parsed.dataset.login_attempts).toHaveLength(1);

    const result = runRefreshPipeline({
      dryRun: true,
      confirm: CONFIRM_TOKEN,
      reason: '#3359 synthetic fixture rehearsal',
      skipRemoteExport: true,
      fixtureSqlText: sql,
      env: {
        D1_DATABASE_NAME: PROD_NAME,
        D1_DATABASE_ID: PROD_ID,
        D1_DEV_DATABASE_NAME: DEV_NAME,
        D1_DEV_DATABASE_ID: DEV_ID,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.evidence.status).toBe('dry_run_ok');
    expect(JSON.stringify(result.evidence)).not.toContain('secret.example');
    expect(JSON.stringify(result.evidence)).not.toContain('203.0.113.9');

    const load = buildDevLoadSql(
      {
        members: manifest.fixtures.members,
        login_attempts: [],
        footer_quotes: [{ id: 1, quote: 'Hello', attribution: 'Lou', status: 'published', created_at: '2026-01-01', updated_at: '2026-01-01' }],
        photos: [{ id: 1, people: 'Jane Doe' }],
      },
      {
        members: manifest.schema_fingerprint.members,
        login_attempts: manifest.schema_fingerprint.login_attempts,
        footer_quotes: manifest.schema_fingerprint.footer_quotes,
        photos: manifest.schema_fingerprint.photos,
      },
    );
    expect(load).toContain('DELETE FROM "login_attempts"');
    expect(load).not.toContain('real-member@secret.example');
    expect(load).toContain('dev-admin@example.invalid');
    expect(load).toContain('Jane Doe');
  });

  it('fails closed on unknown table in dump', () => {
    const sql = `INSERT INTO "brand_new_secrets" ("id", "token") VALUES (1, 'abc');`;
    const parsed = parseInsertDump(sql, manifest.schema_fingerprint);
    expect(parsed.ok).toBe(false);
    expect(parsed.failures.some((f) => f.includes('brand_new_secrets'))).toBe(true);
  });

  it('fails closed when dump has no parsable INSERT rows', () => {
    const result = runRefreshPipeline({
      dryRun: true,
      confirm: CONFIRM_TOKEN,
      reason: '#3368 empty dump guard',
      skipRemoteExport: true,
      fixtureSqlText: '-- schema only\nCREATE TABLE x(id INTEGER);\n',
      env: {
        D1_DATABASE_NAME: PROD_NAME,
        D1_DATABASE_ID: PROD_ID,
        D1_DEV_DATABASE_NAME: DEV_NAME,
        D1_DEV_DATABASE_ID: DEV_ID,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('zero parsable INSERT'))).toBe(true);
  });

  it('parses replace(..., char(10)) export shapes for content tables (#3371)', () => {
    // Shape confirmed from live Prod export (scrubbed): replace('text','\\n',char(10))
    const body = "Line one\\nLine two";
    const sql = `
INSERT INTO "membership_card_content" ("id", "title", "body_md", "status", "updated_at") VALUES (1, 'Card Title', replace('${body}', '\\n', char(10)), 'draft', '2026-01-01T00:00:00.000Z');
INSERT INTO "welcome_email_content" ("id", "title", "body_md", "status", "updated_at") VALUES (1, 'Welcome', replace('Hello\\nWorld', '\\n', char(10)), 'draft', '2026-01-01T00:00:00.000Z');
INSERT INTO "footer_quotes" ("id", "quote", "attribution", "status", "created_at", "updated_at") VALUES (1, 'Hello', 'Lou', 'published', '2026-01-01', '2026-01-01');
`;
    const parsed = parseInsertDump(sql, manifest.schema_fingerprint);
    expect(parsed.ok).toBe(true);
    expect(parsed.dataset.membership_card_content).toHaveLength(1);
    expect(parsed.dataset.membership_card_content[0].body_md).toBe('Line one\nLine two');
    expect(parsed.dataset.welcome_email_content[0].body_md).toBe('Hello\nWorld');

    expect(splitSqlArgs("1,'a',replace('x','\\n',char(10)),'draft'")).toEqual([
      '1',
      "'a'",
      "replace('x','\\n',char(10))",
      "'draft'",
    ]);
    expect(parseSqlValueToken("replace('a\\nb','\\n',char(10))")).toBe('a\nb');
  });

  it('skips sqlite_sequence and other internal dump tables (#3371)', () => {
    expect(isInternalDumpTable('sqlite_sequence')).toBe(true);
    expect(isInternalDumpTable('d1_migrations')).toBe(true);
    expect(isInternalDumpTable('_cf_KV')).toBe(true);
    expect(isInternalDumpTable('members')).toBe(false);

    const sql = `
INSERT INTO sqlite_sequence (name,seq) VALUES('members',9);
INSERT INTO sqlite_sequence (name,seq) VALUES('footer_quotes',1);
INSERT INTO "footer_quotes" ("id", "quote", "attribution", "status", "created_at", "updated_at") VALUES (1, 'Hello', 'Lou', 'published', '2026-01-01', '2026-01-01');
`;
    const parsed = parseInsertDump(sql, manifest.schema_fingerprint);
    expect(parsed.ok).toBe(true);
    expect(parsed.failures).toEqual([]);
    expect(parsed.dataset.sqlite_sequence).toBeUndefined();
    expect(parsed.dataset.footer_quotes).toHaveLength(1);
  });

  it('fails closed on unknown SQL value expressions (#3371)', () => {
    expect(() => parseSqlValueToken("hex('abc')")).toThrow(/Unparseable SQL value token/);
    expect(() => parseSqlValueToken("replace('a','b')")).toThrow(/Unparseable SQL value token/);
    expect(() => parseSqlValueToken("X'dead'")).toThrow(/Unparseable SQL value token/);

    const sql = `
INSERT INTO "footer_quotes" ("id", "quote", "attribution", "status", "created_at", "updated_at") VALUES (1, hex('nope'), 'Lou', 'published', '2026-01-01', '2026-01-01');
`;
    const parsed = parseInsertDump(sql, manifest.schema_fingerprint);
    expect(parsed.ok).toBe(false);
    expect(parsed.failures.some((f) => f.includes('footer_quotes') && f.includes('Unparseable'))).toBe(
      true,
    );
  });

  it('workflow file is workflow_dispatch only', () => {
    const text = fs.readFileSync('.github/workflows/ops-d1-prod-dev-refresh.yml', 'utf8');
    expect(text).toMatch(/workflow_dispatch:/);
    expect(text).not.toMatch(/^\s+schedule:/m);
    expect(text).not.toMatch(/pull_request:/);
    expect(text).toMatch(/concurrency:/);
    expect(text).toMatch(/d1-prod-dev-refresh-3359/);
  });
});
