import { describe, expect, it } from 'vitest';
import {
  discoverEnvExampleNames,
  discoverWorkflowSecretNames,
  discoverWranglerD1Names,
  parseRegister,
  reconcile,
  renderReport,
} from '../scripts/ops/reconcile-asset-register.mjs';

const REGISTER = `
<!-- asset-register:table:start -->
| asset_id | class | name | provider | environment | business_owner | technical_owner | source_of_truth | depends_on | data_class | credential_refs | monitor | status | last_reconciled |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cf:d1:lgfc_lite | platform | Prod D1 | Cloudflare | production | Product Authority | team:operations | wrangler.toml | — | member | D1_DATABASE_ID | backup | active | 2026-10-10 |
| saas:zapier:automation | saas | Zapier | Zapier | n/a | Product Authority | team:operations | vendor-inventory | — | none | — | none | future | — |
<!-- asset-register:table:end -->

<!-- asset-register:secrets:start -->
| name | used_by | asset_id |
| --- | --- | --- |
| D1_DATABASE_ID | workflows | cf:d1:lgfc_lite |
<!-- asset-register:secrets:end -->
`;

const TODAY = new Date('2026-10-11T00:00:00Z');

describe('asset register parsing', () => {
  it('parses the asset table and secret catalog between markers', () => {
    const { assets, secrets } = parseRegister(REGISTER);
    expect(assets).toHaveLength(2);
    expect(assets[0].asset_id).toBe('cf:d1:lgfc_lite');
    expect(assets[0].last_reconciled).toBe('2026-10-10');
    expect(secrets).toEqual([{ name: 'D1_DATABASE_ID', used_by: 'workflows', asset_id: 'cf:d1:lgfc_lite' }]);
  });

  it('returns null when markers are missing', () => {
    expect(parseRegister('# empty')).toEqual({ assets: null, secrets: null });
  });
});

describe('repository discovery', () => {
  it('finds secret names referenced by workflows', () => {
    const names = discoverWorkflowSecretNames(['token: ${{ secrets.CLOUDFLARE_API_TOKEN }}\nid: ${{ secrets.D1_DATABASE_ID }}']);
    expect([...names].sort()).toEqual(['CLOUDFLARE_API_TOKEN', 'D1_DATABASE_ID']);
  });

  it('finds .env.example variable names', () => {
    expect([...discoverEnvExampleNames('# c\nB2_BUCKET=\nMAIL_FROM=x\n')]).toEqual(['B2_BUCKET', 'MAIL_FROM']);
  });

  it('finds D1 database names in wrangler.toml', () => {
    const toml = '[[d1_databases]]\ndatabase_name = "lgfc_lite"\n[[env.preview.d1_databases]]\ndatabase_name = "lgfc-litedev"\n';
    expect([...discoverWranglerD1Names(toml)]).toEqual(['lgfc_lite', 'lgfc-litedev']);
  });
});

describe('reconcile', () => {
  const base = () => ({ ...parseRegister(REGISTER), today: TODAY });

  it('reports no drift when the register matches the repository', () => {
    const result = reconcile({
      ...base(),
      workflowSecretNames: new Set(['D1_DATABASE_ID']),
      wranglerD1Names: new Set(['lgfc_lite']),
    });
    expect(result.drift).toEqual([]);
    expect(result.info.map((item) => item.code)).toEqual(['provisional_row']);
  });

  it('flags rows older than the staleness window', () => {
    const result = reconcile({ ...base(), workflowSecretNames: new Set(['D1_DATABASE_ID']), today: new Date('2027-03-01T00:00:00Z') });
    expect(result.drift.map((item) => item.code)).toContain('stale_row');
  });

  it('flags secret names used by the repository but missing from the catalog', () => {
    const result = reconcile({ ...base(), workflowSecretNames: new Set(['D1_DATABASE_ID', 'NEW_TOKEN']) });
    expect(result.drift).toContainEqual(expect.objectContaining({ code: 'uncatalogued_secret_name', name: 'NEW_TOKEN' }));
  });

  it('flags catalog entries nothing references', () => {
    const result = reconcile({ ...base(), workflowSecretNames: new Set() });
    expect(result.drift).toContainEqual(expect.objectContaining({ code: 'unused_catalog_entry', name: 'D1_DATABASE_ID' }));
  });

  it('flags D1 databases declared in wrangler.toml without a register row', () => {
    const result = reconcile({
      ...base(),
      workflowSecretNames: new Set(['D1_DATABASE_ID']),
      wranglerD1Names: new Set(['lgfc_lite', 'lgfc-litedev']),
    });
    expect(result.drift).toContainEqual(expect.objectContaining({ code: 'missing_d1_asset', name: 'lgfc-litedev' }));
  });

  it('treats a missing register as drift', () => {
    const result = reconcile({ assets: null, secrets: null });
    expect(result.drift.map((item) => item.code)).toEqual(['register_table_missing']);
  });

  it('renders drift and provisional sections', () => {
    const report = renderReport({
      drift: [{ code: 'stale_row', message: 'x is stale.' }],
      info: [{ code: 'provisional_row', message: 'y is provisional.' }],
    });
    expect(report).toContain('- Drift findings: 1');
    expect(report).toContain('`stale_row`: x is stale.');
    expect(report).toContain('y is provisional.');
  });
});
