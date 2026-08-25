import { Jimp } from 'jimp';
import { describe, expect, it } from 'vitest';

import { computePerceptualHash, hammingDistanceHex } from '../functions/_lib/perceptual-hash';

async function makeGradientPng(width: number, height: number): Promise<Uint8Array> {
  const image = new Jimp({ width, height, color: 0x000000ff });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = Math.round((x / (width - 1)) * 255);
      image.setPixelColor(((value << 24) | (value << 16) | (value << 8) | 0xff) >>> 0, x, y);
    }
  }
  return image.getBuffer('image/png');
}

async function makeSolidPng(width: number, height: number, grey: number): Promise<Uint8Array> {
  const color = ((grey << 24) | (grey << 16) | (grey << 8) | 0xff) >>> 0;
  const image = new Jimp({ width, height, color });
  return image.getBuffer('image/png');
}

describe('computePerceptualHash / hammingDistanceHex (#3552 phase 4)', () => {
  it('produces a 16-hex-character (64-bit) hash', async () => {
    const bytes = await makeGradientPng(200, 150);
    const hash = await computePerceptualHash(bytes);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('gives identical images a Hamming distance of 0', async () => {
    const bytes = await makeGradientPng(200, 150);
    const hashA = await computePerceptualHash(bytes);
    const hashB = await computePerceptualHash(bytes);
    expect(hammingDistanceHex(hashA, hashB)).toBe(0);
  });

  it('gives the same image re-encoded at a different size/quality a small distance', async () => {
    const original = await makeGradientPng(400, 300);
    const resized = await makeGradientPng(120, 90); // same gradient, different resolution
    const hashA = await computePerceptualHash(original);
    const hashB = await computePerceptualHash(resized);
    expect(hammingDistanceHex(hashA, hashB)).toBeLessThanOrEqual(4);
  });

  it('gives visually distinct images a large distance', async () => {
    const gradient = await makeGradientPng(200, 150);
    const blackImage = await makeSolidPng(200, 150, 0);
    const hashA = await computePerceptualHash(gradient);
    const hashB = await computePerceptualHash(blackImage);
    expect(hammingDistanceHex(hashA, hashB)).toBeGreaterThan(20);
  });

  it('hammingDistanceHex is symmetric', () => {
    expect(hammingDistanceHex('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hammingDistanceHex('ffffffffffffffff', '0000000000000000')).toBe(64);
    expect(hammingDistanceHex('abcdef0123456789', 'abcdef0123456789')).toBe(0);
  });
});
