import { describe, expect, it } from 'vitest';

import { hasOurRule, mergeCorsRules, OUR_RULE } from '../scripts/ops/b2-cors-rules.mjs';

describe('mergeCorsRules (#5131)', () => {
  it('adds our rule when there are no rules', () => {
    const merged = mergeCorsRules([]);
    expect(merged).toHaveLength(1);
    expect(merged[0].corsRuleName).toBe('lgfc-site-images');
    expect(merged[0].allowedOrigins).toContain('https://www.lougehrigfanclub.com');
    expect(merged[0].allowedOperations).toContain('s3_get');
  });

  it('keeps rules with other names and replaces a stale rule of ours', () => {
    const other = { corsRuleName: 'someone-else', allowedOrigins: ['https://example.com'], allowedOperations: ['s3_get'], allowedHeaders: [], exposeHeaders: [], maxAgeSeconds: 60 };
    const stale = { ...OUR_RULE, allowedOrigins: ['https://old.example.com'] };
    const merged = mergeCorsRules([other, stale]);
    expect(merged.map((r) => r.corsRuleName)).toEqual(['someone-else', 'lgfc-site-images']);
    expect(merged[1].allowedOrigins).not.toContain('https://old.example.com');
  });

  it('tolerates a missing or odd existing value', () => {
    expect(mergeCorsRules(undefined)).toHaveLength(1);
    expect(mergeCorsRules(null as unknown as [])).toHaveLength(1);
  });
});

describe('hasOurRule (#5131)', () => {
  it('is true only when the existing rule equals ours', () => {
    expect(hasOurRule([{ ...OUR_RULE }])).toBe(true);
    expect(hasOurRule([{ ...OUR_RULE, maxAgeSeconds: 1 }])).toBe(false);
    expect(hasOurRule([{ ...OUR_RULE, allowedOrigins: ['https://x.example'] }])).toBe(false);
    expect(hasOurRule([])).toBe(false);
  });
});
