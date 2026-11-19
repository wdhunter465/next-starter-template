import { describe, expect, it } from 'vitest';
import { INSTAGRAM, instagramFrameOk, instagramGeometry, renderInstagramVariant, variantKey } from '../scripts/ops/social-pad-variant.mjs';

describe('instagram padding geometry (#5196)', () => {
  it('pads photo 864 (2424x3397, ratio 0.71) to 1080x1350 without cropping or distorting', () => {
    const g = instagramGeometry(2424, 3397);
    expect(g.padded).toBe(true);
    expect(g.frame).toEqual({ width: 1080, height: 1350 });
    expect(g.photo.height).toBe(1350);
    expect(g.photo.width).toBe(Math.round(2424 * (1350 / 3397)));
    expect(g.offset.top).toBe(0);
    expect(g.offset.left).toBe(Math.floor((1080 - g.photo.width) / 2));
    expect(Math.abs(g.photo.width / g.photo.height - 2424 / 3397)).toBeLessThan(0.002);
    expect(instagramFrameOk(g.frame)).toBe(true);
  });

  it('leaves a photo already inside 4:5 to 1.91:1 unpadded, scaled to 1080 wide', () => {
    for (const [w, h] of [[1000, 1000], [4000, 3000], [1600, 2000], [1910, 1000]]) {
      const g = instagramGeometry(w, h);
      expect(g.padded).toBe(false);
      expect(g.frame.width).toBe(1080);
      expect(instagramFrameOk(g.frame)).toBe(true);
    }
  });

  it('pads a very wide photo above and below to 1080x566', () => {
    const g = instagramGeometry(3000, 1000);
    expect(g.padded).toBe(true);
    expect(g.frame).toEqual({ width: 1080, height: 566 });
    expect(g.photo.width).toBe(1080);
    expect(g.offset.left).toBe(0);
    expect(g.offset.top).toBeGreaterThan(0);
    expect(instagramFrameOk(g.frame)).toBe(true);
  });

  it('never makes the photo larger than the frame and always yields a valid frame', () => {
    for (let w = 300; w <= 6000; w += 331) {
      for (let h = 300; h <= 6000; h += 277) {
        const g = instagramGeometry(w, h);
        expect(g.photo.width).toBeLessThanOrEqual(g.frame.width);
        expect(g.photo.height).toBeLessThanOrEqual(g.frame.height);
        expect(g.offset.left + g.photo.width).toBeLessThanOrEqual(g.frame.width);
        expect(g.offset.top + g.photo.height).toBeLessThanOrEqual(g.frame.height);
        expect(instagramFrameOk(g.frame)).toBe(true);
        expect(Math.abs(g.photo.width / g.photo.height - w / h) / (w / h)).toBeLessThan(0.01);
      }
    }
  });

  it('rejects an invalid size', () => {
    expect(() => instagramGeometry(0, 10)).toThrow();
    expect(() => instagramGeometry(10.5, 10)).toThrow();
  });

  it('names the variant object by platform and photo id', () => {
    expect(variantKey('instagram', 864)).toBe('social-variants/instagram/864.jpg');
    expect(INSTAGRAM.maxBytes).toBe(8388608);
  });
});

describe('instagram variant pixels (#5196)', () => {
  it('renders a valid JPEG within the limits when sharp is available', async () => {
    let sharpMod;
    try { sharpMod = await import('sharp'); } catch { return; }
    const sharp = sharpMod.default;
    const src = await sharp({ create: { width: 600, height: 850, channels: 3, background: '#336699' } }).png().toBuffer();
    const { buffer, geometry } = await renderInstagramVariant(src);
    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(geometry.frame.width);
    expect(meta.height).toBe(geometry.frame.height);
    expect(meta.width / meta.height).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(buffer.length).toBeLessThan(8 * 1024 * 1024);
    const a = await renderInstagramVariant(src);
    expect(a.buffer.equals(buffer)).toBe(true);
  });
});

import { photosNeedingVariant, run as prepare } from '../scripts/ops/social-pad-prepare.mjs';

const queue = {
  automation_starts_at: '2026-11-01T00:00:00-05:00',
  lateness_hours: 4,
  posts: [
    { id: 'a', publish_at: '2026-11-15T10:00:00-05:00', photo_id: 864, platforms: ['x', 'instagram'], status: 'approved' },
    { id: 'b', publish_at: '2026-11-15T10:00:00-05:00', photo_id: 864, platforms: ['x', 'instagram'], status: 'approved' },
    { id: 'c', publish_at: '2026-11-15T10:00:00-05:00', photo_id: 858, platforms: ['x', 'facebook'], status: 'approved' },
    { id: 'd', publish_at: '2026-11-20T10:00:00-05:00', photo_id: 860, platforms: ['instagram'], status: 'approved' },
  ],
};
const NOW = '2026-11-15T15:30:00Z';

describe('variant preparation before hand-off (#5196/#5291)', () => {
  it('needs a variant only for due Instagram or Facebook posts, once per photo', () => {
    expect(photosNeedingVariant(queue, Date.parse(NOW))).toEqual([{ photoId: 864, postId: 'a' }, { photoId: 858, postId: 'c' }]);
  });

  it('dry run uploads nothing', async () => {
    const exec = () => { throw new Error('must not run'); };
    const r = await prepare({ NOW }, { queue, exec, fetch: () => { throw new Error('no fetch'); } });
    expect(r.mode).toBe('dry-run');
    expect(r.would_build).toEqual([
      { photo_id: 864, post_id: 'a', key: 'social-variants/instagram/864.jpg' },
      { photo_id: 858, post_id: 'c', key: 'social-variants/instagram/858.jpg' },
    ]);
  });

  it('apply builds from the original and uploads the variant; an existing variant is left alone', async () => {
    const calls = [];
    const env = { NOW, APPLY: 'true', B2_BUCKET: 'bkt', B2_ENDPOINT: 'https://s3.example', BASE_URL: 'https://site.test' };
    const exec = (cmd, args) => { calls.push(args.slice(0, 2).join(' ')); if (args[1] === 'head-object') throw new Error('404'); };
    const r = await prepare(env, {
      queue, exec, write: () => {},
      fetch: async (url) => { calls.push(url); return new Response(new Uint8Array([1, 2, 3])); },
      render: async () => ({ buffer: Buffer.from('x'), geometry: { frame: { width: 1080, height: 1350 }, padded: true } }),
    });
    expect(r.built).toEqual([
      { photo_id: 864, key: 'social-variants/instagram/864.jpg', frame: { width: 1080, height: 1350 }, padded: true },
      { photo_id: 858, key: 'social-variants/instagram/858.jpg', frame: { width: 1080, height: 1350 }, padded: true },
    ]);
    expect(calls).toContain('https://site.test/api/social/image/a');
    expect(calls).toContain('https://site.test/api/social/image/c');
    expect(calls).toContain('s3 cp');

    const existing = await prepare(env, { queue, exec: () => Buffer.from(''), fetch: () => { throw new Error('no fetch'); } });
    expect(existing.existing).toHaveLength(2);
    expect(existing.built).toHaveLength(0);
  });

  it('reports a failed original fetch and uploads nothing', async () => {
    const r = await prepare({ NOW, APPLY: 'true', B2_BUCKET: 'b', B2_ENDPOINT: 'e' }, {
      queue, exec: (c, a) => { if (a[1] === 'head-object') throw new Error('404'); throw new Error('no upload'); },
      fetch: async () => new Response('x', { status: 404 }),
    });
    expect(r.failed[0].error).toMatch(/original fetch 404/);
    expect(r.failed).toHaveLength(2);
    expect(r.built).toHaveLength(0);
  });
});
