import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  audit,
  buildReport,
  extensionOf,
  listObjects,
  parseDimensions,
  prefixOf,
  renderMarkdown,
  sizeBucket,
} from '../scripts/ops/b2-inventory-audit.mjs';

const MiB = 1024 * 1024;

function png(width, height) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width, height) {
  // SOI, APP0 (JFIF, 16 bytes), then SOF0 with the size.
  const b = new Uint8Array(2 + 18 + 19 + 4);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 0);
  const sof = 20;
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 3], sof);
  return b;
}

function webpVp8x(width, height) {
  const b = new Uint8Array(40);
  b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
  b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
  b.set([...'VP8X'].map((c) => c.charCodeAt(0)), 12);
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return b;
}

function webpVp8l(width, height) {
  const b = new Uint8Array(40);
  b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
  b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
  b.set([...'VP8L'].map((c) => c.charCodeAt(0)), 12);
  b[20] = 0x2f;
  const bits = (width - 1) | ((height - 1) << 14);
  b.set([bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff], 21);
  return b;
}

describe('b2 inventory audit helpers (#5537)', () => {
  it('reads extension and prefix', () => {
    expect(extensionOf('bulk/b1/abc.JPG')).toBe('jpg');
    expect(extensionOf('a/b.c/noext')).toBe('');
    expect(extensionOf('x.tar.png')).toBe('png');
    expect(prefixOf('bulk/b1/abc.jpg')).toBe('bulk');
    expect(prefixOf('loose.jpg')).toBe('(root)');
  });

  it('buckets sizes', () => {
    expect(sizeBucket(100 * 1024)).toBe('< 0.25 MB');
    expect(sizeBucket(2 * MiB)).toBe('1 to 3 MB');
    expect(sizeBucket(10 * MiB)).toBe('6 to 10 MB');
    expect(sizeBucket(10 * MiB + 1)).toBe('> 10 MB');
  });

  it('parses pixel sizes from the first bytes of PNG, JPEG and WebP', () => {
    expect(parseDimensions(png(5000, 3000))).toEqual({ format: 'png', width: 5000, height: 3000 });
    expect(parseDimensions(jpeg(6000, 4000))).toEqual({ format: 'jpeg', width: 6000, height: 4000 });
    expect(parseDimensions(webpVp8x(4500, 2500))).toEqual({ format: 'webp', width: 4500, height: 2500 });
    expect(parseDimensions(webpVp8l(5000, 3000))).toEqual({ format: 'webp', width: 5000, height: 3000 });
    expect(parseDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(parseDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xda]))).toBeNull();
  });
});

describe('b2 inventory audit report (#5537)', () => {
  const objects = [
    { key: 'bulk/b1/a.jpg', size: 2 * MiB },
    { key: 'bulk/b1/b.png', size: 3 * MiB },
    { key: 'scans/big.jpg', size: 12 * MiB },
    { key: 'scans/maybe.jpeg', size: 7 * MiB },
    { key: 'scans/wide.jpg', size: 2 * MiB },
    { key: 'club-newspaper/originals/9401/original.jpg', size: 4 * MiB },
    { key: 'docs/readme.txt', size: 10 },
  ];
  const dims = new Map([
    ['scans/wide.jpg', { width: 6000, height: 3000, format: 'jpeg' }],
    ['bulk/b1/a.jpg', { width: 4000, height: 3000, format: 'jpeg' }],
  ]);
  const report = buildReport(objects, dims, { generatedAt: '2026-11-26T00:00:00Z', bucket: 'b' });

  it('flags non-JPEG images, files over the limit, probably-not-resized files and long edges', () => {
    expect(report.totals.objects).toBe(7);
    expect(report.totals.images).toBe(6);
    expect(report.non_jpeg_images.map((r) => r.key)).toEqual(['bulk/b1/b.png']);
    expect(report.over_upload_limit.map((r) => r.key)).toEqual(['scans/big.jpg']);
    expect(report.likely_not_resized.map((r) => r.key)).toEqual(['scans/maybe.jpeg']);
    expect(report.over_long_edge.map((r) => r.key)).toEqual(['scans/wide.jpg']);
    expect(report.non_image_extensions).toEqual({ txt: 1 });
    expect(report.by_extension.jpg).toBe(4);
  });

  it('a 4000 px long edge is within the standard', () => {
    expect(report.over_long_edge.some((r) => r.key === 'bulk/b1/a.jpg')).toBe(false);
  });

  it('lists the largest images first and renders markdown', () => {
    expect(report.largest[0].key).toBe('scans/big.jpg');
    const md = renderMarkdown(report);
    expect(md).toContain('Non-JPEG images: 1');
    expect(md).toContain('`scans/wide.jpg` (6000 x 3000');
    expect(md).toContain('read-only');
  });
});

describe('b2 inventory audit run with a fake aws (#5537)', () => {
  const listing = (n, start) =>
    Array.from({ length: n }, (_, i) => ({ Key: `p/${start + i}.jpg`, Size: (start + i + 1) * 1000 }));

  it('follows pagination', () => {
    const calls = [];
    const exec = (cmd, args) => {
      calls.push(args);
      const hasToken = args.includes('--continuation-token');
      return JSON.stringify(
        hasToken
          ? { Contents: listing(2, 3), IsTruncated: false }
          : { Contents: listing(3, 0), IsTruncated: true, NextContinuationToken: 'tok' },
      );
    };
    const objects = listObjects({ endpoint: 'https://s3.us-west-004.backblazeb2.com', bucket: 'b', exec });
    expect(objects).toHaveLength(5);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('tok');
  });

  it('reads heads only for the largest candidates, within the cap, and only reads (no writes)', async () => {
    const getObjectKeys = [];
    const exec = (cmd, args) => {
      expect(cmd).toBe('aws');
      expect(args[0]).toBe('s3api');
      if (args[1] === 'list-objects-v2') {
        return JSON.stringify({
          Contents: [
            { Key: 'a/small.jpg', Size: 1000 },
            { Key: 'a/huge.jpg', Size: 9 * MiB },
            { Key: 'a/mid.png', Size: 3 * MiB },
            { Key: 'a/notes.txt', Size: 5 },
          ],
          IsTruncated: false,
        });
      }
      expect(args[1]).toBe('get-object');
      expect(args).toContain('--range');
      const key = args[args.indexOf('--key') + 1];
      getObjectKeys.push(key);
      writeFileSync(args[args.length - 1], key === 'a/huge.jpg' ? jpeg(7000, 5000) : png(3000, 2000));
      return '{}';
    };
    const report = await audit({ endpoint: 'https://s3.us-west-004.backblazeb2.com', bucket: 'b', dimensionReads: 2, exec });
    expect(getObjectKeys).toEqual(['a/huge.jpg', 'a/mid.png']);
    expect(report.totals.dimensions_read).toBe(2);
    expect(report.over_long_edge.map((r) => r.key)).toEqual(['a/huge.jpg']);
  });

  it('dimensionReads 0 makes no downloads', async () => {
    const exec = (cmd, args) => {
      expect(args[1]).toBe('list-objects-v2');
      return JSON.stringify({ Contents: [{ Key: 'a/x.jpg', Size: 5 }], IsTruncated: false });
    };
    const report = await audit({ endpoint: 'https://s3.us-west-004.backblazeb2.com', bucket: 'b', dimensionReads: 0, exec });
    expect(report.totals.dimensions_read).toBe(0);
  });
});
