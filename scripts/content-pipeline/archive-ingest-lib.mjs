/**
 * Pure decisions for the archive ingest (#4859): which file to fetch for an
 * archived candidate, and whether it is good enough to keep. No network, no
 * database, so every rule is unit-tested.
 */

import { isDeniedImageHost } from './gehrig-copy-quality.mjs';

export const ARCHIVE_HOLD_REASON = 'archived pending written permission (Product Authority 2026-10-24, #4839)';
// Note markers (#4870, #4874). Notes written by earlier versions of the file picker use an older marker.
// A row whose only notes are older file-reason skips is looked at again; every other skip stays final.
export const ARCHIVE_NOTE_MARKER = 'archive-ingest-v3:';
export const LEGACY_NOTE_MARKERS = ['archive-ingest:', 'archive-ingest-v2:'];
export const LEGACY_FILE_SKIP_REASONS = ['loc.gov record names no downloadable image file', 'long side '];
export const ARCHIVE_MAX_FILE_BYTES = 25 * 1024 * 1024;

// TIFF masters (#4874): loc.gov offers JPEG copies only up to 1,024 px, so the full-size TIFF is fetched and
// stored as a JPEG master of at most 4,000 px on the long side.
export const MASTER_TIFF_MIN_BYTES = 2 * 1024 * 1024;
export const MASTER_TIFF_MAX_BYTES = 100 * 1024 * 1024;
export const MASTER_MAX_LONG_SIDE_PX = 4000;
export const MASTER_JPEG_QUALITY = 92;

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

function collectLocCandidates(data) {
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
  return found;
}

const THUMBNAIL_URL_PATTERN = /\/(?:thumb|small|medium)\b|[_/]\d{2,3}px\b/i;

/**
 * Picks the image file to archive from a loc.gov item JSON, or null (#4870).
 * Storage is not free past a few GB, so the largest JPEG wins whenever it meets the minimum size;
 * a TIFF or PNG master is used only when no JPEG reaches it. Files over the size limit are never
 * chosen. A file with unknown pixel size ranks by byte size.
 */
export function pickBestLocImage(data, minimumLongSide = 1500) {
  const usable = collectLocCandidates(data).filter(
    (file) => !THUMBNAIL_URL_PATTERN.test(file.url) && !(file.size > ARCHIVE_MAX_FILE_BYTES),
  );
  if (usable.length === 0) return null;
  const rank = (file) => (longSideOf(file.width, file.height) || 0) * 1e9 + file.size / 1e3;
  const bySize = (a, b) => rank(b) - rank(a);
  const bestJpeg = usable.filter((file) => file.mimetype === 'image/jpeg').sort(bySize)[0];
  if (bestJpeg && (longSideOf(bestJpeg.width, bestJpeg.height) === 0 || longSideOf(bestJpeg.width, bestJpeg.height) >= minimumLongSide)) {
    return bestJpeg;
  }
  return [...usable].sort(bySize)[0];
}

/** Short description of what a loc.gov record offered, for skip notes (#4870). Capped at 260 characters. */
export function describeLocFiles(data) {
  const files = collectLocCandidates(data);
  const mb = (bytes) => (bytes ? `${Math.round(bytes / 1e5) / 10}MB` : 'size n/a');
  const parts = files
    .slice(0, 6)
    .map((file) => `${file.mimetype.replace('image/', '')} ${file.width && file.height ? `${file.width}x${file.height}` : 'dims n/a'} ${mb(file.size)}`);
  const text =
    files.length > 0
      ? `files found: ${parts.join('; ')}${files.length > 6 ? `; +${files.length - 6} more` : ''}`
      : `no image files found; record keys: ${Object.keys(data ?? {}).slice(0, 8).join(',')}; resources: ${Array.isArray(data?.resources) ? data.resources.length : 'none'}`;
  return text.length > 260 ? `${text.slice(0, 257)}...` : text;
}

/** HTTP statuses worth retrying with backoff. */
export function isRetryableStatus(status) {
  return status === 429 || status === 503 || status === 502 || status === 504;
}

/** Delay before retry number `attempt` (1-based): honours Retry-After seconds, else 5s, 15s, 45s; capped at 60s. */
export function backoffDelayMs(attempt, retryAfter) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 60) * 1000;
  return Math.min(5000 * 3 ** (attempt - 1), 60_000);
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

/**
 * SQL that selects archive candidates (#4859, #4870, #4872, #4874). D1 rejects LIKE and GLOB patterns over
 * 50 bytes, so the skip-reason matches use instr(), which has no such limit. Takes one bound
 * parameter: the row limit. Selects rows never processed, plus rows whose only archive notes come from
 * an older marker and are file-reason skips; every other skip is final.
 */
// Boston records skipped when the image link was guessed (#4916) are tried once more through the manifest.
const DPLA_BOSTON_GUESS_SKIP = 'Digital Commonwealth IIIF: source returned HTTP 404';
const DPLA_BOSTON_MANIFEST_LABEL = 'Digital Commonwealth manifest';

export function buildArchiveCandidatesSql() {
  const has = (text) => `instr(admin_notes, '${text}') > 0`;
  const anyMarker = [ARCHIVE_NOTE_MARKER, ...LEGACY_NOTE_MARKERS].map((marker) => `NOT ${has(marker)}`).join(' AND ');
  const legacyFileSkips = LEGACY_NOTE_MARKERS.flatMap((marker) =>
    LEGACY_FILE_SKIP_REASONS.map((reason) => has(`${marker} skipped, ${reason}`)),
  ).join(' OR ');
  return `SELECT id, candidate_id, title, source_url, source_domain, provenance_notes, admin_notes
         FROM content_items
         WHERE media_asset_id IS NULL AND superseded_at IS NULL AND content_type = 'photo'
           AND source_domain IN ('loc.gov', 'commons.wikimedia.org', 'dp.la')
           AND (
             admin_notes IS NULL
             OR (${anyMarker})
             OR (NOT ${has(ARCHIVE_NOTE_MARKER)} AND (${legacyFileSkips}))
             OR (${has(DPLA_BOSTON_GUESS_SKIP)} AND NOT ${has(DPLA_BOSTON_MANIFEST_LABEL)})
           )
         ORDER BY id LIMIT ?`;
}

/** The TIFF master of a loc.gov record: the largest TIFF between 2 MB and 100 MB, or null (#4874). */
export function pickLocTiffMaster(data) {
  const tiffs = collectLocCandidates(data)
    .filter((file) => file.mimetype === 'image/tiff' && file.size >= MASTER_TIFF_MIN_BYTES && file.size <= MASTER_TIFF_MAX_BYTES)
    .sort((a, b) => b.size - a.size);
  return tiffs[0] ?? null;
}

/**
 * Chooses the file to fetch for a loc.gov record (#4874): the best JPEG when it meets the minimum,
 * else the TIFF master (its pixel size is only known after download), else the best JPEG so the skip
 * note can say it was too small.
 */
export function pickLocFile(data, minimumLongSide = 1500) {
  const best = pickBestLocImage(data, minimumLongSide);
  const side = best ? longSideOf(best.width, best.height) : 0;
  if (best && (side === 0 || side >= minimumLongSide)) return best;
  return pickLocTiffMaster(data) ?? best;
}

/** Size of the stored JPEG master for a decoded source: never upscaled, long side capped (#4874). */
export function masterTargetSize(width, height, maxLongSide = MASTER_MAX_LONG_SIDE_PX) {
  const side = longSideOf(width, height);
  if (side <= maxLongSide) return { width, height, scaled: false };
  const scale = maxLongSide / side;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scaled: true };
}

/** Thumbnail and media links that discovery recorded in a DPLA row's provenance notes (#4902). */
export function parseDplaLinks(provenanceNotes) {
  const notes = String(provenanceNotes ?? '');
  const thumbnail = /DPLA thumbnail \(object\): (https?:\/\/\S+?)\. DPLA media links/.exec(notes)?.[1] ?? null;
  const viewText = /DPLA media links \(hasView\): (.+?)\. DPLA is a pure aggregator/.exec(notes)?.[1] ?? '';
  const views = viewText.split(/\s+/).filter((part) => /^https?:\/\//.test(part));
  const institution = /Contributing institution: (.+?)\. Provider \(hub\)/.exec(notes)?.[1] ?? '';
  return { thumbnail, views, institution };
}

const IIIF_LONG_EDGE = 3000;

function digitalCommonwealthId(url) {
  return /\/ark:\/50959\/([a-z0-9]+)/i.exec(url)?.[1] ?? null;
}

/**
 * Full-size image links to try, best first, for a DPLA record from a library whose layout is known:
 * NYPL Digital Collections and Boston Public Library via Digital Commonwealth.
 * Libraries not listed here return an empty ladder. Links are guesses from each library's published
 * layout, so every one that fails is named in the skip note (#4902).
 */
export function buildDplaImageLadder({ thumbnail, views = [] }) {
  const ladder = [];
  const add = (url, label) => {
    if (url && !ladder.some((entry) => entry.url === url)) ladder.push({ url, label });
  };
  for (const raw of [thumbnail, ...views].filter(Boolean)) {
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'images.nypl.org') {
      // NYPL's public image service stops at 760 px (t=g and t=q answer 404), so this one link is expected
      // to fall under the 1,500 px and 800 px minimums; trying it records that in the skip note (#4902).
      const id = parsed.searchParams.get('id');
      if (id) add(`https://images.nypl.org/index.php?id=${encodeURIComponent(id)}&t=w`, 'NYPL public service (760 px maximum)');
    } else if (host === 'ark.digitalcommonwealth.org' || host === 'iiif.digitalcommonwealth.org') {
      const id = digitalCommonwealthId(raw) ?? /commonwealth:([a-z0-9]+)/i.exec(raw)?.[1] ?? null;
      // The picture lives under its own file id, so the link comes from the item's IIIF manifest (#4902).
      if (id) add(`https://ark.digitalcommonwealth.org/ark:/50959/${id}/manifest`, 'Digital Commonwealth manifest');
    }
  }
  return ladder;
}

/** Library hosts a DPLA row may be fetched from, added in code so no production allowlist data changes (#4902). */
export const DPLA_EXTRA_APPROVED_DOMAINS = ['images.nypl.org', 'ark.digitalcommonwealth.org', 'iiif.digitalcommonwealth.org'];

/**
 * Tracks transient failures per source domain so one throttled host (for example Wikimedia answering
 * HTTP 429) pauses only its own rows for the rest of the run instead of ending the whole run (#4905).
 */
export function createThrottleTracker(maxConsecutive = 2) {
  const streaks = new Map();
  const paused = new Set();
  return {
    recordFailure(domain) {
      const streak = (streaks.get(domain) ?? 0) + 1;
      streaks.set(domain, streak);
      if (streak >= maxConsecutive) paused.add(domain);
    },
    recordSuccess(domain) {
      streaks.set(domain, 0);
    },
    isPaused(domain) {
      return paused.has(domain);
    },
    allPaused(domains) {
      const list = [...domains];
      return list.length > 0 && list.every((domain) => paused.has(domain));
    },
  };
}

/**
 * The first image of a Digital Commonwealth IIIF v2 manifest: the image service and its pixel size, or null.
 * The service answers `/full/!N,N/0/default.jpg` with a JPEG no larger than N px on a side (#4902).
 */
export function parseDigitalCommonwealthManifest(manifest) {
  const image = manifest?.sequences?.[0]?.canvases?.[0]?.images?.[0]?.resource;
  const service = image?.service?.['@id'];
  if (typeof service !== 'string' || !/^https:\/\/iiif\.digitalcommonwealth\.org\/iiif\/2\/commonwealth:[a-z0-9]+$/i.test(service)) return null;
  const width = Number(image.width);
  const height = Number(image.height);
  return { service, width: Number.isFinite(width) ? width : null, height: Number.isFinite(height) ? height : null };
}

/** The JPEG link for a manifest image, scaled down to at most `maxEdge` px on its long side. */
export function digitalCommonwealthImageUrl({ service, width, height }, maxEdge = IIIF_LONG_EDGE) {
  const side = longSideOf(width, height);
  return side > maxEdge || !side ? `${service}/full/!${maxEdge},${maxEdge}/0/default.jpg` : `${service}/full/full/0/default.jpg`;
}
