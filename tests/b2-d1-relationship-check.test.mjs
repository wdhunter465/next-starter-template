import { describe, expect, it, vi } from 'vitest';

import {
  checkPhotoAddress,
  listPublicPhotos,
  renderReport,
  runRelationshipCheck,
} from '../scripts/ops/b2-d1-relationship-check.mjs';

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const head = (status, contentType) => ({
  status,
  headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
});

describe('B2/D1 relationship check (#4469)', () => {
  it('counts a photo address that returns an image as ok', async () => {
    const result = await checkPhotoAddress({ id: 1, url: 'https://b2.example/a.jpg' }, { fetchImpl: async () => head(200, 'image/jpeg') });
    expect(result).toMatchObject({ id: 1, ok: true, status: 200, contentType: 'image/jpeg', reason: null });
  });

  it('fails a 404 with an XML body, the Backblaze missing-object case', async () => {
    const result = await checkPhotoAddress({ id: 2, url: 'u' }, { fetchImpl: async () => head(404, 'application/xml') });
    expect(result).toMatchObject({ ok: false, reason: 'http_404', status: 404 });
  });

  it('fails a 200 that is not an image', async () => {
    const result = await checkPhotoAddress({ id: 3, url: 'u' }, { fetchImpl: async () => head(200, 'text/html; charset=utf-8') });
    expect(result).toMatchObject({ ok: false, reason: 'not_an_image', contentType: 'text/html' });
  });

  it('classifies a network error and a timeout', async () => {
    const boom = await checkPhotoAddress({ id: 4, url: 'u' }, { fetchImpl: async () => { throw new Error('down'); } });
    expect(boom).toMatchObject({ ok: false, reason: 'network_error' });
    const slow = await checkPhotoAddress({ id: 5, url: 'u' }, {
      fetchImpl: async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; },
    });
    expect(slow).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('pages through the public photo list until a short page', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: i, url: `u${i}` }));
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ items: full }))
      .mockResolvedValueOnce(json({ items: [{ id: 100, url: 'u100' }] }));
    const photos = await listPublicPhotos('https://site.example', { fetchImpl });
    expect(photos).toHaveLength(101);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws when the photo list itself fails', async () => {
    await expect(listPublicPhotos('https://site.example', { fetchImpl: async () => json({}, 500) })).rejects.toThrow(/500/);
  });

  it('reports totals and the failing ids', async () => {
    const fetchImpl = async (url) => {
      if (url.includes('/api/photos')) return json({ items: [{ id: 1, url: 'https://b2/ok.jpg' }, { id: 2, url: 'https://b2/missing.jpg' }] });
      return url.endsWith('ok.jpg') ? head(200, 'image/jpeg') : head(404, 'application/xml');
    };
    const report = await runRelationshipCheck('https://site.example', { fetchImpl });
    expect(report).toMatchObject({ total: 2, ok: 1 });
    expect(report.failed.map((f) => f.id)).toEqual([2]);
    expect(renderReport(report)).toContain('- id 2: http_404 (HTTP 404)');
  });
});
