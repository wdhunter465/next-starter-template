// Screenshot detection for admin bulk photo upload (#4709).
// Pure classification only: no B2/D1 writes, no network I/O, no route wiring.
// Verdicts: 'deny' (strong clue, rejected at the door), 'check' (weak clue, stored for a person
// to keep or reject), 'ok'. Clues are heuristics, so a miss is possible; nothing is deleted.

import type { PhotoUploadDimensions, PhotoUploadImageFormat } from './photo-upload-validation';

export type ScreenshotVerdict = 'ok' | 'check' | 'deny';

export type ScreenshotClassification = {
  verdict: ScreenshotVerdict;
  reasons: string[];
};

export type ScreenshotDetectionInput = {
  fileName: string;
  format: PhotoUploadImageFormat;
  dimensions: PhotoUploadDimensions | null;
  bytes: Uint8Array;
};

const SCREENSHOT_NAME_PATTERN = /screen[\s_-]?shot|screen[\s_-]?capture|screen[\s_-]?grab|screen[\s_-]?recording/i;

// Portrait width x height of common phone, tablet and computer screens. Matched in either orientation.
const SCREEN_SIZES: ReadonlyArray<readonly [number, number]> = [
  // iPhone
  [750, 1334], [828, 1792], [1080, 1920], [1125, 2436], [1170, 2532], [1179, 2556], [1206, 2622],
  [1242, 2208], [1242, 2688], [1284, 2778], [1290, 2796], [1320, 2868],
  // Android
  [1080, 2340], [1080, 2400], [1440, 3040], [1440, 3200],
  // iPad
  [1536, 2048], [1620, 2160], [1640, 2360], [1668, 2388], [2048, 2732],
  // Mac and other computer displays
  [900, 1440], [1080, 1920], [1440, 2560], [1600, 2560], [1800, 2880], [1964, 3024], [2160, 3840],
  [2214, 3420], [2234, 3456], [2880, 5120],
];

function matchesScreenSize(dimensions: PhotoUploadDimensions | null): boolean {
  if (!dimensions) return false;
  const { width, height } = dimensions;
  return SCREEN_SIZES.some(([w, h]) => (width === w && height === h) || (width === h && height === w));
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length && offset + i < bytes.length; i++) out += String.fromCharCode(bytes[offset + i]);
  return out;
}

function u32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function u32LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;
}

function jpegHasExif(bytes: Uint8Array): boolean {
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === 0xda || marker === 0xd9) return false;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1 && ascii(bytes, i + 4, 6) === 'Exif\0\0') return true;
    if (length < 2) return false;
    i += 2 + length;
  }
  return false;
}

function pngHasExif(bytes: Uint8Array): boolean {
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = u32BE(bytes, i);
    const type = ascii(bytes, i + 4, 4);
    if (type === 'eXIf') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    i += 12 + length;
  }
  return false;
}

function webpHasExif(bytes: Uint8Array): boolean {
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i, 4);
    if (type === 'EXIF') return true;
    i += 8 + u32LE(bytes, i + 4) + (u32LE(bytes, i + 4) % 2);
  }
  return false;
}

// Camera data = an embedded EXIF block. Cameras and phones write one; screenshots do not.
export function hasCameraData(bytes: Uint8Array, format: PhotoUploadImageFormat): boolean {
  if (format === 'jpeg') return jpegHasExif(bytes);
  if (format === 'png') return pngHasExif(bytes);
  return webpHasExif(bytes);
}

export function classifyScreenshot(input: ScreenshotDetectionInput): ScreenshotClassification {
  const reasons: string[] = [];

  if (SCREENSHOT_NAME_PATTERN.test(input.fileName)) {
    return { verdict: 'deny', reasons: ['file name says screenshot'] };
  }

  const cameraData = hasCameraData(input.bytes, input.format);
  const screenSized = matchesScreenSize(input.dimensions);

  if (!cameraData && screenSized && input.format === 'png') {
    return { verdict: 'deny', reasons: ['PNG at an exact screen size with no camera data'] };
  }

  if (!cameraData && screenSized) reasons.push('exact screen size with no camera data');
  else if (!cameraData && input.format === 'png') reasons.push('PNG with no camera data');

  return { verdict: reasons.length > 0 ? 'check' : 'ok', reasons };
}
