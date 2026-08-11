import { describe, expect, it } from 'vitest';
import { buildEnv, resolveEnabledFlag, resolveTargetEnv } from '../scripts/ops/enable-ai-review-access.mjs';

describe('resolveTargetEnv', () => {
  it('defaults to preview when unset', () => {
    expect(resolveTargetEnv(undefined)).toBe('preview');
    expect(resolveTargetEnv('')).toBe('preview');
  });

  it('accepts preview and production (case-insensitive)', () => {
    expect(resolveTargetEnv('preview')).toBe('preview');
    expect(resolveTargetEnv('PRODUCTION')).toBe('production');
  });

  it('rejects unknown environments', () => {
    expect(resolveTargetEnv('staging')).toBeNull();
    expect(resolveTargetEnv('prod')).toBeNull();
  });
});

describe('resolveEnabledFlag', () => {
  it('defaults to true when unset', () => {
    expect(resolveEnabledFlag(undefined)).toBe('true');
  });

  it('accepts true and false', () => {
    expect(resolveEnabledFlag('true')).toBe('true');
    expect(resolveEnabledFlag('FALSE')).toBe('false');
  });

  it('rejects unknown values', () => {
    expect(resolveEnabledFlag('yes')).toBeNull();
  });
});

describe('buildEnv', () => {
  it('copies plain_text keys and skips AI_REVIEW_* keys we replace', () => {
    const { next, foreignSecrets } = buildEnv({
      KEEP: { type: 'plain_text', value: 'yes' },
      AI_REVIEW_ENABLED: { type: 'plain_text', value: 'true' },
      AI_REVIEW_TOKEN: { type: 'secret_text', value: 'redacted' },
      OTHER_SECRET: { type: 'secret_text', value: 'redacted' },
    });
    expect(next).toEqual({ KEEP: { type: 'plain_text', value: 'yes' } });
    expect(foreignSecrets).toEqual(['OTHER_SECRET']);
  });
});
