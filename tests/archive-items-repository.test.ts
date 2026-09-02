// #2073 Work Package item 4 (#4061): archive-items-repository.ts.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  createArchiveItem,
  getArchiveItemById,
  InvalidCustodyTransitionError,
  isValidCustodyTransition,
  listArchiveItems,
  listCustodyEvents,
  serializeArchiveItemForAdmin,
  updateCustodyState,
} from '../functions/_lib/archive-items-repository';
import { getCandidateByCandidateId } from '../functions/_lib/content-pipeline-candidate-repository';
import { recordGovernedRightsEvidence } from '../functions/_lib/rights-evidence-repository';

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function wrapSqliteAsD1(sqlite: DatabaseSync) {
  return {
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) {
          await statement.run();
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return statements.map(() => ({ success: true }));
    },
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const info = stmt.run(...args);
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
        },
      });

      return {
        bind: bound,
        async first() {
          return stmt.get() ?? null;
        },
        async all() {
          return { results: stmt.all() };
        },
        async run() {
          const info = stmt.run();
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
        },
      };
    },
  };
}

function freshDb() {
  const sqlite = new DatabaseSync(':memory:');
  applyRepoMigrations(sqlite);
  return wrapSqliteAsD1(sqlite);
}

describe('createArchiveItem', () => {
  it('creates a content_items row (physical_acquisition) and an archive_items row together', async () => {
    const db = freshDb();

    const item = await createArchiveItem(db, {
      title: 'Gehrig 1927 program',
      summary: 'Donated game program from the 1927 season.',
      item_type: 'document',
      custody_type: 'donation',
      donor_name: 'Jane Donor',
      donor_contact: 'jane@example.com',
      donor_consent_public_credit: 1,
      credit_line: 'Gift of Jane Donor',
      actor: 'Bill',
    });

    expect(item.custody_type).toBe('donation');
    expect(item.custody_state).toBe('offered');
    expect(item.candidate_id).toMatch(/^lgfc-gehrig-\d{4}-\d{3,}$/);

    const candidate = await getCandidateByCandidateId(db, item.candidate_id, {});
    expect(candidate).toBeTruthy();
    expect(candidate?.input_stream).toBe('physical_acquisition');

    const events = await listCustodyEvents(db, item.id);
    expect(events).toHaveLength(1);
    expect(events[0].from_state).toBeNull();
    expect(events[0].to_state).toBe('offered');
    expect(events[0].actor).toBe('Bill');
  });

  it('leaves loan_expected_return_at null for a donation even if supplied', async () => {
    const db = freshDb();
    const item = await createArchiveItem(db, {
      title: 'Donated photo',
      summary: 'A donated photo.',
      item_type: 'photograph',
      custody_type: 'donation',
      loan_expected_return_at: '2027-01-01T00:00:00.000Z',
      actor: 'Bill',
    });
    expect(item.loan_expected_return_at).toBeNull();
  });

  it('keeps loan_expected_return_at for a loan', async () => {
    const db = freshDb();
    const item = await createArchiveItem(db, {
      title: 'Loaned scrapbook',
      summary: 'A loaned scrapbook.',
      item_type: 'document',
      custody_type: 'loan',
      loan_expected_return_at: '2027-01-01T00:00:00.000Z',
      actor: 'Bill',
    });
    expect(item.loan_expected_return_at).toBe('2027-01-01T00:00:00.000Z');
  });

  it('never exposes donor_contact through the admin serializer beyond what the row itself carries (no separate public path exists yet)', async () => {
    const db = freshDb();
    const item = await createArchiveItem(db, {
      title: 'Donated letter',
      summary: 'A donated letter.',
      item_type: 'letter',
      custody_type: 'donation',
      donor_name: 'Jane Donor',
      donor_contact: 'jane@example.com',
      actor: 'Bill',
    });

    const serialized = serializeArchiveItemForAdmin(item);
    expect(serialized.donor_name).toBe('Jane Donor');
    expect(serialized.donor_contact).toBe('jane@example.com');
  });
});

describe('custody state machine', () => {
  it('allows the documented forward transitions', () => {
    expect(isValidCustodyTransition('offered', 'received')).toBe(true);
    expect(isValidCustodyTransition('received', 'cataloged')).toBe(true);
    expect(isValidCustodyTransition('cataloged', 'stored')).toBe(true);
    expect(isValidCustodyTransition('stored', 'returned')).toBe(true);
    expect(isValidCustodyTransition('offered', 'deaccessioned')).toBe(true);
  });

  it('rejects skipping states or moving out of a terminal state', () => {
    expect(isValidCustodyTransition('offered', 'stored')).toBe(false);
    expect(isValidCustodyTransition('returned', 'stored')).toBe(false);
    expect(isValidCustodyTransition('deaccessioned', 'received')).toBe(false);
  });

  it('updateCustodyState persists the new state, records an audit event, and sets loan_returned_at on return', async () => {
    const db = freshDb();
    const item = await createArchiveItem(db, {
      title: 'Loaned photo',
      summary: 'A loaned photo.',
      item_type: 'photograph',
      custody_type: 'loan',
      actor: 'Bill',
    });

    await updateCustodyState(db, { archiveItemId: item.id, toState: 'received', actor: 'Bill', note: 'Arrived by mail.' });
    const afterReceive = await getArchiveItemById(db, item.id);
    expect(afterReceive?.custody_state).toBe('received');

    await updateCustodyState(db, { archiveItemId: item.id, toState: 'returned', actor: 'Bill' });
    const afterReturn = await getArchiveItemById(db, item.id);
    expect(afterReturn?.custody_state).toBe('returned');
    expect(afterReturn?.loan_returned_at).not.toBeNull();

    const events = await listCustodyEvents(db, item.id);
    // offered (intake) -> received -> returned
    expect(events).toHaveLength(3);
    expect(events[0].to_state).toBe('returned');
    expect(events[0].from_state).toBe('received');
  });

  it('rejects an invalid transition and leaves state unchanged', async () => {
    const db = freshDb();
    const item = await createArchiveItem(db, {
      title: 'Donated item',
      summary: 'x',
      item_type: 'other',
      custody_type: 'donation',
      actor: 'Bill',
    });

    await expect(
      updateCustodyState(db, { archiveItemId: item.id, toState: 'stored', actor: 'Bill' }),
    ).rejects.toBeInstanceOf(InvalidCustodyTransitionError);

    const unchanged = await getArchiveItemById(db, item.id);
    expect(unchanged?.custody_state).toBe('offered');
    expect(await listCustodyEvents(db, item.id)).toHaveLength(1);
  });
});

describe('listArchiveItems', () => {
  it('filters by custody_state and custody_type', async () => {
    const db = freshDb();
    const donation = await createArchiveItem(db, {
      title: 'A donation', summary: 'x', item_type: 'photograph', custody_type: 'donation', actor: 'Bill',
    });
    const loan = await createArchiveItem(db, {
      title: 'A loan', summary: 'x', item_type: 'document', custody_type: 'loan', actor: 'Bill',
    });
    await updateCustodyState(db, { archiveItemId: loan.id, toState: 'received', actor: 'Bill' });

    const donations = await listArchiveItems(db, { custody_type: 'donation' });
    expect(donations.map((i) => i.id)).toEqual([donation.id]);

    const received = await listArchiveItems(db, { custody_state: 'received' });
    expect(received.map((i) => i.id)).toEqual([loan.id]);
  });

  it('orders deterministically even when updated_at ties (regression: ORDER BY updated_at alone is unstable)', async () => {
    const db = freshDb();
    const first = await createArchiveItem(db, { title: 'First', summary: 'x', item_type: 'other', custody_type: 'donation', actor: 'Bill' });
    const second = await createArchiveItem(db, { title: 'Second', summary: 'x', item_type: 'other', custody_type: 'donation', actor: 'Bill' });
    const third = await createArchiveItem(db, { title: 'Third', summary: 'x', item_type: 'other', custody_type: 'donation', actor: 'Bill' });

    // Force every row to the exact same updated_at, simulating rows written
    // within the same timestamp-resolution window.
    await db.prepare("UPDATE archive_items SET updated_at = '2026-09-02T12:00:00.000Z'").run();

    const runs = await Promise.all(Array.from({ length: 5 }, () => listArchiveItems(db)));
    const orderings = runs.map((items) => items.map((i) => i.id));

    // Every repeated call must return the exact same order (id DESC as the
    // tiebreaker), not whatever order the ties happen to come back in.
    for (const ordering of orderings) {
      expect(ordering).toEqual([third.id, second.id, first.id]);
    }
  });
});

describe('rights_evidence donor_agreement integration', () => {
  it('records a donor_agreement evidence row against the archive item\'s content_item_id', async () => {
    const db = freshDb();
    const item = await createArchiveItem(db, {
      title: 'Donated jersey photo',
      summary: 'x',
      item_type: 'photograph',
      custody_type: 'donation',
      donor_name: 'Jane Donor',
      actor: 'Bill',
    });

    const evidence = await recordGovernedRightsEvidence(db, {
      content_item_id: item.content_item_id,
      evidence_type: 'donor_agreement',
      evidence_text: 'Signed donor agreement on file, dated 2026-09-02.',
      reviewer: 'Bill',
      conclusion: 'permission_granted',
      conclusion_rationale: 'Donor signed agreement granting LGFC use for website display.',
      channel: 'website',
    });

    expect(evidence.evidence_type).toBe('donor_agreement');
    expect(evidence.conclusion).toBe('permission_granted');
  });
});
