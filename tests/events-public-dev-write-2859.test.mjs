import { describe, expect, it } from 'vitest';

import {
  buildResultMarkdown,
  isApplyMode,
  parseProdAndPreviewD1,
  redactSecrets,
  requireEnv,
} from '../scripts/ci/events_public_dev_write_2859.mjs';

describe('events_public_dev_write_2859 helpers', () => {
  it('requires Dev credential names only', () => {
    expect(requireEnv({})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'D1_DEV_DATABASE_NAME',
      'D1_DEV_DATABASE_ID',
    ]);
    expect(
      requireEnv({
        CLOUDFLARE_API_TOKEN: 't',
        CLOUDFLARE_ACCOUNT_ID: 'a',
        D1_DEV_DATABASE_NAME: 'lgfc-litedev',
        D1_DEV_DATABASE_ID: 'uuid',
      }),
    ).toEqual([]);
  });

  it('requires both apply gates', () => {
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'confirm' })).toBe(true);
    expect(isApplyMode({ MODE: 'dry-run', CONFIRM_WRITE: 'confirm' })).toBe(false);
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'yes' })).toBe(false);
  });

  it('parses distinct Production and Preview D1 identities', () => {
    const parsed = parseProdAndPreviewD1(`
[[d1_databases]]
binding = "DB"
database_name = "lgfc_lite"
database_id = "prod-uuid"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "lgfc-litedev"
database_id = "dev-uuid"
`);
    expect(parsed.production).toEqual({ databaseName: 'lgfc_lite', databaseId: 'prod-uuid' });
    expect(parsed.preview).toEqual({ databaseName: 'lgfc-litedev', databaseId: 'dev-uuid' });
  });

  it('redacts secrets from diagnostic text', () => {
    expect(redactSecrets('token=abc account=xyz', ['abc', 'xyz'])).toBe(
      'token=[REDACTED] account=[REDACTED]',
    );
  });

  it('builds markdown without row content', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-12T00:00:00.000Z',
      mode: 'dry-run',
      counts: { EV_TOTAL: 21, EV_POSTED: 20, EV_HIDDEN: 1, EV_INVALID_EMPTY: 0, CI_CALENDAR_TAG: 0 },
      summary: { insert: 20, update: 0, noop: 0, excluded: 0, conflict: 0 },
      exceptions: [],
    });
    expect(md).toContain('dry-run');
    expect(md).toContain('Events total: 21');
    expect(md).not.toContain('Lou Gehrig');
  });
});
