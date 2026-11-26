import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

function migrate(upTo) {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter((n) => n.endsWith('.sql')).sort()) {
    if (upTo && f > upTo) break;
    db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  }
  return db;
}

describe('0103 permission_grants eig (#5226)', () => {
  it('keeps existing grants, adds the eig party and the Eig text-only grant', () => {
    const db = migrate('0102_social_ledger_handed_off_5289.sql');
    db.exec("INSERT INTO permission_grants (party,status,scope_type,scope_value) VALUES ('mlb','denied','all',NULL)");
    db.exec(readFileSync('migrations/0103_permission_grants_eig_5226.sql', 'utf8'));
    const rows = db.prepare('SELECT id, party, status, permitted_website, permitted_social, credit_wording, terms_text FROM permission_grants ORDER BY id').all();
    expect(rows[0]).toMatchObject({ id: 1, party: 'mlb', status: 'denied' });
    expect(rows[1]).toMatchObject({ party: 'eig', status: 'approved', permitted_website: 1, permitted_social: 1 });
    expect(rows[1].credit_wording).toContain('Luckiest Man');
    expect(rows[1].terms_text).toContain('No photos');
  });

  it('stays append-only and keeps the views working', () => {
    const db = migrate();
    expect(() => db.exec('DELETE FROM permission_grants WHERE party = \'eig\'')).toThrow(/append-only/);
    expect(() => db.prepare('SELECT * FROM content_item_permission_status').all()).not.toThrow();
    expect(() => db.exec("INSERT INTO permission_grants (party,status,scope_type,scope_value,permitted_website) VALUES ('nobody','approved','all',NULL,1)")).toThrow();
  });
});
