import { describe, expect, it } from 'vitest';
import {
  hasCameraData,
  jpegFileName,
  originalFormatOf,
  targetSize,
} from '../src/lib/bulkPhotoConvert';
import { hasCameraData as serverHasCameraData } from '../functions/_lib/screenshot-detection';
import {
  AUTO_RETRY_LIMIT,
  classifyUploadResponse,
  isRetryableHttpStatus,
  isRetryWorkResult,
  runUploadQueue,
  type QueueItem,
  type UploadFileResult,
} from '../src/lib/bulkPhotoUpload';

describe('bulk photo conversion helpers (#5526)', () => {
  it('caps the long edge at 4000 and never enlarges', () => {
    expect(targetSize(8000, 4000)).toEqual({ width: 4000, height: 2000, resized: true });
    expect(targetSize(3000, 9000)).toEqual({ width: 1333, height: 4000, resized: true });
    expect(targetSize(4000, 3000)).toEqual({ width: 4000, height: 3000, resized: false });
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600, resized: false });
    expect(targetSize(10, 20000, 4000).height).toBe(4000);
    expect(targetSize(10, 20000, 4000).width).toBe(2);
  });

  it('renames to .jpg', () => {
    expect(jpegFileName('clipping.PNG')).toBe('clipping.jpg');
    expect(jpegFileName('a.b.webp')).toBe('a.b.jpg');
    expect(jpegFileName('noext')).toBe('noext.jpg');
    expect(jpegFileName('  ')).toBe('photo.jpg');
  });

  it('detects the original format from type or name', () => {
    expect(originalFormatOf({ name: 'a.bin', type: 'image/png' })).toBe('png');
    expect(originalFormatOf({ name: 'a.JPEG', type: '' })).toBe('jpeg');
    expect(originalFormatOf({ name: 'a.webp', type: '' })).toBe('webp');
    expect(originalFormatOf({ name: 'a.heic', type: 'image/heic' })).toBeNull();
  });

  it('reads camera data the same way as the server', () => {
    const jpegExif = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff, 0xd9]);
    const jpegPlain = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const chunk = (type: string, len: number) => [0, 0, 0, len, ...[...type].map((c) => c.charCodeAt(0)), ...new Array(len + 4).fill(0)];
    const pngExif = new Uint8Array([...pngSig, ...chunk('eXIf', 4), ...chunk('IEND', 0)]);
    const pngPlain = new Uint8Array([...pngSig, ...chunk('IDAT', 2), ...chunk('IEND', 0)]);
    for (const [bytes, format] of [
      [jpegExif, 'jpeg'],
      [jpegPlain, 'jpeg'],
      [pngExif, 'png'],
      [pngPlain, 'png'],
    ] as const) {
      expect(hasCameraData(bytes, format)).toBe(serverHasCameraData(bytes, format));
    }
    expect(hasCameraData(jpegExif, 'jpeg')).toBe(true);
    expect(hasCameraData(jpegPlain, 'jpeg')).toBe(false);
    expect(hasCameraData(pngExif, 'png')).toBe(true);
    expect(hasCameraData(pngPlain, 'png')).toBe(false);
  });
});

describe('bulk photo retry rules (#5526)', () => {
  const meta = { batchId: 'b', rightsClass: 'lgfc_collection' as const };
  const res = (status: number, error: string, data: Record<string, unknown> | null = null) => ({
    ok: false,
    status,
    data,
    error,
  });

  it('treats 429 and 5xx as retryable, other errors as refusals', () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(502)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isRetryableHttpStatus(401)).toBe(false);
    expect(isRetryableHttpStatus(413)).toBe(false);
  });

  it('shows a storage failure as failed and retryable, and a refusal as rejected', () => {
    const b2 = classifyUploadResponse('a.jpg', res(502, 'b2_put_failed'), meta);
    expect(b2.status).toBe('failed');
    expect(b2.retryable).toBe(true);
    const net = classifyUploadResponse('a.jpg', res(0, 'Network failure.'), meta);
    expect(net.status).toBe('failed');
    expect(net.retryable).toBe(true);
    const refused = classifyUploadResponse(
      'a.jpg',
      res(400, 'Strong screenshot clues rejected this file.', { reasons: ['file name says screenshot'] }),
      meta,
    );
    expect(refused.status).toBe('rejected');
    expect(refused.retryable).toBeUndefined();
    expect(refused.reasons).toEqual(['file name says screenshot']);
  });

  it('Retry failed resubmits failed and cancelled rows, never refused ones', () => {
    const r = (status: UploadFileResult['status']): UploadFileResult => ({ fileName: 'a', status });
    expect(isRetryWorkResult(r('failed'))).toBe(true);
    expect(isRetryWorkResult(r('cancelled'))).toBe(true);
    expect(isRetryWorkResult(r('rejected'))).toBe(false);
    expect(isRetryWorkResult(r('uploaded'))).toBe(false);
    expect(isRetryWorkResult(r('queued'))).toBe(false);
    expect(isRetryWorkResult(null)).toBe(false);
  });

  const item = (n: number): QueueItem => ({
    id: `i${n}`,
    file: new File([new Uint8Array([1])], `f${n}.jpg`, { type: 'image/jpeg' }),
    result: null,
  });

  it('auto-retries a retryable failure with a pause, then reports the success', async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const seen: UploadFileResult[] = [];
    await runUploadQueue({
      items: [item(1)],
      concurrency: 1,
      signal: new AbortController().signal,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      uploadOne: async () => {
        calls += 1;
        return calls < 3
          ? { fileName: 'f1.jpg', status: 'failed', retryable: true, httpStatus: 502 }
          : { fileName: 'f1.jpg', status: 'uploaded', httpStatus: 201 };
      },
      onItem: (_id, result) => seen.push(result),
    });
    expect(calls).toBe(3);
    expect(sleeps).toEqual([1500, 3000]);
    expect(seen).toHaveLength(1);
    expect(seen[0].status).toBe('uploaded');
  });

  it('stops retrying after the limit and keeps the failure', async () => {
    let calls = 0;
    const seen: UploadFileResult[] = [];
    await runUploadQueue({
      items: [item(1)],
      concurrency: 1,
      signal: new AbortController().signal,
      sleep: async () => {},
      uploadOne: async () => {
        calls += 1;
        return { fileName: 'f1.jpg', status: 'failed', retryable: true, httpStatus: 503 };
      },
      onItem: (_id, result) => seen.push(result),
    });
    expect(calls).toBe(1 + AUTO_RETRY_LIMIT);
    expect(seen[0].status).toBe('failed');
  });

  it('never retries a refusal', async () => {
    let calls = 0;
    await runUploadQueue({
      items: [item(1)],
      concurrency: 1,
      signal: new AbortController().signal,
      sleep: async () => {},
      uploadOne: async () => {
        calls += 1;
        return { fileName: 'f1.jpg', status: 'rejected', httpStatus: 400, error: 'x' };
      },
      onItem: () => {},
    });
    expect(calls).toBe(1);
  });
});
