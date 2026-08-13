import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
  PHOTO_UPLOAD_MAX_BYTES,
  PHOTO_UPLOAD_MAX_DIMENSION_PX,
  validatePhotoUpload,
} from '../functions/_lib/photo-upload-validation';

// ---------------------------------------------------------------------------
// Fixture builders. These construct genuinely spec-correct bytes (not hand-
// picked magic numbers) so the tests exercise the same structural rules real
// files follow, rather than only the constants the validator itself uses.
// ---------------------------------------------------------------------------

function asciiBytes(value: string): number[] {
  return Array.from(value).map((c) => c.charCodeAt(0));
}

function concatBytes(chunks: number[][]): Uint8Array {
  return new Uint8Array(chunks.flat());
}

// --- PNG -------------------------------------------------------------------

function makeCrcTable(): number[] {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function buildPngChunk(type: string, data: number[]): number[] {
  const typeBytes = asciiBytes(type);
  const crcInput = new Uint8Array([...typeBytes, ...data]);
  const crc = crc32(crcInput);
  return [...u32be(data.length), ...typeBytes, ...data, ...u32be(crc)];
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Builds a genuinely valid, real PNG (a real viewer would decode it). */
function buildRealPng(width: number, height: number): Uint8Array {
  const ihdrData = [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]; // 8-bit RGBA, no interlace
  const ihdr = buildPngChunk('IHDR', ihdrData);

  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type: none
    for (let x = 0; x < width * 4; x++) raw.push(0);
  }
  const compressed = Array.from(deflateSync(Buffer.from(raw)));
  const idat = buildPngChunk('IDAT', compressed);
  const iend = buildPngChunk('IEND', []);

  return concatBytes([PNG_SIGNATURE, ihdr, idat, iend]);
}

/** Builds only the PNG signature + IHDR header (no IDAT/IEND) for truncation tests. */
function buildPngHeaderOnly(width: number, height: number): Uint8Array {
  const ihdrData = [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0];
  const ihdr = buildPngChunk('IHDR', ihdrData);
  return concatBytes([PNG_SIGNATURE, ihdr]);
}

// --- JPEG --------------------------------------------------------------------

function jpegSegment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2; // length field includes itself
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

/** Builds a structurally valid JPEG marker stream (SOI, APP0/JFIF, SOF0, EOI). */
function buildJpeg(width: number, height: number, options: { includeSof?: boolean } = {}): Uint8Array {
  const { includeSof = true } = options;
  const soi = [0xff, 0xd8];
  const app0Payload = [...asciiBytes('JFIF'), 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const app0 = jpegSegment(0xe0, app0Payload);
  const parts = [soi, app0];

  if (includeSof) {
    const sof0Payload = [
      8, // precision
      (height >> 8) & 0xff,
      height & 0xff,
      (width >> 8) & 0xff,
      width & 0xff,
      1, // number of components
      1,
      0x11,
      0x00, // component 1 spec
    ];
    parts.push(jpegSegment(0xc0, sof0Payload));
  }

  parts.push([0xff, 0xd9]); // EOI
  return concatBytes(parts);
}

// --- WebP --------------------------------------------------------------------

function u32le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function u24le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];
}

function riffChunk(fourCc: string, payload: number[]): number[] {
  const bytes = [...asciiBytes(fourCc), ...u32le(payload.length), ...payload];
  if (payload.length % 2 === 1) bytes.push(0x00); // RIFF chunks pad to even length
  return bytes;
}

function buildWebp(chunk: number[]): Uint8Array {
  const body = [...asciiBytes('WEBP'), ...chunk];
  const riffSize = body.length;
  return concatBytes([asciiBytes('RIFF'), u32le(riffSize), body]);
}

/** Plain lossy WebP with no VP8X extended header — dimensions are not parsed (documented gap). */
function buildWebpPlainVp8(): Uint8Array {
  return buildWebp(riffChunk('VP8 ', [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a]));
}

/** Extended-header WebP with an explicit canvas width/height. */
function buildWebpVp8x(width: number, height: number): Uint8Array {
  const w1 = width - 1;
  const h1 = height - 1;
  const payload = [0x00, 0x00, 0x00, 0x00, ...u24le(w1), ...u24le(h1)]; // flags + reserved(3) + w-1(3) + h-1(3)
  return buildWebp(riffChunk('VP8X', payload));
}

/** WebP with a declared RIFF size that doesn't account for a large trailing blob. */
function buildWebpWithTrailingGarbage(): Uint8Array {
  const valid = buildWebpVp8x(4, 4);
  const garbage = new Uint8Array(4096).fill(0x41);
  const combined = new Uint8Array(valid.length + garbage.length);
  combined.set(valid, 0);
  combined.set(garbage, valid.length);
  return combined;
}

// ---------------------------------------------------------------------------

describe('validatePhotoUpload', () => {
  describe('basic input guards', () => {
    it('rejects an empty file', () => {
      const result = validatePhotoUpload({ bytes: new Uint8Array(0) });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('empty_file');
    });

    it('rejects a file over the size ceiling', () => {
      const oversized = new Uint8Array(PHOTO_UPLOAD_MAX_BYTES + 1);
      const result = validatePhotoUpload({ bytes: oversized });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('file_too_large');
    });

    it('accepts a file exactly at the size ceiling (given a valid signature)', () => {
      const png = buildRealPng(1, 1);
      const padded = new Uint8Array(PHOTO_UPLOAD_MAX_BYTES);
      padded.set(png, 0);
      // Padding with trailing zero bytes after IEND is unusual but must not itself trigger
      // the truncation/polyglot heuristics; this just proves the boundary is inclusive.
      const result = validatePhotoUpload({ bytes: padded });
      expect(result.ok).toBe(true);
    });
  });

  describe('valid images are accepted', () => {
    it('accepts a real, fully valid PNG and reports correct dimensions', () => {
      const bytes = buildRealPng(3, 2);
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'image/png' });
      expect(result).toMatchObject({ ok: true, format: 'png', mimeType: 'image/png', dimensions: { width: 3, height: 2 } });
    });

    it('accepts a valid JPEG and reports correct dimensions', () => {
      const bytes = buildJpeg(800, 600);
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'image/jpeg' });
      expect(result).toMatchObject({ ok: true, format: 'jpeg', mimeType: 'image/jpeg', dimensions: { width: 800, height: 600 } });
    });

    it('accepts a valid WebP with a VP8X extended header and reports correct dimensions', () => {
      const bytes = buildWebpVp8x(640, 480);
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'image/webp' });
      expect(result).toMatchObject({ ok: true, format: 'webp', mimeType: 'image/webp', dimensions: { width: 640, height: 480 } });
    });

    it('accepts a plain (non-VP8X) WebP with dimensions:null — documented parsing gap', () => {
      const bytes = buildWebpPlainVp8();
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'image/webp' });
      expect(result.ok).toBe(true);
      expect(result.ok && result.dimensions).toBeNull();
    });

    it('accepts a valid image with no declared MIME type at all (signature-only check)', () => {
      const bytes = buildRealPng(2, 2);
      const result = validatePhotoUpload({ bytes });
      expect(result.ok).toBe(true);
    });

    it('accepts image/jpg as a non-standard but recognized alias for JPEG', () => {
      const bytes = buildJpeg(10, 10);
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'image/jpg' });
      expect(result.ok).toBe(true);
    });
  });

  describe('declared MIME type cross-check', () => {
    it('rejects a PNG uploaded with a declared type of image/jpeg (renamed-extension mismatch)', () => {
      const bytes = buildRealPng(2, 2);
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'image/jpeg' });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('signature_type_mismatch');
    });

    it('rejects a declared type that is not one of the accepted image types', () => {
      const bytes = buildRealPng(2, 2);
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'application/pdf' });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('unsupported_declared_type');
    });

    it('is tolerant of charset parameters on the declared type', () => {
      const bytes = buildRealPng(2, 2);
      const result = validatePhotoUpload({ bytes, declaredMimeType: 'image/png; charset=binary' });
      expect(result.ok).toBe(true);
    });
  });

  describe('dangerous / disallowed signatures', () => {
    it('rejects an SVG (text-based) file', () => {
      const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const result = validatePhotoUpload({ bytes: svg });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('unrecognized_signature');
    });

    it('rejects a PDF disguised with an image declared type', () => {
      const pdf = new TextEncoder().encode('%PDF-1.4\n%âãÏÓ\n1 0 obj');
      const result = validatePhotoUpload({ bytes: pdf, declaredMimeType: 'image/jpeg' });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('dangerous_signature');
    });

    it('rejects a Windows executable (MZ header)', () => {
      const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const result = validatePhotoUpload({ bytes: exe });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('dangerous_signature');
    });

    it('rejects an ELF executable', () => {
      const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const result = validatePhotoUpload({ bytes: elf });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('dangerous_signature');
    });

    it('rejects a valid JPEG with an embedded ZIP local-file-header polyglot appended', () => {
      const jpeg = Array.from(buildJpeg(10, 10));
      const zipHeader = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00];
      const polyglot = new Uint8Array([...jpeg, ...zipHeader]);
      const result = validatePhotoUpload({ bytes: polyglot });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('dangerous_signature');
    });

    it('rejects a valid JPEG with an embedded <script> marker appended', () => {
      const jpeg = Array.from(buildJpeg(10, 10));
      const script = asciiBytes('<script>alert(document.cookie)</script>');
      const polyglot = new Uint8Array([...jpeg, ...script]);
      const result = validatePhotoUpload({ bytes: polyglot });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('dangerous_signature');
    });

    it('rejects a valid JPEG with an embedded <?php marker appended', () => {
      const jpeg = Array.from(buildJpeg(10, 10));
      const php = asciiBytes('<?php system($_GET["c"]); ?>');
      const polyglot = new Uint8Array([...jpeg, ...php]);
      const result = validatePhotoUpload({ bytes: polyglot });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('dangerous_signature');
    });
  });

  describe('truncated / corrupted files', () => {
    it('rejects a PNG signature with a truncated/missing IHDR chunk', () => {
      const truncated = new Uint8Array(PNG_SIGNATURE); // signature only, nothing else
      const result = validatePhotoUpload({ bytes: truncated });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('truncated_file');
    });

    it('rejects a JPEG with no SOF segment at all', () => {
      const bytes = buildJpeg(10, 10, { includeSof: false });
      const result = validatePhotoUpload({ bytes });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('truncated_file');
    });

    it('rejects a JPEG cut off mid-header before SOF is reachable', () => {
      const full = buildJpeg(10, 10);
      const cut = full.slice(0, 6); // SOI + start of APP0, nothing further
      const result = validatePhotoUpload({ bytes: cut });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('truncated_file');
    });

    it('rejects a WebP whose RIFF size does not account for a large trailing blob', () => {
      const bytes = buildWebpWithTrailingGarbage();
      const result = validatePhotoUpload({ bytes });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('truncated_file');
    });
  });

  describe('dimension bounds', () => {
    it('rejects a PNG that declares a zero dimension', () => {
      const bytes = buildPngHeaderOnly(0, 10);
      const result = validatePhotoUpload({ bytes });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('invalid_dimensions');
    });

    it('rejects a PNG that declares an absurdly large dimension', () => {
      const bytes = buildPngHeaderOnly(PHOTO_UPLOAD_MAX_DIMENSION_PX + 1, 10);
      const result = validatePhotoUpload({ bytes });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('invalid_dimensions');
    });

    it('rejects a WebP (VP8X) that declares an absurdly large dimension', () => {
      const bytes = buildWebpVp8x(PHOTO_UPLOAD_MAX_DIMENSION_PX + 1, 10);
      const result = validatePhotoUpload({ bytes });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('invalid_dimensions');
    });

    it('accepts a dimension exactly at the ceiling', () => {
      const bytes = buildPngHeaderOnly(PHOTO_UPLOAD_MAX_DIMENSION_PX, 1);
      const result = validatePhotoUpload({ bytes });
      // Header-only fixture has no IDAT/IEND, which is fine — dimension parsing only reads IHDR.
      expect(result.ok).toBe(true);
    });
  });

  describe('unrecognized formats', () => {
    it('rejects a plain text file', () => {
      const text = new TextEncoder().encode('just some plain text, not an image');
      const result = validatePhotoUpload({ bytes: text });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('unrecognized_signature');
    });

    it('rejects a GIF (not in the accepted format list)', () => {
      const gif = new TextEncoder().encode('GIF89a');
      const result = validatePhotoUpload({ bytes: gif });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.code).toBe('unrecognized_signature');
    });
  });
});
