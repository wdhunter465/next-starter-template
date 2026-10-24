/**
 * Pure decisions for the archive ingest (#4859): which file to fetch for an
 * archived candidate, and whether it is good enough to keep. No network, no
 * database, so every rule is unit-tested.
 */

import { isDeniedImageHost } from './gehrig-copy-quality.mjs';

export const ARCHIVE_HOLD_REASON = 'archived pending written permission (Product Authority 2026-10-24, #4839)';
export const ARCHIVE_NOTE_MARKER = 'archive-ingest:';

const KEEP_MIME_TYPES = ['image/jpeg', 'image/png', 'image/tiff'];

// Wording that marks a copy as watermarked or as an agency/stock image. The
// source's own metadata is the only signal available before download, so a hit
// skips the item. Pixel-level detection is not attempted.
const WATERMARK_OR_AGENCY_PATTERN =
  /watermark|getty\s*images|gettyimages|shutterstock|alamy|adobe\s*stock|istock|dreamstime|depositphotos|bridgeman|age\s*fotostock|corbis/i;

export function textSuggestsWatermark(...parts) {
  return WATERMARK_OR_AGENCY_PATTERN.test(parts.filter(Boolean).map(String).join(' '));
}

// Website rendition long edges (#3419 contract) and the newspaper floor (#4861).
export const SIZE_EDGE_PX = { thumbnail: 320, small: 640, medium: 1280, large: 1920 };
export const NEWSPAPER_MIN_LONG_SIDE_PX = 800;

const NEWSPAPER_PATTERN = /newspaper|halftone|half-tone|newsprint|press clipping|clipping/i;

/** 'newspaper' when the source's own wording says the picture was printed in a newspaper, else 'photograph'. */
export function pictureKind(...parts) {
  return NEWSPAPER_PATTERN.test(parts.filter(Boolean).map(String).join(' ')) ? 'newspaper' : 'photograph';
}

/** The minimum long side for a picture of this kind. */
export function minimumLongSideFor(kind, photographMinimum) {
  return kind === 'newspaper' ? Math.min(NEWSPAPER_MIN_LONG_SIDE_PX, photographMinimum) : photographMinimum;
}

/**
 * Which standard sizes a master supports without upscaling (#4861). Newspaper
 * halftone scans are never offered at the large size or on social posts, however
 * many pixels they have. Unknown dimensions block publication.
 */
export function assessPictureQuality({ width, height, kind = 'photograph' }) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const side = longSideOf(w, h);
  const newspaper = kind === 'newspaper';
  const ok = {
    thumbnail: side >= SIZE_EDGE_PX.thumbnail,
    small: side >= SIZE_EDGE_PX.small,
    medium: side >= SIZE_EDGE_PX.medium,
    large: !newspaper && side >= SIZE_EDGE_PX.large,
    socialLink: !newspaper && w >= 1200 && h >= 630,
    socialSquare: !newspaper && Math.min(w, h) >= 1080,
  };
  let publishBlocked = false;
  let publishBlockReason = null;
  if (side === 0) {
    publishBlocked = true;
    publishBlockReason = 'pixel size could not be read, so no size could be verified';
  } else if (!ok.small) {
    publishBlocked = true;
    publishBlockReason = `long side ${side}px is too small for even the small (${SIZE_EDGE_PX.small}px) size`;
  }
  return { tier: kind, widthPx: w || null, heightPx: h || null, ok, publishBlocked, publishBlockReason };
}

export function longSideOf(width, height) {
  const w = Number(width);
  const h = Number(height);
  return Math.max(Number.isFinite(w) ? w : 0, Number.isFinite(h) ? h : 0);
}

/** loc.gov item JSON: true for photograph, print and drawing records, false for newspapers and the rest. */
export function locItemIsPicture(data) {
  const item = data?.item ?? {};
  const formats = JSON.stringify(item.original_format ?? item.format ?? data?.original_format ?? '').toLowerCase();
  if (formats.includes('newspaper')) return false;
  return /photo|print|drawing/.test(formats);
}

function fragmentSize(url) {
  const match = /[#&]h=(\d+)&w=(\d+)|[#&]w=(\d+)&h=(\d+)/.exec(String(url));
  if (!match) return { width: 0, height: 0 };
  return match[1] ? { width: Number(match[2]), height: Number(match[1]) } : { width: Number(match[3]), height: Number(match[4]) };
}

function collectLocFiles(node, found, depth = 0) {
  if (!node || depth > 8) return;
  if (Array.isArray(node)) {
    for (const child of node) collectLocFiles(child, found, depth + 1);
    return;
  }
  if (typeof node !== 'object') return;
  if (typeof node.url === 'string' && typeof node.mimetype === 'string' && KEEP_MIME_TYPES.includes(node.mimetype.toLowerCase())) {
    found.push({
      url: node.url.split('#')[0],
      mimetype: node.mimetype.toLowerCase(),
      width: Number(node.width) || 0,
      height: Number(node.height) || 0,
      size: Number(node.size) || 0,
    });
  }
  for (const value of Object.values(node)) collectLocFiles(value, found, depth + 1);
}

/** Picks the largest keepable image file named in a loc.gov item JSON, or null. */
export function pickBestLocImage(data) {
  const found = [];
  collectLocFiles(data?.resources, found);
  const imageUrls = [...(Array.isArray(data?.item?.image_url) ? data.item.image_url : []), ...(Array.isArray(data?.image_url) ? data.image_url : [])];
  for (const raw of imageUrls) {
    if (typeof raw !== 'string') continue;
    const mimetype = /\.tiff?($|[?#])/i.test(raw) ? 'image/tiff' : /\.png($|[?#])/i.test(raw) ? 'image/png' : /\.jpe?g($|[?#])/i.test(raw) ? 'image/jpeg' : '';
    if (!mimetype) continue;
    const { width, height } = fragmentSize(raw);
    found.push({ url: raw.split('#')[0], mimetype, width, height, size: 0 });
  }
  const usable = found.filter((file) => !/\/(?:thumb|small|medium)\b|[_/]\d{2,3}px\b/i.test(file.url));
  if (usable.length === 0) return null;
  const score = (file) => (file.mimetype === 'image/jpeg' ? 1e12 : 0) + (longSideOf(file.width, file.height) || 0) * 1e3 + file.size / 1e3;
  return [...usable].sort((a, b) => score(b) - score(a))[0];
}

/** Commons imageinfo (url|size|mime|extmetadata) to a candidate file, or null when it is not a keepable image. */
export function pickCommonsFile(page) {
  const info = page?.imageinfo?.[0];
  if (!info?.url) return null;
  const mime = String(info.mime ?? '').toLowerCase();
  if (!KEEP_MIME_TYPES.includes(mime)) return null;
  const meta = info.extmetadata ?? {};
  const value = (key) => String(meta[key]?.value ?? '');
  return {
    url: info.url,
    mimetype: mime,
    width: Number(info.width) || 0,
    height: Number(info.height) || 0,
    size: Number(info.size) || 0,
    description: value('ImageDescription'),
    credit: value('Credit'),
    restrictions: value('Restrictions'),
    categories: value('Categories'),
  };
}

/**
 * Decides whether a resolved file may be archived. Order matters: the cheapest
 * checks come first so nothing is downloaded for an item that will be skipped.
 * Returns { ok: true } or { ok: false, reason } with a short reason for admin_notes.
 */
export function archiveVerdict({ imageUrl, text = /** @type {string[]} */ ([]), width, height, minimumLongSide, denylist }) {
  if (isDeniedImageHost(imageUrl, denylist)) return { ok: false, reason: 'image host is on the watermark denylist' };
  if (textSuggestsWatermark(...text)) return { ok: false, reason: 'source metadata mentions a watermark or an agency credit' };
  const side = longSideOf(width, height);
  if (side > 0 && side < minimumLongSide) return { ok: false, reason: `long side ${side}px is under the ${minimumLongSide}px minimum` };
  return { ok: true };
}

/** Appends a dated archive-ingest line to admin_notes text. */
export function appendArchiveNote(existing, line, date = new Date().toISOString().slice(0, 10)) {
  const base = String(existing ?? '').trim();
  const note = `${ARCHIVE_NOTE_MARKER} ${line} (${date}).`;
  return base ? `${base} ${note}` : note;
}
