import { describe, expect, it } from 'vitest';

import {
  BOOK_RECORDS,
  BOOK_TAGS,
  ROLLBACK_SQL,
  buildCanonicalFields,
  buildInsertStatement,
  buildResultMarkdown,
  buildSearchText,
  buildStatementsForPlan,
  buildUpdateStatement,
  columnNamesFromPragma,
  isApplyMode,
  missingRequiredColumns,
  parseTarget,
  planBooks,
  requireEnv,
} from '../scripts/ci/library_books_content_load_3451.mjs';

const FULL_COLUMNS = new Set([
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
  'summary',
  'perspective_label',
  'event_year',
  'published_at',
  'updated_at',
]);

describe('#3451 six-book package', () => {
  it('defines exactly six unique authorized tags', () => {
    expect(BOOK_RECORDS).toHaveLength(6);
    expect(new Set(BOOK_TAGS).size).toBe(6);
    expect(BOOK_TAGS).toEqual([
      'library-book-luckiest-man-eig',
      'library-book-lou-gehrig-biography-kashatus',
      'library-book-luckiest-man-adler',
      'library-book-pride-of-the-yankees-gallico',
      'library-book-iron-horse-robinson',
      'library-book-lost-memoir-gaff',
    ]);
  });

  it('keeps rollback scoped to the six authorized tags', () => {
    for (const tag of BOOK_TAGS) expect(ROLLBACK_SQL).toContain(`'${tag}'`);
    expect(ROLLBACK_SQL).toContain('DELETE FROM content_inventory');
    expect(ROLLBACK_SQL).toContain('canonical = 1');
  });

  it('builds search_text with title, author, publisher, year, ISBN, and library terms', () => {
    const book = BOOK_RECORDS[0];
    const search = buildSearchText(book);
    expect(search).toContain(book.title);
    expect(search).toContain(book.author);
    expect(search).toContain(book.publisher);
    expect(search).toContain(String(book.eventYear));
    expect(search).toContain(book.isbn);
    expect(search).toContain('Lou Gehrig');
    expect(search).toContain('baseball');
    expect(search).toContain('biography');
  });

  it('maps canonical published library fields from the Product-authorized records', () => {
    const fields = buildCanonicalFields(BOOK_RECORDS[5]);
    expect(fields.status).toBe('published');
    expect(fields.story_type).toBe('brief');
    expect(fields.allowed_sections).toBe('["library"]');
    expect(fields.canonical).toBe(1);
    expect(fields.media).toBe('[]');
    expect(fields.priority).toBe(0);
    expect(fields.feature_weight).toBe(1);
    expect(fields.event_date).toBeNull();
    expect(fields.rotation_group).toBeNull();
    expect(fields.last_featured).toBeNull();
    expect(fields.perspective_label).toBeNull();
    expect(fields.summary).toBe(BOOK_RECORDS[5].text);
    expect(fields.source_name).toBe('Simon & Schuster official publisher record');
    expect(fields.credit_line).toContain('Alan D. Gaff');
  });
});

describe('gates', () => {
  it('parses TARGET as dev or prod only', () => {
    expect(parseTarget({ TARGET: 'dev' })).toBe('dev');
    expect(parseTarget({ TARGET: 'prod' })).toBe('prod');
    expect(parseTarget({ TARGET: 'production' })).toBe('');
    expect(parseTarget({})).toBe('');
  });

  it('requires both apply gates', () => {
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'confirm' })).toBe(true);
    expect(isApplyMode({ MODE: 'dry-run', CONFIRM_WRITE: 'confirm' })).toBe(false);
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'yes' })).toBe(false);
  });

  it('requires Dev secrets for TARGET=dev and Production secrets for TARGET=prod', () => {
    expect(requireEnv('dev', {})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'D1_DEV_DATABASE_NAME',
      'D1_DEV_DATABASE_ID',
    ]);
    expect(requireEnv('prod', {})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'D1_DATABASE_NAME',
      'D1_DATABASE_ID',
    ]);
  });
});

describe('schema and planning', () => {
  it('detects missing required columns from PRAGMA rows', () => {
    const names = columnNamesFromPragma([{ name: 'tag' }, { name: 'title' }]);
    expect(missingRequiredColumns(names)).toContain('credit_line');
    expect(missingRequiredColumns(FULL_COLUMNS)).toEqual([]);
  });

  it('plans inserts when no authorized tags exist', () => {
    const plan = planBooks([]);
    expect(plan.summary).toEqual({ insert: 6, update: 0, noop: 0, conflict: 0 });
  });

  it('noops when existing rows already match the authorized fields', () => {
    const existing = BOOK_RECORDS.map((book, index) => ({
      id: index + 1,
      ...buildCanonicalFields(book),
    }));
    const plan = planBooks(existing);
    expect(plan.summary).toEqual({ insert: 0, update: 0, noop: 6, conflict: 0 });
  });

  it('updates when the same title exists but attribution differs', () => {
    const fields = buildCanonicalFields(BOOK_RECORDS[0]);
    const plan = planBooks([{ id: 9, ...fields, credit_line: 'stale' }]);
    expect(plan.plans[0].action).toBe('update');
    expect(plan.plans[0].id).toBe(9);
    expect(plan.summary.update).toBe(1);
  });

  it('fails closed on a non-matching title under an authorized tag', () => {
    const fields = buildCanonicalFields(BOOK_RECORDS[0]);
    const plan = planBooks([{ id: 3, ...fields, title: 'Unrelated row' }]);
    expect(plan.plans[0]).toMatchObject({
      action: 'conflict',
      exceptionCode: 'TAG_COLLISION_NON_MATCHING_TITLE',
    });
    expect(plan.summary.conflict).toBe(1);
  });
});

describe('SQL generation', () => {
  it('inserts published library rows with attribution and no cover media', () => {
    const sql = buildInsertStatement(buildCanonicalFields(BOOK_RECORDS[0]), FULL_COLUMNS);
    expect(sql).toContain('INSERT INTO content_inventory');
    expect(sql).toContain("'library-book-luckiest-man-eig'");
    expect(sql).toContain("'published'");
    expect(sql).toContain("'[\"library\"]'");
    expect(sql).toContain("'[]'");
    expect(sql).not.toContain('TODO');
  });

  it('updates by numeric id and can set published_at on first publish', () => {
    const sql = buildUpdateStatement(12, buildCanonicalFields(BOOK_RECORDS[1]), FULL_COLUMNS, true);
    expect(sql).toContain('WHERE id = 12');
    expect(sql).toContain('published_at =');
  });

  it('emits statements only for insert and update', () => {
    const statements = buildStatementsForPlan(
      {
        plans: [
          { action: 'insert', fields: buildCanonicalFields(BOOK_RECORDS[0]) },
          { action: 'noop' },
          { action: 'conflict' },
          {
            action: 'update',
            id: 4,
            fields: buildCanonicalFields(BOOK_RECORDS[1]),
            willBecomePublished: false,
          },
        ],
      },
      FULL_COLUMNS,
    );
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('INSERT');
    expect(statements[1]).toContain('UPDATE');
  });
});

describe('result markdown', () => {
  it('cites #3268 backup evidence only for Production target', () => {
    const prod = buildResultMarkdown({
      checkedAt: '2026-08-14T16:00:00.000Z',
      target: 'prod',
      mode: 'dry-run',
      databaseName: 'lgfc_lite',
      databaseId: '22d0dc3e-ad34-43af-8e6a-2063df1a1e04',
      summary: { insert: 6, update: 0, noop: 0, conflict: 0 },
    });
    expect(prod).toContain('#3268');
    expect(prod).toContain('lgfc-d1-backups');
    expect(prod).toContain('library-book-luckiest-man-eig');
    expect(prod).not.toContain('CLOUDFLARE_API_TOKEN');

    const dev = buildResultMarkdown({
      checkedAt: '2026-08-14T16:00:00.000Z',
      target: 'dev',
      mode: 'dry-run',
      databaseName: 'lgfc-litedev',
      databaseId: '35232809-b4c1-4df9-9f39-2f178b13c378',
      summary: { insert: 6, update: 0, noop: 0, conflict: 0 },
    });
    expect(dev).not.toContain('#3268');
  });
});
