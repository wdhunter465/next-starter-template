// Pure checks for admin bulk photo upload (#4709 slice 1).
// No B2/D1 writes, no network I/O, no route wiring.
// Screenshot heuristics live in screenshot-detection.ts (merged #4710).

import { classifyScreenshot, type ScreenshotClassification } from './screenshot-detection';
import type { PhotoUploadDimensions, PhotoUploadImageFormat } from './photo-upload-validation';

export const BULK_PHOTO_LGFC_CREDIT = 'Photo: Lou Gehrig Fan Club';

export type BulkPhotoRightsClass = 'lgfc_collection' | 'someone_elses';

export type BulkPhotoRightsDecision = {
  rightsClass: BulkPhotoRightsClass;
  rightsHold: true;
  publicationEligible: false;
  rightsHolder: string | null;
  creditLine: string | null;
  source: string | null;
  error?: string;
};

export type FlatCopyFlag = {
  flagged: boolean;
  reasons: string[];
};

// Underscores are word chars in JS `\b`, so treat `_` / non-alnum as separators too.
const FLAT_COPY_NAME =
  /(?:^|[^a-z0-9])(card|cover|page|poster|scan|scrapbook|newspaper|clipping|program|ticket)(?:[^a-z0-9]|$)/i;

/**
 * Rights outcome for one uploaded file. Everything lands unpublished (rights hold).
 * `lgfc_collection` records LGFC as holder/credit; without separate evidence it stays held.
 * `someone_elses` never shows LGFC; source is required and recorded.
 */
export function decideBulkPhotoRights(input: {
  rightsClass: unknown;
  source?: unknown;
}): BulkPhotoRightsDecision | { ok: false; error: string } {
  const rightsClass = String(input.rightsClass ?? '').trim();
  if (rightsClass !== 'lgfc_collection' && rightsClass !== 'someone_elses') {
    return { ok: false, error: 'rights_class must be lgfc_collection or someone_elses.' };
  }
  if (rightsClass === 'lgfc_collection') {
    return {
      rightsClass,
      rightsHold: true,
      publicationEligible: false,
      rightsHolder: 'Lou Gehrig Fan Club',
      creditLine: BULK_PHOTO_LGFC_CREDIT,
      source: null,
    };
  }
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  if (!source) {
    return { ok: false, error: 'source is required when rights_class is someone_elses.' };
  }
  return {
    rightsClass,
    rightsHold: true,
    publicationEligible: false,
    rightsHolder: null,
    creditLine: null,
    source,
  };
}

/** Flat-copy look-alikes (card, cover, page, poster, …) flagged for review before publish. */
export function flagFlatCopyLookAlike(fileName: string): FlatCopyFlag {
  const reasons: string[] = [];
  if (FLAT_COPY_NAME.test(fileName)) {
    reasons.push('file_name_suggests_flat_copy');
  }
  return { flagged: reasons.length > 0, reasons };
}

export function isHeicFileName(fileName: string): boolean {
  return /\.(heic|heif)$/i.test(fileName.trim());
}

/** Safe for B2 key segments and comma-separated `photos.tags` (no `,` `:` `/` `..`). */
const BULK_BATCH_ID = /^[A-Za-z0-9._-]{1,64}$/;

export function isValidBulkBatchId(batchId: string): boolean {
  return BULK_BATCH_ID.test(batchId);
}

export function classifyBulkScreenshot(input: {
  fileName: string;
  format: PhotoUploadImageFormat;
  dimensions: PhotoUploadDimensions | null;
  bytes: Uint8Array;
}): ScreenshotClassification {
  return classifyScreenshot(input);
}
