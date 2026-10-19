import { describe, expect, it } from 'vitest';
import {
  checkAddress,
  collectAddresses,
  failingMarker,
  renderReport,
  runAddressCheck,
} from '../scripts/ops/photo-address-check.mjs';

const BASE = 'https://site.test';
const img = (name) => `https://b2.test/${name}.jpg`;

function image() {
  return new Response(null, { status: 200, headers: { 'content-type': 'image/jpeg' } });
}

// Routes the two public list endpoints and the photo addresses.
function fakeFetch({ photos = [], matchup = [], photoList, matchupList, address = () => image() }) {
  return async (url) => {
    const target = String(url);
    if (target.startsWith(`${BASE}/api/photos`)) {
      if (photoList) return photoList();
      return Response.json({ items: photos.map((photoUrl, index) => ({ id: index + 1, url: photoUrl })) });
    }
    if (target === `${BASE}/api/matchup/current`) {
      if (matchupList) return matchupList();
      return Response.json({ ok: true, items: matchup.map((photoUrl, index) => ({ id: 100 + index, url: photoUrl })) });
    }
    return address(target);
  };
}

const fast = { retryDelayMs: 0 };

describe('collectAddresses', () => {
  it('takes addresses from the public photo list and the current matchup, each address once', async () => {
    const fetchImpl = fakeFetch({ photos: [img('a'), img('b')], matchup: [img('b'), img('c')] });
    const { addresses, listErrors } = await collectAddresses(BASE, { fetchImpl });
    expect(addresses.map((item) => item.url)).toEqual([img('a'), img('b'), img('c')]);
    expect(addresses.find((item) => item.url === img('b')).source).toBe('photos');
    expect(listErrors).toEqual([]);
  });

  it('records a list that cannot be read instead of throwing', async () => {
    const fetchImpl = fakeFetch({ photos: [img('a')], matchupList: async () => new Response('x', { status: 503 }) });
    const { addresses, listErrors } = await collectAddresses(BASE, { fetchImpl });
    expect(addresses).toHaveLength(1);
    expect(listErrors).toEqual([{ source: 'matchup', reason: 'matchup returned 503' }]);
  });
});

describe('runAddressCheck', () => {
  it('passes when every address returns an image', async () => {
    const report = await runAddressCheck(BASE, { fetchImpl: fakeFetch({ photos: [img('a')], matchup: [img('b')] }), ...fast });
    expect(report).toMatchObject({ ok: true, total: 2, failed: [], listErrors: [] });
  });

  it('fails on a 404', async () => {
    const address = (url) => (url === img('b') ? new Response('<Error/>', { status: 404, headers: { 'content-type': 'application/xml' } }) : image());
    const report = await runAddressCheck(BASE, { fetchImpl: fakeFetch({ photos: [img('a'), img('b')], address }), ...fast });
    expect(report.ok).toBe(false);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]).toMatchObject({ url: img('b'), reason: 'http_404', status: 404 });
  });

  it('fails on a 200 with an XML body (an error document, not an image)', async () => {
    const address = () => new Response('<Error/>', { status: 200, headers: { 'content-type': 'application/xml' } });
    const report = await runAddressCheck(BASE, { fetchImpl: fakeFetch({ photos: [img('a')], address }), ...fast });
    expect(report.ok).toBe(false);
    expect(report.failed[0]).toMatchObject({ reason: 'not_an_image' });
  });

  it('fails on a timeout', async () => {
    const address = () => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); };
    const report = await runAddressCheck(BASE, { fetchImpl: fakeFetch({ photos: [img('a')], address }), ...fast });
    expect(report.ok).toBe(false);
    expect(report.failed[0]).toMatchObject({ reason: 'timeout' });
  });

  it('fails when a list cannot be read, even if every address it did list loads', async () => {
    const fetchImpl = fakeFetch({ photos: [img('a')], matchupList: async () => new Response('x', { status: 500 }) });
    const report = await runAddressCheck(BASE, { fetchImpl, ...fast });
    expect(report.ok).toBe(false);
    expect(report.failed).toEqual([]);
    expect(report.listErrors).toHaveLength(1);
  });
});

describe('checkAddress retry', () => {
  it('passes when the second attempt returns an image', async () => {
    let calls = 0;
    const fetchImpl = async () => (++calls === 1 ? new Response('x', { status: 503 }) : image());
    const result = await checkAddress({ source: 'photos', id: 1, url: img('a') }, { fetchImpl, ...fast });
    expect(result).toMatchObject({ ok: true });
    expect(calls).toBe(2);
  });

  it('fails only after every attempt fails', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; return new Response('x', { status: 503 }); };
    const result = await checkAddress({ source: 'photos', id: 1, url: img('a') }, { fetchImpl, ...fast });
    expect(result).toMatchObject({ ok: false, reason: 'http_503' });
    expect(calls).toBe(2);
  });
});

describe('reporting', () => {
  const failing = {
    base: BASE,
    total: 3,
    ok: false,
    failed: [{ source: 'matchup', id: 101, url: img('b'), status: 404, reason: 'http_404' }],
    listErrors: [{ source: 'photos', reason: 'photo list returned 500' }],
  };

  it('names the failing address and the list that could not be read', () => {
    const text = renderReport(failing, '2026-10-19T00:00:00Z');
    expect(text).toContain('Overall: FAIL');
    expect(text).toContain(`| matchup | 101 | ${img('b')} | http_404 (HTTP 404) |`);
    expect(text).toContain('Could not list photos: photo list returned 500');
  });

  it('reports a pass without a failure table', () => {
    const text = renderReport({ base: BASE, total: 2, ok: true, failed: [], listErrors: [] });
    expect(text).toContain('Overall: PASS');
    expect(text).not.toContain('| Source |');
  });

  it('builds a stable marker from the sorted failing set', () => {
    expect(failingMarker(failing)).toBe('<!-- photo-address-check:failing=list:photos,matchup:101 -->');
  });
});
