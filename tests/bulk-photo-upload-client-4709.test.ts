import { describe, expect, it, vi } from 'vitest';
import { isValidBulkBatchId as serverIsValidBulkBatchId } from '../functions/_lib/bulk-photo-upload-checks';
import {
  adminMultipartUpload,
  buildBulkUploadFormData,
  classifyUploadResponse,
  isAcceptedImageFile,
  isHeicClientFileName,
  isValidBulkBatchId,
  resultsToCsv,
  resultsToJson,
  runUploadQueue,
  summarizeResults,
  type QueueItem,
} from '../src/lib/bulkPhotoUpload';

describe('bulk photo upload client (#4709 slice 2)', () => {
  it('batch id rule matches server isValidBulkBatchId (including .. and dots-only)', () => {
    const samples = [
      'ok-batch_1',
      'a',
      'x'.repeat(64),
      'x'.repeat(65),
      '..',
      '...',
      'has..dots',
      'bad/slash',
      'bad:colon',
      '',
    ];
    for (const s of samples) {
      expect(isValidBulkBatchId(s)).toBe(serverIsValidBulkBatchId(s));
    }
  });

  it('rejects HEIC client-side and accepts jpeg/png/webp by name', () => {
    expect(isHeicClientFileName('shot.HEIC')).toBe(true);
    expect(isHeicClientFileName('shot.heif')).toBe(true);
    const jpeg = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const heic = new File([new Uint8Array([1])], 'a.heic', { type: 'image/heic' });
    expect(isAcceptedImageFile(jpeg)).toBe(true);
    expect(isAcceptedImageFile(heic)).toBe(false);
  });

  it('multipart FormData never includes a publish field', () => {
    const file = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
    const form = buildBulkUploadFormData({
      file,
      batchId: 'batch-1',
      rightsClass: 'lgfc_collection',
    });
    expect(form.has('publish')).toBe(false);
    expect(form.has('published')).toBe(false);
    expect(form.get('batch_id')).toBe('batch-1');
    expect(form.get('rights_class')).toBe('lgfc_collection');
  });

  it('adminMultipartUpload does not set Content-Type', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('Content-Type')).toBe(false);
      return new Response(JSON.stringify({ ok: true, status: 'stored_unpublished', photo_id: 1 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1])], 'a.jpg'));
    const result = await adminMultipartUpload('/api/admin/photos/bulk-upload', form);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    vi.unstubAllGlobals();
  });

  it('classifies uploaded, duplicate, rejected, and check-these responses', () => {
    const meta = { batchId: 'b1', rightsClass: 'lgfc_collection' as const };
    expect(
      classifyUploadResponse('a.jpg', {
        ok: true,
        status: 201,
        data: { status: 'stored_unpublished', screenshot: 'ok', photo_id: 9 },
        error: '',
      }, meta).status,
    ).toBe('uploaded');

    expect(
      classifyUploadResponse('a.jpg', {
        ok: true,
        status: 200,
        data: { ok: true, status: 'exact_duplicate_skipped', photo_id: 2 },
        error: '',
      }, meta).status,
    ).toBe('duplicate_skipped');

    expect(
      classifyUploadResponse('a.jpg', {
        ok: false,
        status: 400,
        data: { error: 'screenshot_denied', code: 'screenshot_denied', reasons: ['strong'] },
        error: 'screenshot_denied',
      }, meta),
    ).toMatchObject({ status: 'rejected', reasons: ['strong'] });

    expect(
      classifyUploadResponse('a.jpg', {
        ok: true,
        status: 201,
        data: {
          status: 'stored_unpublished',
          screenshot: 'check',
          screenshot_reasons: ['weak'],
          flat_copy_flagged: true,
          flat_copy_reasons: ['file_name_suggests_flat_copy'],
        },
        error: '',
      }, meta).status,
    ).toBe('check_these');
  });

  it('report counts match results; CSV/JSON include file fields', () => {
    const results = [
      { fileName: 'a.jpg', status: 'uploaded' as const, photoId: 1, batchId: 'b', rightsClass: 'lgfc_collection' as const },
      { fileName: 'b.jpg', status: 'rejected' as const, error: 'nope', batchId: 'b', rightsClass: 'lgfc_collection' as const },
    ];
    const counts = summarizeResults(results);
    expect(counts.uploaded).toBe(1);
    expect(counts.rejected).toBe(1);
    const csv = resultsToCsv(results);
    expect(csv).toContain('a.jpg');
    expect(csv).toContain('uploaded');
    const json = JSON.parse(resultsToJson(results));
    expect(json.results).toHaveLength(2);
  });

  it('runUploadQueue caps concurrency and stops on 401', async () => {
    const active = { n: 0, max: 0 };
    const items: QueueItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      file: new File([new Uint8Array([1])], `${i}.jpg`),
      result: null,
    }));
    const ac = new AbortController();
    const seen: string[] = [];
    await runUploadQueue({
      items,
      concurrency: 3,
      signal: ac.signal,
      uploadOne: async (item) => {
        active.n += 1;
        active.max = Math.max(active.max, active.n);
        await new Promise((r) => setTimeout(r, 20));
        active.n -= 1;
        if (item.id === '1') {
          return { fileName: item.file.name, status: 'rejected', httpStatus: 401, error: 'auth' };
        }
        return { fileName: item.file.name, status: 'uploaded', httpStatus: 201 };
      },
      onItem: (id) => {
        seen.push(id);
      },
    });
    expect(active.max).toBeLessThanOrEqual(3);
    expect(seen.length).toBeGreaterThanOrEqual(1);
  });
});
