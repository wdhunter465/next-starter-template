import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL } from '../functions/_lib/photos-rights-reconcile';

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

function insertMediaAsset(
  db: DatabaseSync,
  {
    mediaUid,
    b2Key,
    rightsHold,
    rightsHoldReason,
    rightsHoldSetAt = null,
  }: {
    mediaUid: string;
    b2Key: string;
    rightsHold: number;
    rightsHoldReason: string | null;
    rightsHoldSetAt?: string | null;
  },
) {
  db.prepare(
    'INSERT INTO media_assets (media_uid, b2_key, size, rights_hold, rights_hold_reason, rights_hold_set_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(mediaUid, b2Key, 1024, rightsHold, rightsHoldReason, rightsHoldSetAt);
}

function insertPhoto(
  db: DatabaseSync,
  { photoId, url, isMatchupEligible }: { photoId: string; url: string; isMatchupEligible?: number },
) {
  if (isMatchupEligible === undefined) {
    db.prepare(
      "INSERT INTO photos (url, is_memorabilia, description, photo_id) VALUES (?, 0, '', ?)",
    ).run(url, photoId);
    return;
  }
  db.prepare(
    "INSERT INTO photos (url, is_memorabilia, description, photo_id, is_matchup_eligible) VALUES (?, 0, '', ?, ?)",
  ).run(url, photoId, isMatchupEligible);
}

describe('RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL (#3552/#3553)', () => {
  it('propagates an already-cleared media_assets decision onto the matching held photos row', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);

    insertMediaAsset(db, {
      mediaUid: 'sha256_matched',
      b2Key: 'LGFC_sha256_matched.jpg',
      rightsHold: 0,
      rightsHoldReason: 'rights_evidence_conclusion:public_domain_confirmed reviewer:Bill Hunter',
      rightsHoldSetAt: '2026-08-18T12:27:31.331Z',
    });
    insertPhoto(db, {
      photoId: 'LGFC_sha256_matched.jpg',
      url: 'https://example.com/LGFC_sha256_matched.jpg',
    });

    db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL);

    const row = db
      .prepare(
        'SELECT rights_hold, publication_eligible, rights_status, reviewed_by, rights_hold_reason, reviewed_at, rights_hold_set_at FROM photos WHERE photo_id = ?',
      )
      .get('LGFC_sha256_matched.jpg') as {
      rights_hold: number;
      publication_eligible: number;
      rights_status: string;
      reviewed_by: string;
      rights_hold_reason: string;
      reviewed_at: string;
      rights_hold_set_at: string;
    };

    expect(row.rights_hold).toBe(0);
    expect(row.publication_eligible).toBe(1);
    expect(row.rights_status).toBe('permission_granted');
    expect(row.reviewed_by).toBe('Bill Hunter');
    expect(row.rights_hold_reason).toBe('rights_evidence_conclusion:public_domain_confirmed reviewer:Bill Hunter');
    // Both timestamps come from the real historical review time recorded on
    // media_assets, not from when this reconciliation happened to run.
    expect(row.reviewed_at).toBe('2026-08-18T12:27:31.331Z');
    expect(row.rights_hold_set_at).toBe('2026-08-18T12:27:31.331Z');
  });

  it('also flips is_matchup_eligible so a content-collection rights approval reaches Weekly Matchup (#3551)', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);

    insertMediaAsset(db, {
      mediaUid: 'sha256_matchup',
      b2Key: 'LGFC_sha256_matchup.jpg',
      rightsHold: 0,
      rightsHoldReason: 'rights_evidence_conclusion:public_domain_confirmed reviewer:Bill Hunter',
      rightsHoldSetAt: '2026-08-18T12:27:31.331Z',
    });
    insertPhoto(db, {
      photoId: 'LGFC_sha256_matchup.jpg',
      url: 'https://example.com/LGFC_sha256_matchup.jpg',
    });

    db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL);

    const row = db
      .prepare('SELECT is_matchup_eligible FROM photos WHERE photo_id = ?')
      .get('LGFC_sha256_matchup.jpg') as { is_matchup_eligible: number };

    expect(row.is_matchup_eligible).toBe(1);
  });

  it('never overrides an explicit matchup exclusion (-1) with a rights reconciliation', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);

    insertMediaAsset(db, {
      mediaUid: 'sha256_excluded',
      b2Key: 'LGFC_sha256_excluded.jpg',
      rightsHold: 0,
      rightsHoldReason: 'rights_evidence_conclusion:public_domain_confirmed reviewer:Bill Hunter',
      rightsHoldSetAt: '2026-08-18T12:27:31.331Z',
    });
    // rights_hold defaults to 1 (migrations/0053), so this row is still
    // picked up by the reconciliation's WHERE clause even though its
    // matchup eligibility was separately, explicitly excluded.
    insertPhoto(db, {
      photoId: 'LGFC_sha256_excluded.jpg',
      url: 'https://example.com/LGFC_sha256_excluded.jpg',
      isMatchupEligible: -1,
    });

    db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL);

    const row = db
      .prepare('SELECT rights_hold, is_matchup_eligible FROM photos WHERE photo_id = ?')
      .get('LGFC_sha256_excluded.jpg') as { rights_hold: number; is_matchup_eligible: number };

    expect(row.rights_hold).toBe(0);
    expect(row.is_matchup_eligible).toBe(-1);
  });

  it('does not throw when the same b2_key appears on more than one cleared media_assets row', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);

    // b2_key is indexed but not UNIQUE (migrations/0010_media_assets.sql) --
    // two rows can legitimately share one key (e.g. re-ingest under a new
    // media_uid). The reconciliation SQL must still produce exactly one
    // deterministic answer instead of a "subquery returned more than one
    // row" runtime error.
    insertMediaAsset(db, {
      mediaUid: 'sha256_dup_old',
      b2Key: 'LGFC_sha256_dup.jpg',
      rightsHold: 0,
      rightsHoldReason: 'rights_evidence_conclusion:public_domain_confirmed reviewer:Bill Hunter',
      rightsHoldSetAt: '2026-08-01T00:00:00.000Z',
    });
    insertMediaAsset(db, {
      mediaUid: 'sha256_dup_new',
      b2Key: 'LGFC_sha256_dup.jpg',
      rightsHold: 0,
      rightsHoldReason: 'rights_evidence_conclusion:permission_granted reviewer:Bill Hunter',
      rightsHoldSetAt: '2026-08-18T00:00:00.000Z',
    });
    insertPhoto(db, {
      photoId: 'LGFC_sha256_dup.jpg',
      url: 'https://example.com/LGFC_sha256_dup.jpg',
    });

    expect(() => db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL)).not.toThrow();

    const row = db
      .prepare('SELECT rights_hold, rights_hold_reason FROM photos WHERE photo_id = ?')
      .get('LGFC_sha256_dup.jpg') as { rights_hold: number; rights_hold_reason: string };

    expect(row.rights_hold).toBe(0);
    // Deterministically picks the most recently inserted (highest id) row.
    expect(row.rights_hold_reason).toBe('rights_evidence_conclusion:permission_granted reviewer:Bill Hunter');
  });

  it('leaves a held photos row alone when there is no matching cleared media_assets row', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);

    insertPhoto(db, {
      photoId: 'unreviewed_member_upload.jpg',
      url: 'https://example.com/unreviewed_member_upload.jpg',
    });

    db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL);

    const row = db
      .prepare('SELECT rights_hold, publication_eligible FROM photos WHERE photo_id = ?')
      .get('unreviewed_member_upload.jpg') as { rights_hold: number; publication_eligible: number };

    expect(row.rights_hold).toBe(1);
    expect(row.publication_eligible).toBe(0);
  });

  it('does not touch a media_assets row that is itself still held', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);

    insertMediaAsset(db, {
      mediaUid: 'sha256_still_held',
      b2Key: 'LGFC_sha256_still_held.jpg',
      rightsHold: 1,
      rightsHoldReason: null,
    });
    insertPhoto(db, {
      photoId: 'LGFC_sha256_still_held.jpg',
      url: 'https://example.com/LGFC_sha256_still_held.jpg',
    });

    db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL);

    const row = db
      .prepare('SELECT rights_hold FROM photos WHERE photo_id = ?')
      .get('LGFC_sha256_still_held.jpg') as { rights_hold: number };

    expect(row.rights_hold).toBe(1);
  });

  it('is idempotent -- running it twice changes nothing the second time', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);

    insertMediaAsset(db, {
      mediaUid: 'sha256_idempotent',
      b2Key: 'LGFC_sha256_idempotent.jpg',
      rightsHold: 0,
      rightsHoldReason: 'rights_evidence_conclusion:permission_granted reviewer:Bill Hunter',
    });
    insertPhoto(db, {
      photoId: 'LGFC_sha256_idempotent.jpg',
      url: 'https://example.com/LGFC_sha256_idempotent.jpg',
    });

    db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL);
    const firstReviewedAt = (
      db.prepare('SELECT reviewed_at FROM photos WHERE photo_id = ?').get('LGFC_sha256_idempotent.jpg') as {
        reviewed_at: string;
      }
    ).reviewed_at;

    db.exec(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL);
    const row = db
      .prepare('SELECT rights_hold, reviewed_at FROM photos WHERE photo_id = ?')
      .get('LGFC_sha256_idempotent.jpg') as { rights_hold: number; reviewed_at: string };

    expect(row.rights_hold).toBe(0);
    expect(row.reviewed_at).toBe(firstReviewedAt);
  });
});
