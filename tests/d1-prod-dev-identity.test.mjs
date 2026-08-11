import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEV_ID,
  DEV_NAME,
  PROD_ID,
  PROD_NAME,
  evaluateIdentities,
  parseProdAndPreviewD1,
} from '../scripts/ci/d1_prod_dev_identity_check.mjs';

describe('d1 prod/dev identity check', () => {
  it('parses live wrangler.toml Production and Preview blocks as distinct', () => {
    const text = fs.readFileSync(path.resolve('wrangler.toml'), 'utf8');
    const parsed = parseProdAndPreviewD1(text);
    expect(parsed.production).toEqual({
      databaseName: PROD_NAME,
      databaseId: PROD_ID,
      binding: 'DB',
    });
    expect(parsed.preview).toEqual({
      databaseName: DEV_NAME,
      databaseId: DEV_ID,
      binding: 'DB',
    });
    const result = evaluateIdentities(parsed, {});
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('fails closed when Production and Preview IDs collide', () => {
    const result = evaluateIdentities(
      {
        production: { databaseName: PROD_NAME, databaseId: PROD_ID, binding: 'DB' },
        preview: { databaseName: DEV_NAME, databaseId: PROD_ID, binding: 'DB' },
      },
      {},
    );
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('must not be identical'))).toBe(true);
  });

  it('fails closed when Preview block is missing', () => {
    const result = evaluateIdentities(
      {
        production: { databaseName: PROD_NAME, databaseId: PROD_ID, binding: 'DB' },
        preview: { databaseName: '', databaseId: '', binding: '' },
      },
      {},
    );
    expect(result.ok).toBe(false);
  });

  it('fails closed when secret env IDs collide', () => {
    const result = evaluateIdentities(
      {
        production: { databaseName: PROD_NAME, databaseId: PROD_ID, binding: 'DB' },
        preview: { databaseName: DEV_NAME, databaseId: DEV_ID, binding: 'DB' },
      },
      { D1_DATABASE_ID: PROD_ID, D1_DEV_DATABASE_ID: PROD_ID },
    );
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes('D1_DEV_DATABASE_ID'))).toBe(true);
  });
});
