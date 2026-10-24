import { describe, expect, it } from 'vitest';

import { CANDIDATE_ID_PATTERN } from '../functions/_lib/content-pipeline-candidate-constants';
import { makeCandidateIdFactory, runSequenceBase } from '../scripts/content-pipeline/collect-gehrig-external-sources.mjs';

describe('discovery candidate ids (#4841)', () => {
  it('gives runs at different times disjoint ids so a later run cannot overwrite an earlier row', () => {
    const first = makeCandidateIdFactory(Date.UTC(2026, 9, 23, 15, 5, 0));
    const second = makeCandidateIdFactory(Date.UTC(2026, 9, 23, 15, 25, 0));
    const firstIds = Array.from({ length: 80 }, () => first());
    const secondIds = Array.from({ length: 80 }, () => second());
    expect(new Set([...firstIds, ...secondIds]).size).toBe(160);
  });

  it('keeps ids inside the lgfc-gehrig-YYYY-NNN+ format the importer validates', () => {
    const next = makeCandidateIdFactory(Date.UTC(2026, 9, 23, 15, 5, 0));
    expect(CANDIDATE_ID_PATTERN.test(next())).toBe(true);
  });

  it('starts each run above the old fixed range of 501 to 550', () => {
    expect(runSequenceBase(Date.UTC(2026, 9, 23, 15, 5, 0))).toBeGreaterThan(550);
  });
});
