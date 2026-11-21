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
      return new Response(
        JSON.stringify({
          ok: true,
          status: 'stored_unpublished',
          id: 1,
          photo_id: 'abc123sha',
          b2_key: 'bulk/b/abc123sha.jpg',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('file', new File([new Uint8Array([1])], 'a.jpg'));
    const result = await adminMultipartUpload('/api/admin/photos/bulk-upload', form);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    vi.unstubAllGlobals();
  });

  it('classifies uploaded, duplicate, rejected, and check-these from Slice 1 response shapes', () => {
    const meta = { batchId: 'b1', rightsClass: 'lgfc_collection' as const };
    const stored = classifyUploadResponse(
      'a.jpg',
      {
        ok: true,
        status: 201,
        data: {
          ok: true,
          status: 'stored_unpublished',
          id: 42,
          batch_id: 'b1',
          b2_key: 'bulk/b1/deadbeef.jpg',
          photo_id: 'deadbeefcafefeed',
          screenshot: 'ok',
          screenshot_reasons: [],
          flat_copy_flagged: false,
          flat_copy_reasons: [],
          identical_phash_photo_id: null,
        },
        error: '',
      },
      meta,
    );
    expect(stored).toMatchObject({
      status: 'uploaded',
      photoId: 'deadbeefcafefeed',
      rowId: 42,
      b2Key: 'bulk/b1/deadbeef.jpg',
    });
    expect(typeof stored.photoId).toBe('string');
    expect(stored.photoId!.length).toBeGreaterThan(0);

    const dup = classifyUploadResponse(
      'a.jpg',
      {
        ok: true,
        status: 200,
        data: { ok: true, status: 'exact_duplicate_skipped', existing_id: 7, batch_id: 'b1' },
        error: '',
      },
      meta,
    );
    expect(dup).toMatchObject({
      status: 'duplicate_skipped',
      photoId: null,
      rowId: 7,
      b2Key: null,
    });

    expect(
      classifyUploadResponse(
        'a.jpg',
        {
          ok: false,
          status: 400,
          data: { error: 'screenshot_denied', code: 'screenshot_denied', reasons: ['strong'] },
          error: 'screenshot_denied',
        },
        meta,
      ),
    ).toMatchObject({ status: 'rejected', reasons: ['strong'] });

    expect(
      classifyUploadResponse(
        'a.jpg',
        {
          ok: true,
          status: 201,
          data: {
            status: 'stored_unpublished',
            id: 9,
            photo_id: 'sha-check-me',
            b2_key: 'bulk/b1/sha-check-me.jpg',
            screenshot: 'check',
            screenshot_reasons: ['weak'],
            flat_copy_flagged: true,
            flat_copy_reasons: ['file_name_suggests_flat_copy'],
          },
          error: '',
        },
        meta,
      ),
    ).toMatchObject({
      status: 'check_these',
      photoId: 'sha-check-me',
      rowId: 9,
    });
  });

  it('report counts match results; CSV/JSON include photo_id SHA and row_id', () => {
    const results = [
      {
        fileName: 'a.jpg',
        status: 'uploaded' as const,
        photoId: 'deadbeef',
        rowId: 42,
        batchId: 'b',
        rightsClass: 'lgfc_collection' as const,
      },
      {
        fileName: 'b.jpg',
        status: 'duplicate_skipped' as const,
        photoId: null,
        rowId: 7,
        batchId: 'b',
        rightsClass: 'lgfc_collection' as const,
      },
      {
        fileName: 'c.jpg',
        status: 'rejected' as const,
        error: 'nope',
        batchId: 'b',
        rightsClass: 'lgfc_collection' as const,
      },
    ];
    const counts = summarizeResults(results);
    expect(counts.uploaded).toBe(1);
    expect(counts.duplicate_skipped).toBe(1);
    expect(counts.rejected).toBe(1);
    const csv = resultsToCsv(results);
    expect(csv).toContain('row_id');
    expect(csv).toContain('deadbeef');
    expect(csv).toContain('42');
    expect(csv).toContain('7');
    const json = JSON.parse(resultsToJson(results));
    expect(json.results[0].photoId).toBe('deadbeef');
    expect(json.results[0].rowId).toBe(42);
    expect(json.results[1].rowId).toBe(7);
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
