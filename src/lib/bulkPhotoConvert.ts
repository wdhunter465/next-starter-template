/**
 * Browser-side conversion for admin bulk photo upload (#5526).
 *
 * Every photo is re-encoded as JPEG and its long edge capped before upload, so scans pass the
 * 10 MiB limit and the header checks, and storage on B2 stays small. The screenshot checks must see
 * the file as the person picked it, so the facts about the original are read first and sent along.
 */

export type OriginalFormat = 'jpeg' | 'png' | 'webp';

export const MAX_LONG_EDGE_PX = 4000;
export const JPEG_QUALITY = 0.9;

export type OriginalFacts = {
  name: string;
  format: OriginalFormat;
  width: number;
  height: number;
  bytes: number;
  /** True when the file carries an embedded EXIF block (cameras and phones write one). */
  cameraData: boolean;
};

export type ConvertedPhoto = {
  file: File;
  original: OriginalFacts;
  resized: boolean;
};

/** Target size with the long edge at most `maxEdge`; never enlarges. */
export function targetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_LONG_EDGE_PX,
): { width: number; height: number; resized: boolean } {
  const long = Math.max(width, height);
  if (!(long > maxEdge)) return { width, height, resized: false };
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
}

/** `photo.PNG` becomes `photo.jpg`; names with no extension get `.jpg`. */
export function jpegFileName(name: string): string {
  const trimmed = name.trim() || 'photo';
  const dot = trimmed.lastIndexOf('.');
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  return `${base}.jpg`;
}

export function originalFormatOf(file: { name: string; type: string }): OriginalFormat | null {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpeg') return 'jpeg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (/\.jpe?g$/i.test(file.name)) return 'jpeg';
  if (/\.png$/i.test(file.name)) return 'png';
  if (/\.webp$/i.test(file.name)) return 'webp';
  return null;
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

/**
 * Same rule as the server's `hasCameraData` (functions/_lib/screenshot-detection.ts): an embedded
 * EXIF block. `head` only needs the first few hundred KiB of the file.
 */
export function hasCameraData(head: Uint8Array, format: OriginalFormat): boolean {
  if (format === 'jpeg') {
    let i = 2;
    while (i + 4 <= head.length && head[i] === 0xff) {
      const marker = head[i + 1];
      if (marker === 0xda || marker === 0xd9) return false;
      const length = (head[i + 2] << 8) | head[i + 3];
      if (marker === 0xe1 && ascii(head, i + 4, 6) === 'Exif\0\0') return true;
      if (length < 2) return false;
      i += 2 + length;
    }
    return false;
  }
  if (format === 'png') {
    let i = 8;
    while (i + 8 <= head.length) {
      const length = u32BE(head, i);
      const type = ascii(head, i + 4, 4);
      if (type === 'eXIf') return true;
      if (type === 'IDAT' || type === 'IEND') return false;
      i += 12 + length;
    }
    return false;
  }
  let i = 12;
  while (i + 8 <= head.length) {
    const type = ascii(head, i, 4);
    if (type === 'EXIF') return true;
    const size = u32LE(head, i + 4);
    i += 8 + size + (size % 2);
  }
  return false;
}

const HEAD_BYTES = 512 * 1024;

export async function readCameraData(file: File, format: OriginalFormat): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
    return hasCameraData(head, format);
  } catch {
    return false;
  }
}

/**
 * Decode, cap the long edge, flatten onto white, and re-encode as JPEG.
 * Throws an Error with a plain message when the browser cannot decode or encode the file.
 */
export async function convertToJpeg(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<ConvertedPhoto> {
  const format = originalFormatOf(file);
  if (!format) throw new Error('Not a JPEG, PNG or WebP file.');
  const maxEdge = options.maxEdge ?? MAX_LONG_EDGE_PX;
  const quality = options.quality ?? JPEG_QUALITY;

  const cameraData = await readCameraData(file, format);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This browser could not read the image.');
  }

  try {
    const size = targetSize(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser could not prepare the image.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    // Release the canvas memory on large scans.
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || blob.size === 0) throw new Error('This browser could not encode the JPEG.');

    return {
      file: new File([blob], jpegFileName(file.name), { type: 'image/jpeg', lastModified: file.lastModified }),
      original: {
        name: file.name,
        format,
        width: bitmap.width,
        height: bitmap.height,
        bytes: file.size,
        cameraData,
      },
      resized: size.resized,
    };
  } finally {
    bitmap.close();
  }
}
