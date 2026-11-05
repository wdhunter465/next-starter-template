// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  return db;
}

let counter = 0;
function addItem(db: DatabaseSync, over: Record<string, unknown> = {}): number {
  counter += 1;
  const row = {
    candidate_id: `cand-5095-${counter}`, input_stream: 'scheduled_discovery', title: `Item ${counter}`, source_name: 'Test', source_type: 'archive',
    content_type: 'photo', summary: 's', rights_status: 'public_domain_candidate', source_trust_status: 'pending', relevance_status: 'pending',
    review_status: 'pending_review', publication_status: 'not_ready', privacy_flag: 'none', privacy_review_status: 'not_applicable',
    review_priority: 'normal', source_domain: 'loc.gov', origin_permission: 'permitted', privacy_status: 'not_applicable', ...over,
  };
  const keys = Object.keys(row);
  const info = db.prepare(`INSERT INTO content_items (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...(Object.values(row) as never[]));
  return Number(info.lastInsertRowid);
}

function grant(db: DatabaseSync, over: Record<string, unknown> = {}): number {
  const row = { party: 'cmg', status: 'approved', scope_type: 'all', scope_value: null, permitted_website: 1, permitted_social: 1, ...over };
  const keys = Object.keys(row);
  const info = db.prepare(`INSERT INTO permission_grants (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...(Object.values(row) as never[]));
  return Number(info.lastInsertRowid);
}

function status(db: DatabaseSync, id: number) {
  return db.prepare('SELECT computed_status_website AS website, computed_status_social AS social, cmg_website, cmg_social, mlb_website, yankees_website FROM content_item_permission_status WHERE content_item_id = ?').get(id) as Record<string, string>;
}

describe('rights status codes (#5095)', () => {
  it('lists the definitive permitted states in one list and every other state in the other', () => {
    const db = migratedDb();
    const permitted = db.prepare('SELECT scope, code FROM rights_status_permitted_codes ORDER BY scope, code').all();
    expect(permitted).toEqual([
      { scope: 'final_status', code: 'permitted' },
      { scope: 'grant_status', code: 'approved' },
      { scope: 'layer', code: 'permitted' },
      { scope: 'rights_status', code: 'permission_granted' },
    ]);
    const other = db.prepare('SELECT code FROM rights_status_other_codes').all().map((r) => (r as { code: string }).code);
    expect(other).toEqual(expect.arrayContaining(['for_admin_review', 'not_permitted', 'denied', 'not_in_purview', 'unknown', 'blocked']));
    expect(other).not.toContain('permitted');
  });

  it('covers every value the existing columns allow and enforces its own checks', () => {
    const db = migratedDb();
    const codes = (scope: string) => db.prepare('SELECT code FROM rights_status_codes WHERE scope = ?').all(scope).map((r) => (r as { code: string }).code).sort();
    expect(codes('layer')).toEqual(['for_admin_review', 'not_applicable', 'not_permitted', 'permitted']);
    expect(codes('final_status')).toEqual(['for_admin_review', 'not_permitted', 'permitted']);
    expect(codes('rights_status')).toEqual(['blocked', 'copyright_restricted', 'permission_granted', 'permission_needed', 'permission_requested', 'public_domain_candidate', 'unknown']);
    expect(() => db.prepare("INSERT INTO rights_status_codes (scope, code, label, outcome, permitted_website) VALUES ('layer', 'x', 'X', 'pending', 1)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO rights_status_codes (scope, code, label, outcome, blocks_use) VALUES ('layer', 'y', 'Y', 'not_permitted', 0)").run()).toThrow();
  });
});

describe('permission grants and the computed status (#5095)', () => {
  it('stays for admin review with no grants, then becomes permitted on a blanket CMG approval plus not-in-purview answers', () => {
    const db = migratedDb();
    const id = addItem(db);
    expect(status(db, id)).toMatchObject({ website: 'for_admin_review', social: 'for_admin_review', cmg_website: 'pending' });

    grant(db, { party: 'cmg' });
    expect(status(db, id)).toMatchObject({ website: 'for_admin_review', cmg_website: 'approved' });
    grant(db, { party: 'mlb', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    grant(db, { party: 'yankees', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    expect(status(db, id)).toMatchObject({ website: 'permitted', social: 'permitted', mlb_website: 'not_applicable', yankees_website: 'not_applicable' });
  });

  it('treats a social-only approval as not covering the website', () => {
    const db = migratedDb();
    const id = addItem(db);
    grant(db, { party: 'cmg', permitted_website: 0, permitted_social: 1 });
    grant(db, { party: 'mlb', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    grant(db, { party: 'yankees', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    expect(status(db, id)).toMatchObject({ website: 'not_permitted', social: 'permitted', cmg_website: 'not_covered', cmg_social: 'approved' });
  });

  it('lets any denial block both channels, and one revocation lifts it', () => {
    const db = migratedDb();
    const id = addItem(db);
    grant(db, { party: 'cmg' });
    grant(db, { party: 'mlb', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    grant(db, { party: 'yankees', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    expect(status(db, id)).toMatchObject({ website: 'permitted' });
    const denial = grant(db, { party: 'yankees', status: 'denied', permitted_website: 0, permitted_social: 0 });
    expect(status(db, id)).toMatchObject({ website: 'not_permitted', social: 'not_permitted' });
    db.prepare("UPDATE permission_grants SET revoked_at = '2026-11-06T00:00:00Z', revoked_reason = 'denial withdrawn' WHERE id = ?").run(denial);
    expect(status(db, id)).toMatchObject({ website: 'permitted', social: 'permitted' });
  });

  it('applies a grant only to the records in its scope', () => {
    const db = migratedDb();
    const loc = addItem(db, { source_domain: 'loc.gov', source_owner: 'Library of Congress' });
    const commons = addItem(db, { source_domain: 'commons.wikimedia.org', source_owner: 'Wikimedia' });
    const story = addItem(db, { source_domain: 'loc.gov', content_type: 'story' });
    grant(db, { party: 'cmg', scope_type: 'source_domain', scope_value: 'loc.gov' });
    expect(status(db, loc).cmg_website).toBe('approved');
    expect(status(db, story).cmg_website).toBe('approved');
    expect(status(db, commons).cmg_website).toBe('pending');
    grant(db, { party: 'mlb', scope_type: 'content_type', scope_value: 'story' });
    expect(status(db, story).mlb_website).toBe('approved');
    expect(status(db, loc).mlb_website).toBe('pending');
    grant(db, { party: 'yankees', scope_type: 'source_owner', scope_value: 'Wikimedia' });
    expect(status(db, commons).yankees_website).toBe('approved');
    expect(status(db, loc).yankees_website).toBe('pending');
    grant(db, { party: 'cmg', status: 'denied', permitted_website: 0, permitted_social: 0, scope_type: 'content_item', scope_value: String(commons) });
    expect(status(db, commons).cmg_website).toBe('denied');
    expect(status(db, loc).cmg_website).toBe('approved');
  });

  it('counts a grant only inside its dates', () => {
    const db = migratedDb();
    const id = addItem(db);
    grant(db, { party: 'cmg', effective_from: '2999-01-01T00:00:00Z', effective_until: '3000-01-01T00:00:00Z' });
    expect(status(db, id).cmg_website).toBe('pending');
    grant(db, { party: 'mlb', effective_from: '2000-01-01T00:00:00Z', effective_until: '2001-01-01T00:00:00Z' });
    expect(status(db, id).mlb_website).toBe('pending');
    grant(db, { party: 'yankees', effective_from: '2000-01-01T00:00:00Z' });
    expect(status(db, id).yankees_website).toBe('approved');
  });

  it('falls back to the existing party columns, and never permits a fee-required or non-permitted origin', () => {
    const db = migratedDb();
    const legacy = addItem(db, { cmg_permission: 'permitted', mlb_permission: 'not_applicable', yankees_permission: 'not_applicable' });
    expect(status(db, legacy)).toMatchObject({ website: 'permitted', social: 'permitted' });
    const denied = addItem(db, { cmg_permission: 'permitted', mlb_permission: 'not_permitted', yankees_permission: 'not_applicable' });
    expect(status(db, denied).website).toBe('not_permitted');
    const fee = addItem(db, { cmg_permission: 'permitted', mlb_permission: 'not_applicable', yankees_permission: 'not_applicable', outcome_basis: 'fee_required' });
    expect(status(db, fee).website).toBe('not_permitted');
    const noOrigin = addItem(db, { origin_permission: 'not_permitted', cmg_permission: 'permitted', mlb_permission: 'not_applicable', yankees_permission: 'not_applicable' });
    expect(status(db, noOrigin).website).toBe('not_permitted');
    const privacy = addItem(db, { privacy_status: 'for_admin_review', cmg_permission: 'permitted', mlb_permission: 'not_applicable', yankees_permission: 'not_applicable' });
    expect(status(db, privacy).website).toBe('for_admin_review');
  });

  it('leaves superseded records out and changes no content_items row', () => {
    const db = migratedDb();
    const id = addItem(db);
    const old = addItem(db, { superseded_at: '2026-11-01T00:00:00Z' });
    const before = JSON.stringify(db.prepare('SELECT * FROM content_items ORDER BY id').all());
    grant(db, { party: 'cmg' });
    db.prepare('SELECT * FROM content_item_permission_status').all();
    expect(JSON.stringify(db.prepare('SELECT * FROM content_items ORDER BY id').all())).toBe(before);
    expect(db.prepare('SELECT content_item_id FROM content_item_permission_status').all()).toEqual([{ content_item_id: id }]);
    expect(old).not.toBe(id);
  });

  it('keeps grants append-only: no delete, no edit except one revocation, evidence linked to the exchange', () => {
    const db = migratedDb();
    const exchange = Number(db.prepare("INSERT INTO permission_exchanges (source_domain, scope_requested, status) VALUES ('cmgworldwide.com', 'Licensing guidance', 'requested')").run().lastInsertRowid);
    const message = Number(db.prepare("INSERT INTO permission_messages (exchange_id, direction, sent_or_received_at, body, sender) VALUES (?, 'inbound', '2026-11-06T00:00:00Z', 'ok', 'x@example.com')").run(exchange).lastInsertRowid);
    const id = grant(db, { party: 'cmg', exchange_id: exchange, message_id: message, terms_text: 'credit CMG' });
    expect(() => db.prepare('DELETE FROM permission_grants WHERE id = ?').run(id)).toThrow(/append-only/);
    expect(() => db.prepare("UPDATE permission_grants SET status = 'denied', permitted_website = 0, permitted_social = 0 WHERE id = ?").run(id)).toThrow(/append-only/);
    expect(() => db.prepare("UPDATE permission_grants SET terms_text = 'changed' WHERE id = ?").run(id)).toThrow(/append-only/);
    expect(() => db.prepare("UPDATE permission_grants SET revoked_at = '2026-11-07T00:00:00Z' WHERE id = ?").run(id)).toThrow();
    db.prepare("UPDATE permission_grants SET revoked_at = '2026-11-07T00:00:00Z', revoked_reason = 'superseded' WHERE id = ?").run(id);
    expect(() => db.prepare("UPDATE permission_grants SET revoked_reason = 'again' WHERE id = ?").run(id)).toThrow(/append-only/);
    expect(() => grant(db, { exchange_id: 99999 })).toThrow();
  });

  it('keeps the grants and the permission views working after the 0065 emergency rollback rebuilds content_items', () => {
    const db = migratedDb();
    const id = addItem(db);
    grant(db, { party: 'cmg' });
    grant(db, { party: 'mlb', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    grant(db, { party: 'yankees', status: 'not_in_purview', permitted_website: 0, permitted_social: 0 });
    expect(status(db, id)).toMatchObject({ website: 'permitted' });
    db.exec(fs.readFileSync(path.join(process.cwd(), 'scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql'), 'utf8'));
    expect((db.prepare('SELECT COUNT(*) AS n FROM permission_grants').get() as { n: number }).n).toBe(3);
    expect(status(db, id)).toMatchObject({ website: 'permitted', social: 'permitted' });
    const views = db.prepare("SELECT name FROM sqlite_master WHERE type = 'view' AND name IN ('content_item_party_grants', 'content_item_permission_status', 'permission_grant_matches') ORDER BY name").all().map((r) => (r as { name: string }).name);
    expect(views).toEqual(['content_item_party_grants', 'content_item_permission_status', 'permission_grant_matches']);
  });

  it('enforces the grant checks', () => {
    const db = migratedDb();
    expect(() => grant(db, { party: 'nfl' })).toThrow();
    expect(() => grant(db, { scope_type: 'source_domain', scope_value: null })).toThrow();
    expect(() => grant(db, { scope_type: 'all', scope_value: 'x' })).toThrow();
    expect(() => grant(db, { status: 'approved', permitted_website: 0, permitted_social: 0 })).toThrow();
    expect(() => grant(db, { status: 'denied', permitted_website: 1 })).toThrow();
    expect(() => grant(db, { effective_from: '2026-02-01', effective_until: '2026-01-01' })).toThrow();
  });
});
