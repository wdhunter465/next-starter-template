import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  MANIFEST_RELATIVE,
  applyTransform,
  assertSchemaCovered,
  evaluateRefreshGate,
  loadManifest,
  privacySafeSummary,
  sanitizeDataset,
  sanitizeTable,
  syntheticEmail,
} from '../scripts/ci/d1_prod_dev_sanitize.mjs';

describe('d1 prod/dev sanitization policy (#3358)', () => {
  const manifest = loadManifest(process.cwd());

  it('ships a machine-readable manifest covering every fingerprint table/column', () => {
    expect(manifest.version).toBe(1);
    expect(manifest.fail_closed_unknown).toBe(true);
    expect(manifest.never_log_source_values).toBe(true);
    const covered = assertSchemaCovered(manifest, manifest.schema_fingerprint);
    expect(covered.ok).toBe(true);
    expect(covered.failures).toEqual([]);
    expect(Object.keys(manifest.tables).sort()).toEqual(
      Object.keys(manifest.schema_fingerprint).sort(),
    );
    for (const [table, cols] of Object.entries(manifest.schema_fingerprint)) {
      expect(Object.keys(manifest.tables[table].columns).sort()).toEqual([...cols].sort());
    }
  });

  it('fails closed on schema drift (new unclassified column)', () => {
    const live = structuredClone(manifest.schema_fingerprint);
    live.members = [...live.members, 'ssn'];
    const covered = assertSchemaCovered(manifest, live);
    expect(covered.ok).toBe(false);
    expect(covered.failures.some((f) => f.includes('members.ssn'))).toBe(true);
  });

  it('fails closed on a brand-new unclassified table', () => {
    const live = { ...manifest.schema_fingerprint, brand_new_secrets: ['id', 'token'] };
    const covered = assertSchemaCovered(manifest, live);
    expect(covered.ok).toBe(false);
    expect(covered.failures.some((f) => f.includes('brand_new_secrets'))).toBe(true);
  });

  it('excludes auth/session/security tables entirely', () => {
    for (const table of ['member_sessions', 'login_attempts', 'join_email_log']) {
      const result = sanitizeTable(manifest, table, [
        {
          id: 1,
          email: 'real-member@example.com',
          ip: '203.0.113.9',
          ua: 'SecretAgent/1.0',
          ok: 1,
          created_at: '2026-01-01',
        },
      ]);
      expect(result.rows).toEqual([]);
      expect(result.excludedCount).toBe(1);
    }
  });

  it('replaces members with synthetic fixtures (Production emails do not survive)', () => {
    const result = sanitizeTable(manifest, 'members', [
      {
        id: 99,
        email: 'real-member@example.com',
        role: 'member',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        first_name: 'Real',
        last_name: 'Person',
        screen_name: 'realperson',
        email_opt_in: 1,
      },
    ]);
    expect(result.rows).toEqual(manifest.fixtures.members);
    expect(JSON.stringify(result.rows)).not.toContain('real-member@example.com');
    expect(JSON.stringify(result.rows)).not.toContain('Real');
    expect(result.rows[0].email).toMatch(/@example\.invalid$/);
  });

  it('transforms ask_inbox contact fields and free-text; source values do not survive', () => {
    const source = {
      id: 7,
      first_name: 'Ada',
      last_name: 'Lovelace',
      screen_name: 'analytical',
      email: 'ada@secret.example',
      question: 'Where is my private membership card?',
      status: 'open',
      created_at: '2026-01-02',
      moderation_note: 'quotes private email ada@secret.example',
      faq_entry_id: null,
    };
    const result = sanitizeTable(manifest, 'ask_inbox', [source]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.email).toBe(syntheticEmail('ask_inbox:id:7:email'));
    expect(row.email).not.toBe(source.email);
    expect(row.first_name).not.toBe('Ada');
    expect(row.question).toMatch(/^\[sanitized:/);
    expect(row.question).not.toContain('membership card');
    expect(row.moderation_note).toBeNull();
    expect(JSON.stringify(result.rows)).not.toContain('ada@secret.example');
  });

  it('allows photos.people COPY AS-IS after PD-3358-01', () => {
    const result = sanitizeTable(manifest, 'photos', [
      {
        id: 1,
        url: 'https://cdn.example/p.jpg',
        people: 'Jane Doe, John Smith',
        is_memorabilia: 1,
      },
    ]);
    expect(result.rows[0].people).toBe('Jane Doe, John Smith');
  });

  it('excludes content_items with non-public privacy_flag (fail-closed)', () => {
    const result = sanitizeTable(manifest, 'content_items', [
      { id: 1, title: 'Public story', privacy_flag: 'public' },
      { id: 2, title: 'Private story', privacy_flag: 'private' },
      { id: 3, title: 'Weird flag', privacy_flag: 'something_new' },
    ]);
    expect(result.rows.map((r) => r.id)).toEqual([1]);
    expect(result.excludedCount).toBe(2);
  });

  it('dataset sanitization stats never echo source values', () => {
    const result = sanitizeDataset(manifest, {
      members: [{ id: 1, email: 'leak@example.com', role: 'member' }],
      login_attempts: [{ id: 1, email: 'leak@example.com', ip: '1.2.3.4', ok: 0 }],
    });
    expect(result.ok).toBe(true);
    const blob = JSON.stringify(privacySafeSummary(result.summary));
    expect(blob).not.toContain('leak@example.com');
    expect(blob).not.toContain('1.2.3.4');
    expect(result.summary.find((s) => s.table === 'members')?.excludedCount).toBe(1);
  });

  it('refresh gate is GO after Product disposition of photos.people', () => {
    const gate = evaluateRefreshGate(manifest);
    expect(gate.recommendation).toBe('GO');
    expect(gate.ok).toBe(true);
    expect(gate.holds).toEqual([]);
  });

  it('fails closed when a non-copy column is missing its transform', () => {
    expect(() => applyTransform('', 'seed', 'secret@example.com')).toThrow(/Missing transform/);
  });

  it('manifest file path is stable for the refresh workflow', () => {
    expect(fs.existsSync(path.resolve(MANIFEST_RELATIVE))).toBe(true);
  });
});
