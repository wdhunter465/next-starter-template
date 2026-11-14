#!/usr/bin/env node
/**
 * Platform variants of a social photo: fit the whole photo inside the platform's allowed frame and
 * fill the rest with one neutral background. Never crop, never distort (Product Authority,
 * 2026-11-12, #5196). The original is never changed. Output is deterministic for the same input.
 *
 * The geometry is pure and dependency-free so it can be tested everywhere. Pixels are produced by
 * `sharp`, loaded only when a variant is actually rendered (the posting job installs it).
 */

/** One neutral background for every platform: the paper tone of the cleared photos. */
export const PAD_BACKGROUND = '#f5f1e8';

/** Instagram publishing limits: ratio 4:5 to 1.91:1, JPEG, up to 8 MB, width 320 to 1440 px. */
export const INSTAGRAM = Object.freeze({
  minRatio: 4 / 5,
  maxRatio: 1.91,
  portrait: Object.freeze({ width: 1080, height: 1350 }),
  landscape: Object.freeze({ width: 1080, height: 566 }),
  maxBytes: 8 * 1024 * 1024,
  minWidth: 320,
  maxWidth: 1440,
});

function assertSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`invalid photo size ${width}x${height}`);
  }
}

/**
 * Geometry for the Instagram variant of a width x height photo.
 * A photo already inside 4:5 to 1.91:1 is only scaled to 1080 wide (no padding). A taller photo
 * is padded at the sides to 1080x1350; a wider one is padded above and below to 1080x566.
 * Returns the output frame, the scaled photo size and its offset in the frame.
 */
export function instagramGeometry(width, height) {
  assertSize(width, height);
  const ratio = width / height;
  if (ratio >= INSTAGRAM.minRatio && ratio <= INSTAGRAM.maxRatio) {
    const outW = INSTAGRAM.portrait.width;
    const outH = Math.ceil((outW * height) / width - 1e-9); // round up so 1.91:1 stays inside the limit
    return { frame: { width: outW, height: outH }, photo: { width: outW, height: outH }, offset: { left: 0, top: 0 }, padded: false };
  }
  const frame = ratio < INSTAGRAM.minRatio ? INSTAGRAM.portrait : INSTAGRAM.landscape;
  const scale = Math.min(frame.width / width, frame.height / height);
  const photoW = Math.min(frame.width, Math.max(1, Math.round(width * scale)));
  const photoH = Math.min(frame.height, Math.max(1, Math.round(height * scale)));
  return {
    frame: { width: frame.width, height: frame.height },
    photo: { width: photoW, height: photoH },
    offset: { left: Math.floor((frame.width - photoW) / 2), top: Math.floor((frame.height - photoH) / 2) },
    padded: true,
  };
}

/** True when the output frame meets every Instagram publishing limit that geometry can decide. */
export function instagramFrameOk(frame) {
  const ratio = frame.width / frame.height;
  return ratio >= INSTAGRAM.minRatio - 1e-9 && ratio <= INSTAGRAM.maxRatio + 1e-9
    && frame.width >= INSTAGRAM.minWidth && frame.width <= INSTAGRAM.maxWidth;
}

/** Renders the Instagram variant: a JPEG buffer. Needs `sharp`. */
export async function renderInstagramVariant(input, loadSharp = () => import('sharp')) {
  const sharp = (await loadSharp()).default;
  const meta = await sharp(input).rotate().metadata();
  const g = instagramGeometry(meta.width, meta.height);
  const resized = await sharp(input)
    .rotate()
    .resize(g.photo.width, g.photo.height, { fit: 'fill' })
    .toBuffer();
  let quality = 90;
  let out;
  do {
    out = await sharp({ create: { width: g.frame.width, height: g.frame.height, channels: 3, background: PAD_BACKGROUND } })
      .composite([{ input: resized, left: g.offset.left, top: g.offset.top }])
      .jpeg({ quality, mozjpeg: false })
      .toBuffer();
    quality -= 10;
  } while (out.length > INSTAGRAM.maxBytes && quality >= 40);
  if (out.length > INSTAGRAM.maxBytes) throw new Error('instagram variant exceeds 8 MB');
  return { buffer: out, geometry: g };
}

/** Object key of a variant in the bucket; the image route reads the same key. */
export const variantKey = (platform, photoId) => `social-variants/${platform}/${photoId}.jpg`;
