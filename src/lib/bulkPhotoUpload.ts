/**
 * Client helpers for admin bulk photo upload (#4709 slice 2).
 * Pure rules + multipart fetch (no Content-Type; browser sets the boundary).
 */

export type BulkRightsClass = 'lgfc_collection' | 'someone_elses';

export type UploadFileStatus =
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'duplicate_skipped'
  | 'rejected'
  | 'check_these'
  | 'failed'
  | 'cancelled';

export type UploadFileResult = {
  fileName: string;
  status: UploadFileStatus;
  error?: string;
  reasons?: string[];
  screenshotReasons?: string[];
  flatCopyReasons?: string[];
  /** Content SHA from the Slice 1 endpoint (`photo_id` string), not the row id. */
  photoId?: string | null;
  /** Numeric photos.id (`id` on store, `existing_id` on exact duplicate). */
  rowId?: number | null;
  b2Key?: string | null;
  batchId?: string;
  rightsClass?: BulkRightsClass;
  identicalPhashPhotoId?: number | null;
  nearDuplicateMatches?: Array<{ photoId: number; distance: number }>;
  httpStatus?: number;
  /** #5526: true when trying again could succeed (network failure, 429, 5xx). */
  retryable?: boolean;
};

export type NearDuplicateMatchField = { photoId: number; distance: number };

function parseNearDuplicateMatches(data: Record<string, unknown>): NearDuplicateMatchField[] {
  const raw = data.near_duplicate_matches;
  if (!Array.isArray(raw)) return [];
  const out: NearDuplicateMatchField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const photoId = typeof row.photo_id === 'number' ? row.photo_id : null;
    const distance = typeof row.distance === 'number' ? row.distance : null;
    if (photoId == null || distance == null) continue;
    out.push({ photoId, distance });
  }
  return out;
}

/** Map bulk-upload JSON fields onto report columns. */
export function photoFieldsFromBulkResponse(data: Record<string, unknown>): {
  photoId: string | null;
  rowId: number | null;
  b2Key: string | null;
  identicalPhashPhotoId: number | null;
  nearDuplicateMatches: NearDuplicateMatchField[];
} {
  const photoId = typeof data.photo_id === 'string' && data.photo_id.length > 0 ? data.photo_id : null;
  const rowFromId = typeof data.id === 'number' ? data.id : null;
  const rowFromExisting = typeof data.existing_id === 'number' ? data.existing_id : null;
  return {
    photoId,
    rowId: rowFromId ?? rowFromExisting,
    b2Key: typeof data.b2_key === 'string' ? data.b2_key : null,
    identicalPhashPhotoId:
      typeof data.identical_phash_photo_id === 'number' ? data.identical_phash_photo_id : null,
    nearDuplicateMatches: parseNearDuplicateMatches(data),
  };
}

const BULK_BATCH_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Parity with `functions/_lib/bulk-photo-upload-checks.ts` `isValidBulkBatchId`. */
export function isValidBulkBatchId(batchId: string): boolean {
  if (!BULK_BATCH_ID.test(batchId)) return false;
  if (batchId.includes('..') || /^\.+$/.test(batchId)) return false;
  return true;
}

export function isHeicClientFileName(fileName: string): boolean {
  return /\.(heic|heif)$/i.test(fileName.trim());
}

export function isAcceptedImageFile(file: File): boolean {
  const name = file.name || '';
  if (isHeicClientFileName(name)) return false;
  const type = (file.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') return true;
  return /\.(jpe?g|png|webp)$/i.test(name);
}

export function suggestBatchId(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  return `bulk-${y}${m}${d}-${h}${min}`;
}

export type AdminMultipartResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  error: string;
};

/** Multipart POST without setting Content-Type (FormData boundary). */
export async function adminMultipartUpload(
  path: string,
  formData: FormData,
  init: { signal?: AbortSignal } = {},
): Promise<AdminMultipartResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      cache: 'no-store',
      signal: init.signal,
    });
    const data: unknown = await response.json().catch(() => ({}));
    const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;
    if (!response.ok) {
      const error =
        record && typeof record.error === 'string'
          ? record.error
          : `HTTP ${response.status}`;
      return { ok: false, status: response.status, data: record, error };
    }
    return { ok: true, status: response.status, data: record, error: '' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, status: 0, data: null, error: 'cancelled' };
    }
    return { ok: false, status: 0, data: null, error: 'Network failure.' };
  }
}

export function buildBulkUploadFormData(input: {
  file: File;
  batchId: string;
  rightsClass: BulkRightsClass;
  source?: string;
  /** #5526: facts about the file as picked, sent when the browser converted it to JPEG. */
  original?: {
    name: string;
    format: 'jpeg' | 'png' | 'webp';
    width: number;
    height: number;
    bytes: number;
    cameraData: boolean;
  };
  /** #5526: batch setting "Include screenshots". */
  allowScreenshots?: boolean;
}): FormData {
  const form = new FormData();
  form.append('file', input.file, input.file.name);
  form.append('batch_id', input.batchId);
  form.append('rights_class', input.rightsClass);
  if (input.rightsClass === 'someone_elses' && input.source) {
    form.append('source', input.source);
  }
  if (input.original) {
    form.append('client_converted', '1');
    form.append('original_name', input.original.name);
    form.append('original_format', input.original.format);
    form.append('original_width', String(input.original.width));
    form.append('original_height', String(input.original.height));
    form.append('original_bytes', String(input.original.bytes));
    form.append('original_camera_data', input.original.cameraData ? '1' : '0');
  }
  if (input.allowScreenshots) form.append('allow_screenshots', '1');
  // Never send publish.
  return form;
}

/** 429 and 5xx can succeed on a later try. Every other non-OK answer is a refusal of the file. */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * #5526: rows the "Retry failed" button resubmits. Refused files (screenshot rule, bad image, too
 * large) would be refused again, so they are left alone. Failed and cancelled rows can succeed.
 */
export function isRetryWorkResult(result: UploadFileResult | null | undefined): boolean {
  if (!result) return false;
  return result.status === 'failed' || result.status === 'cancelled';
}

export function classifyUploadResponse(
  fileName: string,
  result: AdminMultipartResult,
  meta: { batchId: string; rightsClass: BulkRightsClass },
): UploadFileResult {
  const base = {
    fileName,
    batchId: meta.batchId,
    rightsClass: meta.rightsClass,
    httpStatus: result.status,
  };

  if (result.error === 'cancelled') {
    return { ...base, status: 'cancelled', error: 'cancelled' };
  }
  if (result.status === 0) {
    return { ...base, status: 'failed', error: result.error || 'Network failure.', retryable: true };
  }
  if (!result.ok && isRetryableHttpStatus(result.status)) {
    // #5526: a server or storage hiccup is not a refusal of the file. Show it as failed.
    return { ...base, status: 'failed', error: result.error, retryable: true };
  }
  if (!result.ok) {
    const data = result.data || {};
    const reasons = Array.isArray(data.reasons)
      ? data.reasons.filter((r): r is string => typeof r === 'string')
      : undefined;
    return {
      ...base,
      status: 'rejected',
      error: result.error,
      reasons,
    };
  }

  const data = result.data || {};
  const apiStatus = typeof data.status === 'string' ? data.status : '';
  if (
    apiStatus === 'exact_duplicate_skipped' ||
    (data.ok === true && apiStatus.includes('duplicate'))
  ) {
    const fields = photoFieldsFromBulkResponse(data);
    return {
      ...base,
      status: 'duplicate_skipped',
      photoId: fields.photoId,
      rowId: fields.rowId,
      b2Key: fields.b2Key,
      identicalPhashPhotoId: fields.identicalPhashPhotoId,
    };
  }

  const screenshot = typeof data.screenshot === 'string' ? data.screenshot : 'ok';
  const flatFlagged = data.flat_copy_flagged === true;
  const screenshotReasons = Array.isArray(data.screenshot_reasons)
    ? data.screenshot_reasons.filter((r): r is string => typeof r === 'string')
    : [];
  const flatCopyReasons = Array.isArray(data.flat_copy_reasons)
    ? data.flat_copy_reasons.filter((r): r is string => typeof r === 'string')
    : [];
  const fields = photoFieldsFromBulkResponse(data);
  const nearDupFlagged = fields.nearDuplicateMatches.length > 0;

  if (screenshot === 'check' || flatFlagged || nearDupFlagged) {
    return {
      ...base,
      status: 'check_these',
      photoId: fields.photoId,
      rowId: fields.rowId,
      b2Key: fields.b2Key,
      screenshotReasons,
      flatCopyReasons,
      identicalPhashPhotoId: fields.identicalPhashPhotoId,
      nearDuplicateMatches: fields.nearDuplicateMatches,
    };
  }

  return {
    ...base,
    status: 'uploaded',
    photoId: fields.photoId,
    rowId: fields.rowId,
    b2Key: fields.b2Key,
    identicalPhashPhotoId: fields.identicalPhashPhotoId,
    nearDuplicateMatches: fields.nearDuplicateMatches,
  };
}

export function summarizeResults(results: UploadFileResult[]): Record<UploadFileStatus, number> {
  const counts: Record<UploadFileStatus, number> = {
    queued: 0,
    uploading: 0,
    uploaded: 0,
    duplicate_skipped: 0,
    rejected: 0,
    check_these: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const r of results) counts[r.status] += 1;
  return counts;
}

export function resultsToCsv(results: UploadFileResult[]): string {
  const header = [
    'file_name',
    'status',
    'error',
    'reasons',
    'screenshot_reasons',
    'flat_copy_reasons',
    'photo_id',
    'row_id',
    'b2_key',
    'batch_id',
    'rights_class',
    'identical_phash_photo_id',
    'near_duplicate_matches',
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = results.map((r) =>
    [
      r.fileName,
      r.status,
      r.error || '',
      (r.reasons || []).join(';'),
      (r.screenshotReasons || []).join(';'),
      (r.flatCopyReasons || []).join(';'),
      r.photoId == null ? '' : String(r.photoId),
      r.rowId == null ? '' : String(r.rowId),
      r.b2Key || '',
      r.batchId || '',
      r.rightsClass || '',
      r.identicalPhashPhotoId == null ? '' : String(r.identicalPhashPhotoId),
      (r.nearDuplicateMatches || [])
        .map((m) => `${m.photoId}:${m.distance}`)
        .join(';'),
    ]
      .map((c) => escape(String(c)))
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

export function resultsToJson(results: UploadFileResult[]): string {
  return JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2);
}

export type QueueItem = {
  id: string;
  file: File;
  result: UploadFileResult | null;
};

export const AUTO_RETRY_LIMIT = 2;
export const AUTO_RETRY_BASE_DELAY_MS = 1500;

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Run uploads with concurrency limit. Calls `onItem` after each completes.
 * Stops the whole run on 401/403. Never retries a refusal (4xx). #5526: retries a retryable
 * failure (network, 429, 5xx) up to AUTO_RETRY_LIMIT times with a growing pause.
 */
export async function runUploadQueue(input: {
  items: QueueItem[];
  concurrency: number;
  signal: AbortSignal;
  uploadOne: (item: QueueItem, signal: AbortSignal) => Promise<UploadFileResult>;
  onItem: (itemId: string, result: UploadFileResult) => void;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  retryLimit?: number;
}): Promise<{ stoppedAuth: boolean }> {
  const pending = [...input.items];
  const sleep = input.sleep ?? defaultSleep;
  const retryLimit = input.retryLimit ?? AUTO_RETRY_LIMIT;
  let stoppedAuth = false;
  let index = 0;

  async function worker() {
    while (!stoppedAuth && !input.signal.aborted) {
      const i = index++;
      if (i >= pending.length) return;
      const item = pending[i];
      let result = await input.uploadOne(item, input.signal);
      let attempt = 0;
      while (result.retryable && attempt < retryLimit && !input.signal.aborted) {
        attempt += 1;
        await sleep(AUTO_RETRY_BASE_DELAY_MS * attempt, input.signal);
        if (input.signal.aborted) break;
        result = await input.uploadOne(item, input.signal);
      }
      if (result.httpStatus === 401 || result.httpStatus === 403) {
        stoppedAuth = true;
      }
      input.onItem(item.id, result);
      if (stoppedAuth) return;
    }
  }

  const n = Math.max(1, Math.min(input.concurrency, pending.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return { stoppedAuth };
}
