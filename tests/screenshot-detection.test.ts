// #4709: screenshot detection for admin bulk upload. Strong clues deny, weak clues go to a check list.

import { describe, expect, it } from 'vitest';
import { classifyScreenshot, hasCameraData } from '../functions/_lib/screenshot-detection';

const enc = (text: string) => Array.from(text).map((ch) => ch.charCodeAt(0));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function png({ exif = false }: { exif?: boolean } = {}): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, data: number[]) => [...u32(data.length), ...enc(type), ...data, 0, 0, 0, 0];
  return new Uint8Array([
    ...signature,
    ...chunk('IHDR', new Array(13).fill(0)),
    ...(exif ? chunk('eXIf', [1, 2, 3, 4]) : []),
    ...chunk('IDAT', [0]),
    ...chunk('IEND', []),
  ]);
}

function jpeg({ exif = false }: { exif?: boolean } = {}): Uint8Array {
  const app1 = exif ? [0xff, 0xe1, 0x00, 0x08, ...enc('Exif'), 0, 0] : [];
  return new Uint8Array([0xff, 0xd8, ...app1, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
}

describe('screenshot detection', () => {
  it('denies a file whose name says screenshot, whatever else is true', () => {
    for (const fileName of ['Screenshot 2026-10-19 at 9.00.00 AM.png', 'Screen Shot 2024.png', 'IMG_screen_capture.jpg']) {
      const result = classifyScreenshot({ fileName, format: 'jpeg', dimensions: { width: 4032, height: 3024 }, bytes: jpeg({ exif: true }) });
      expect(result.verdict).toBe('deny');
    }
  });

  it('denies a PNG at an exact phone screen size with no camera data', () => {
    const result = classifyScreenshot({ fileName: 'IMG_0001.PNG', format: 'png', dimensions: { width: 1170, height: 2532 }, bytes: png() });
    expect(result.verdict).toBe('deny');
  });

  it('matches screen sizes in either orientation', () => {
    const result = classifyScreenshot({ fileName: 'a.png', format: 'png', dimensions: { width: 2532, height: 1170 }, bytes: png() });
    expect(result.verdict).toBe('deny');
  });

  it('keeps a real camera photo even at a screen-like size', () => {
    const result = classifyScreenshot({ fileName: 'IMG_0002.jpg', format: 'jpeg', dimensions: { width: 1080, height: 1920 }, bytes: jpeg({ exif: true }) });
    expect(result.verdict).toBe('ok');
  });

  it('sends a PNG with no camera data and an ordinary size to the check list, not the bin', () => {
    const result = classifyScreenshot({ fileName: 'scan_front.png', format: 'png', dimensions: { width: 3000, height: 2000 }, bytes: png() });
    expect(result.verdict).toBe('check');
    expect(result.reasons).toContain('PNG with no camera data');
  });

  it('sends a JPEG at an exact screen size with no camera data to the check list', () => {
    const result = classifyScreenshot({ fileName: 'x.jpg', format: 'jpeg', dimensions: { width: 1179, height: 2556 }, bytes: jpeg() });
    expect(result.verdict).toBe('check');
  });

  it('passes an ordinary JPEG with no camera data (scans and edits strip it)', () => {
    const result = classifyScreenshot({ fileName: 'card_scan.jpg', format: 'jpeg', dimensions: { width: 2400, height: 3300 }, bytes: jpeg() });
    expect(result.verdict).toBe('ok');
  });

  it('reads camera data from JPEG and PNG, and finds none when absent', () => {
    expect(hasCameraData(jpeg({ exif: true }), 'jpeg')).toBe(true);
    expect(hasCameraData(jpeg(), 'jpeg')).toBe(false);
    expect(hasCameraData(png({ exif: true }), 'png')).toBe(true);
    expect(hasCameraData(png(), 'png')).toBe(false);
  });

  it('does not throw on a truncated or empty file', () => {
    expect(() => hasCameraData(new Uint8Array([0xff, 0xd8]), 'jpeg')).not.toThrow();
    expect(() => hasCameraData(new Uint8Array([0x89, 0x50]), 'png')).not.toThrow();
    expect(() => hasCameraData(new Uint8Array(), 'webp')).not.toThrow();
  });
});
