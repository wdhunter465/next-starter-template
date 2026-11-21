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
  photoId?: number | null;
  b2Key?: string | null;
  batchId?: string;
  rightsClass?: BulkRightsClass;
  identicalPhashPhotoId?: number | null;
  httpStatus?: number;
};

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
}): FormData {
  const form = new FormData();
  form.append('file', input.file, input.file.name);
  form.append('batch_id', input.batchId);
  form.append('rights_class', input.rightsClass);
  if (input.rightsClass === 'someone_elses' && input.source) {
    form.append('source', input.source);
  }
  // Never send publish.
  return form;
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
    return { ...base, status: 'failed', error: result.error || 'Network failure.' };
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
    return {
      ...base,
      status: 'duplicate_skipped',
      photoId: typeof data.photo_id === 'number' ? data.photo_id : null,
      b2Key: typeof data.b2_key === 'string' ? data.b2_key : null,
      identicalPhashPhotoId:
        typeof data.identical_phash_photo_id === 'number' ? data.identical_phash_photo_id : null,
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

  if (screenshot === 'check' || flatFlagged) {
    return {
      ...base,
      status: 'check_these',
      photoId: typeof data.photo_id === 'number' ? data.photo_id : null,
      b2Key: typeof data.b2_key === 'string' ? data.b2_key : null,
      screenshotReasons,
      flatCopyReasons,
      identicalPhashPhotoId:
        typeof data.identical_phash_photo_id === 'number' ? data.identical_phash_photo_id : null,
    };
  }

  return {
    ...base,
    status: 'uploaded',
    photoId: typeof data.photo_id === 'number' ? data.photo_id : null,
    b2Key: typeof data.b2_key === 'string' ? data.b2_key : null,
    identicalPhashPhotoId:
      typeof data.identical_phash_photo_id === 'number' ? data.identical_phash_photo_id : null,
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
    'b2_key',
    'batch_id',
    'rights_class',
    'identical_phash_photo_id',
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
      r.b2Key || '',
      r.batchId || '',
      r.rightsClass || '',
      r.identicalPhashPhotoId == null ? '' : String(r.identicalPhashPhotoId),
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

/**
 * Run uploads with concurrency limit. Calls `onItem` after each completes.
 * Stops the whole run on 401/403. Does not auto-retry 4xx.
 */
export async function runUploadQueue(input: {
  items: QueueItem[];
  concurrency: number;
  signal: AbortSignal;
  uploadOne: (item: QueueItem, signal: AbortSignal) => Promise<UploadFileResult>;
  onItem: (itemId: string, result: UploadFileResult) => void;
}): Promise<{ stoppedAuth: boolean }> {
  const pending = [...input.items];
  let stoppedAuth = false;
  let index = 0;

  async function worker() {
    while (!stoppedAuth && !input.signal.aborted) {
      const i = index++;
      if (i >= pending.length) return;
      const item = pending[i];
      const result = await input.uploadOne(item, input.signal);
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
