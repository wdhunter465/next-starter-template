// Magic-bytes / file-signature validation for member photo intake (#3163, feeds #2857).
// Pure validation only: no B2/D1 writes, no network I/O, no route wiring.
// Design notes: docs/ops/reports/photo-upload-magic-bytes-validation-design-3163.md

export type PhotoUploadImageFormat = 'jpeg' | 'png' | 'webp';

export const PHOTO_UPLOAD_CANONICAL_MIME_TYPE: Record<PhotoUploadImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// #2857 Project Graduation decision: "Accept JPEG, PNG, and WebP only; maximum encoded upload size 10 MiB."
export const PHOTO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

// Sanity ceiling for claimed pixel dimensions. Real cameras/scans are well under this;
// this exists to fail closed on absurd/garbage dimension claims rather than to model a real limit.
export const PHOTO_UPLOAD_MAX_DIMENSION_PX = 20000;

const DECLARED_MIME_TO_FORMAT: Record<string, PhotoUploadImageFormat> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg', // non-standard but seen in the wild
  'image/png': 'png',
  'image/webp': 'webp',
};

export type PhotoUploadDimensions = { width: number; height: number };

export type PhotoUploadValidationOk = {
  ok: true;
  format: PhotoUploadImageFormat;
  mimeType: string;
  byteLength: number;
  // null only for the documented WebP VP8/VP8L-without-VP8X gap; see design notes.
  dimensions: PhotoUploadDimensions | null;
};

export type PhotoUploadRejectionCode =
  | 'empty_file'
  | 'file_too_large'
  | 'dangerous_signature'
  | 'unrecognized_signature'
  | 'unsupported_declared_type'
  | 'signature_type_mismatch'
  | 'truncated_file'
  | 'invalid_dimensions';

export type PhotoUploadValidationFailure = {
  ok: false;
  code: PhotoUploadRejectionCode;
  error: string;
};

export type PhotoUploadValidationResult = PhotoUploadValidationOk | PhotoUploadValidationFailure;

export type PhotoUploadValidationInput = {
  bytes: Uint8Array;
  // The client-declared Content-Type (or equivalent). Untrusted — used only for
  // cross-checking against the detected signature, never as the source of truth.
  declaredMimeType?: unknown;
};

function fail(code: PhotoUploadRejectionCode, error: string): PhotoUploadValidationFailure {
  return { ok: false, code, error };
}

function bytesStartWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[offset + i] !== prefix[i]) return false;
  }
  return true;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 8) | bytes[offset + 1]) >>> 0;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;
}

function readU24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)) >>> 0;
}

// --- Step 1: known-dangerous fixed-offset signatures ---------------------------------------

type DangerousSignature = { name: string; prefix: readonly number[] };

const DANGEROUS_PREFIX_SIGNATURES: readonly DangerousSignature[] = [
  { name: 'PDF document', prefix: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // "%PDF-"
  { name: 'Windows executable (MZ)', prefix: [0x4d, 0x5a] },
  { name: 'ELF executable', prefix: [0x7f, 0x45, 0x4c, 0x46] }, // 0x7F 'ELF'
  { name: 'ZIP/Office/APK/JAR archive', prefix: [0x50, 0x4b, 0x03, 0x04] }, // "PK\x03\x04"
  { name: 'ZIP archive (empty)', prefix: [0x50, 0x4b, 0x05, 0x06] }, // "PK\x05\x06"
];

function detectDangerousPrefixSignature(bytes: Uint8Array): string | null {
  for (const sig of DANGEROUS_PREFIX_SIGNATURES) {
    if (bytesStartWith(bytes, sig.prefix)) return sig.name;
  }
  return null;
}

// --- Step 2: textual polyglot markers (bounded prefix scan) --------------------------------

const TEXT_POLYGLOT_SCAN_WINDOW = 65536; // first 64 KiB
const TEXT_POLYGLOT_MARKERS: readonly string[] = ['<?php', '<%', '<script', '<svg', '<?xml', '<html'];

function containsTextPolyglotMarker(bytes: Uint8Array): string | null {
  const windowLength = Math.min(bytes.length, TEXT_POLYGLOT_SCAN_WINDOW);
  // Decode defensively; malformed UTF-8 in a real image prefix is expected and fine to ignore byte-for-byte.
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, windowLength)).toLowerCase();
  } catch {
    return null;
  }
  for (const marker of TEXT_POLYGLOT_MARKERS) {
    if (text.includes(marker)) return marker;
  }
  return null;
}

// --- Step 3: embedded archive polyglot (full-buffer scan for a 4-byte pattern) -------------

function containsEmbeddedZipLocalFileHeader(bytes: Uint8Array): boolean {
  const pattern = [0x50, 0x4b, 0x03, 0x04];
  if (bytes.length < pattern.length) return false;
  outer: for (let i = 0; i <= bytes.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (bytes[i + j] !== pattern[j]) continue outer;
    }
    return true;
  }
  return false;
}

// --- Step 4: allowlisted image signature detection ------------------------------------------

function detectImageFormat(bytes: Uint8Array): PhotoUploadImageFormat | null {
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (
    bytes.length >= 12 &&
    bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
    bytesStartWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) // "WEBP"
  ) {
    return 'webp';
  }
  return null;
}

// --- PNG dimension parsing --------------------------------------------------------------

function parsePngDimensions(bytes: Uint8Array): PhotoUploadDimensions | null {
  // 8-byte signature + 4-byte chunk length + 4-byte "IHDR" + 4-byte width + 4-byte height ...
  if (bytes.length < 24) return null;
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunkType !== 'IHDR') return null;
  const width = readU32BE(bytes, 16);
  const height = readU32BE(bytes, 20);
  return { width, height };
}

// --- JPEG dimension parsing (bounded marker scan) ----------------------------------------

const JPEG_SCAN_BOUND_BYTES = 262144; // 256 KiB — real SOF segments appear early; bound for safety/perf

function isJpegSofMarker(marker: number): boolean {
  // SOF0-SOF3, SOF5-SOF7, SOF9-SOF11, SOF13-SOF15 carry dimensions.
  // Excludes 0xC4 (DHT), 0xC8 (JPG reserved), 0xCC (DAC), which share the numeric range but aren't SOF.
  if (marker === 0xc4 || marker === 0xc8 || marker === 0xcc) return false;
  return marker >= 0xc0 && marker <= 0xcf;
}

function parseJpegDimensions(bytes: Uint8Array): PhotoUploadDimensions | null {
  const scanLimit = Math.min(bytes.length, JPEG_SCAN_BOUND_BYTES);
  let offset = 2; // skip SOI (0xFFD8), already verified by caller

  while (offset + 1 < scanLimit) {
    if (bytes[offset] !== 0xff) {
      offset += 1; // resync
      continue;
    }
    // Skip fill bytes (multiple 0xFF before the real marker byte).
    let markerOffset = offset + 1;
    while (markerOffset < scanLimit && bytes[markerOffset] === 0xff) {
      markerOffset += 1;
    }
    if (markerOffset >= scanLimit) break;
    const marker = bytes[markerOffset];

    // Markers with no length/payload: TEM (0x01), RSTn (0xD0-0xD7), EOI (0xD9).
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }
    if (marker === 0xd9) break; // EOI — stop

    // Every remaining marker has a 2-byte big-endian length (length field included).
    const lengthFieldOffset = markerOffset + 1;
    if (lengthFieldOffset + 1 >= scanLimit) break;
    const segmentLength = readU16BE(bytes, lengthFieldOffset);
    if (segmentLength < 2) break; // malformed — refuse to trust further parsing

    if (isJpegSofMarker(marker)) {
      const precisionOffset = lengthFieldOffset + 2;
      const heightOffset = precisionOffset + 1;
      const widthOffset = heightOffset + 2;
      if (widthOffset + 1 >= scanLimit) break; // truncated before dimensions are readable
      const height = readU16BE(bytes, heightOffset);
      const width = readU16BE(bytes, widthOffset);
      return { width, height };
    }

    if (marker === 0xda) break; // Start of Scan reached without finding SOF; entropy data follows

    offset = lengthFieldOffset + segmentLength;
  }

  return null;
}

// --- WebP dimension parsing (VP8X extended header only; see design notes for the gap) ----

function parseWebpVp8xDimensions(bytes: Uint8Array): PhotoUploadDimensions | null {
  // RIFF(4) + size(4) + "WEBP"(4) + FourCC(4) + chunkSize(4) = offset 20 for chunk payload.
  if (bytes.length < 30) return null;
  const fourCc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourCc !== 'VP8X') return null;
  // VP8X payload: 1 byte flags, 3 reserved, 3-byte width-1 (LE), 3-byte height-1 (LE).
  const width = readU24LE(bytes, 24) + 1;
  const height = readU24LE(bytes, 27) + 1;
  return { width, height };
}

function webpRiffSizeLooksTruncatedOrPolyglot(bytes: Uint8Array): boolean {
  // Declared RIFF size excludes the 8-byte "RIFF"+size header itself.
  const declaredSize = readU32LE(bytes, 4);
  const actualPayloadSize = bytes.length - 8;
  // Encoders may pad the final chunk to an even byte boundary, so allow a small tolerance.
  // A large positive gap (lots of unaccounted trailing bytes) is the polyglot-relevant signal.
  const unaccountedTrailingBytes = actualPayloadSize - declaredSize;
  return unaccountedTrailingBytes > 8;
}

function isValidDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= PHOTO_UPLOAD_MAX_DIMENSION_PX;
}

// --- Public API ------------------------------------------------------------------------

export function validatePhotoUpload(input: PhotoUploadValidationInput): PhotoUploadValidationResult {
  const { bytes } = input;

  if (!bytes || bytes.length === 0) {
    return fail('empty_file', 'Uploaded file is empty.');
  }
  if (bytes.length > PHOTO_UPLOAD_MAX_BYTES) {
    return fail('file_too_large', `File exceeds the ${PHOTO_UPLOAD_MAX_BYTES} byte limit.`);
  }

  const dangerousPrefix = detectDangerousPrefixSignature(bytes);
  if (dangerousPrefix) {
    return fail('dangerous_signature', `File signature matches a disallowed format: ${dangerousPrefix}.`);
  }

  const format = detectImageFormat(bytes);
  if (!format) {
    return fail('unrecognized_signature', 'File does not match a supported JPEG, PNG, or WebP signature.');
  }

  const declaredMimeType = input.declaredMimeType;
  if (typeof declaredMimeType === 'string' && declaredMimeType.trim().length > 0) {
    const normalized = declaredMimeType.trim().toLowerCase().split(';')[0].trim();
    const declaredFormat = DECLARED_MIME_TO_FORMAT[normalized];
    if (!declaredFormat) {
      return fail('unsupported_declared_type', `Declared content type "${normalized}" is not an accepted image type.`);
    }
    if (declaredFormat !== format) {
      return fail(
        'signature_type_mismatch',
        `Declared content type "${normalized}" does not match the file's actual ${format} signature.`,
      );
    }
  }

  const textPolyglotMarker = containsTextPolyglotMarker(bytes);
  if (textPolyglotMarker) {
    return fail('dangerous_signature', `File contains an embedded marker inconsistent with an image file: "${textPolyglotMarker}".`);
  }

  if (containsEmbeddedZipLocalFileHeader(bytes)) {
    return fail('dangerous_signature', 'File contains an embedded ZIP/archive structure (possible polyglot).');
  }

  let dimensions: PhotoUploadDimensions | null = null;

  if (format === 'png') {
    dimensions = parsePngDimensions(bytes);
    if (!dimensions) {
      return fail('truncated_file', 'PNG signature is valid but the IHDR chunk could not be read.');
    }
    if (!isValidDimension(dimensions.width) || !isValidDimension(dimensions.height)) {
      return fail('invalid_dimensions', `PNG dimensions ${dimensions.width}x${dimensions.height} are out of the accepted range.`);
    }
  } else if (format === 'jpeg') {
    dimensions = parseJpegDimensions(bytes);
    if (!dimensions) {
      return fail('truncated_file', 'JPEG signature is valid but no SOF (dimension) segment could be found.');
    }
    if (!isValidDimension(dimensions.width) || !isValidDimension(dimensions.height)) {
      return fail('invalid_dimensions', `JPEG dimensions ${dimensions.width}x${dimensions.height} are out of the accepted range.`);
    }
  } else if (format === 'webp') {
    if (webpRiffSizeLooksTruncatedOrPolyglot(bytes)) {
      return fail('truncated_file', 'WebP RIFF container size does not match the file length (truncated or trailing data).');
    }
    dimensions = parseWebpVp8xDimensions(bytes);
    // Documented gap: plain VP8/VP8L WebP (no VP8X chunk) is accepted with dimensions: null.
    // See docs/ops/reports/photo-upload-magic-bytes-validation-design-3163.md.
    if (dimensions && (!isValidDimension(dimensions.width) || !isValidDimension(dimensions.height))) {
      return fail('invalid_dimensions', `WebP dimensions ${dimensions.width}x${dimensions.height} are out of the accepted range.`);
    }
  }

  return {
    ok: true,
    format,
    mimeType: PHOTO_UPLOAD_CANONICAL_MIME_TYPE[format],
    byteLength: bytes.length,
    dimensions,
  };
}
