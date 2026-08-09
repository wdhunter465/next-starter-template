import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  APPROVED_BATCH_CLASSES,
  PRODUCTION_WRITE_AUTHORIZATION_VALUES,
  buildBatchReadiness,
  main,
  validateBatchPlan,
} from '../scripts/ci/production_content_batch_readiness.mjs';

function compliantBatchPlan(overrides = {}) {
  return {
    batchClass: 'faq-public-seed',
    attributionEvidence: 'sourced from migrations/0027_faq_email_and_seed.sql, editorial-reviewed',
    idempotencyKeyStrategy: 'upsert keyed on faq slug, safe to re-run',
    recoveryPlan: 'pre-apply D1 export snapshot retained, rollback migration available',
    privacyExclusionEvidence: 'FAQ content is public Q&A only, no member data',
    placeholderExclusionEvidence: 'every row reviewed for real content, no lorem-ipsum/TBD text',
    originalMediaPreservationEvidence: 'not applicable — no media in this batch',
    preCountEvidence: 'pre-apply row count: 0 (table empty)',
    productionWriteAuthorization: 'not-yet-authorized',
    ...overrides,
  };
}

describe('validateBatchPlan', () => {
  it('accepts a fully compliant batch-plan record', () => {
    expect(validateBatchPlan(compliantBatchPlan())).toEqual([]);
  });

  it('accepts every one of the eight approved batch classes', () => {
    for (const batchClass of APPROVED_BATCH_CLASSES) {
      expect(validateBatchPlan(compliantBatchPlan({ batchClass }))).toEqual([]);
    }
  });

  it('covers exactly the eight batch classes #2907 Section 6 approved', () => {
    expect(APPROVED_BATCH_CLASSES).toEqual([
      'faq-public-seed',
      'milestones-public',
      'friends-partners',
      'events-public',
      'matchup-week-pair',
      'library-inventory',
      'club-home-content',
      'media-member-gallery',
    ]);
  });

  it('flags every missing or empty required field', () => {
    const problems = validateBatchPlan(compliantBatchPlan({ recoveryPlan: '', preCountEvidence: undefined }));
    expect(problems).toContain('missing_or_empty:recoveryPlan');
    expect(problems).toContain('missing_or_empty:preCountEvidence');
  });

  it('flags a whitespace-only field as missing', () => {
    expect(validateBatchPlan(compliantBatchPlan({ attributionEvidence: '   ' }))).toContain(
      'missing_or_empty:attributionEvidence',
    );
  });

  it('flags an unapproved batch class — the "no batch outside #2907 Section 6" invariant', () => {
    const problems = validateBatchPlan(compliantBatchPlan({ batchClass: 'unauthorized-scraped-batch' }));
    expect(problems).toContain('unapproved_batch_class:unauthorized-scraped-batch');
  });

  it('flags an invalid productionWriteAuthorization value', () => {
    const problems = validateBatchPlan(compliantBatchPlan({ productionWriteAuthorization: 'maybe-later' }));
    expect(problems).toContain('invalid_production_write_authorization:maybe-later');
  });

  it('covers exactly the two defined authorization values', () => {
    expect(PRODUCTION_WRITE_AUTHORIZATION_VALUES).toEqual(['not-yet-authorized', 'authorized']);
  });

  it('fails closed on a non-object record instead of throwing', () => {
    expect(validateBatchPlan(null)).toEqual(['batch_plan_not_an_object']);
    expect(validateBatchPlan('x')).toEqual(['batch_plan_not_an_object']);
  });

  it('rejects an array as not-an-object, instead of cascading through as a valid record', () => {
    expect(validateBatchPlan(['not', 'a', 'batch'])).toEqual(['batch_plan_not_an_object']);
  });
});

describe('buildBatchReadiness', () => {
  it('is ready (dry-run/planning readiness) for a compliant not-yet-authorized batch by default', () => {
    const result = buildBatchReadiness({ record: compliantBatchPlan() });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an incomplete batch plan', () => {
    const result = buildBatchReadiness({ record: compliantBatchPlan({ idempotencyKeyStrategy: '' }) });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('batch_plan_incomplete');
  });

  it('blocks on a null record without throwing', () => {
    expect(() => buildBatchReadiness({ record: null })).not.toThrow();
    const result = buildBatchReadiness({ record: null });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('batch_plan_incomplete');
  });

  it('does not require write authorization by default, even when not-yet-authorized', () => {
    const result = buildBatchReadiness({
      record: compliantBatchPlan({ productionWriteAuthorization: 'not-yet-authorized' }),
    });
    expect(result.blockers).not.toContain('production_write_not_authorized');
  });

  it('blocks on missing write authorization when requireWriteAuthorization is set — the live-apply gate', () => {
    const result = buildBatchReadiness({
      record: compliantBatchPlan({ productionWriteAuthorization: 'not-yet-authorized' }),
      requireWriteAuthorization: true,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('production_write_not_authorized');
  });

  it('is ready under requireWriteAuthorization once authorized', () => {
    const result = buildBatchReadiness({
      record: compliantBatchPlan({ productionWriteAuthorization: 'authorized' }),
      requireWriteAuthorization: true,
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('reports multiple blockers simultaneously when several conditions fail', () => {
    const result = buildBatchReadiness({
      record: compliantBatchPlan({ recoveryPlan: '', batchClass: 'unauthorized-scraped-batch' }),
      requireWriteAuthorization: true,
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining(['batch_plan_incomplete', 'production_write_not_authorized']),
    );
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-readiness-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires --record', () => {
    expect(main([])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --record is present but has no value', () => {
    const result = main(['--record']);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on a nonexistent --record file', () => {
    const result = main(['--record', path.join(tmpDir, 'nope.json')]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --record', () => {
    const bad = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    const result = main(['--record', bad]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against a real temp file and exits 0 when dry-run ready', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(compliantBatchPlan()));
    const result = main(['--record', recordPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 end-to-end with --require-write-authorization on a not-yet-authorized batch', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(compliantBatchPlan()));
    const result = main(['--record', recordPath, '--require-write-authorization']);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('production_write_not_authorized');
    expect(process.exitCode).toBe(1);
  });

  it('exits 0 end-to-end with --require-write-authorization on an authorized batch', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(compliantBatchPlan({ productionWriteAuthorization: 'authorized' })));
    const result = main(['--record', recordPath, '--require-write-authorization']);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('resets the exit code to 0 on a later successful call after an earlier failing call in the same process', () => {
    main(['--record', path.join(tmpDir, 'nope.json')]);
    expect(process.exitCode).toBe(1);

    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(compliantBatchPlan()));
    const result = main(['--record', recordPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});
