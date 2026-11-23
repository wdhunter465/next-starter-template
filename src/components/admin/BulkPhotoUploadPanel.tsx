'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AdminStatusText from '@/components/admin/AdminStatusText';
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
  suggestBatchId,
  summarizeResults,
  type BulkRightsClass,
  type QueueItem,
  type UploadFileResult,
} from '@/lib/bulkPhotoUpload';

const CONCURRENCY = 3;
const ENDPOINT = '/api/admin/photos/bulk-upload';
const HEIC_GUIDANCE =
  'HEIC/HEIF is not accepted here. Export as JPEG from Apple Photos, then drop the JPEG.';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// #5475: statuses whose row shows a thumbnail, so a failed picture can be recognised by sight.
// Uploaded and queued rows show none, which keeps memory low for large batches.
export const THUMBNAIL_STATUSES = ['failed', 'rejected', 'check_these', 'duplicate_skipped', 'cancelled'];

export function wantsThumbnail(status: string | undefined): boolean {
  return status !== undefined && THUMBNAIL_STATUSES.includes(status);
}

// A preview made in the browser from the file the person chose. Nothing is uploaded or stored.
function FileThumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let created: string | null = null;
    try {
      created = URL.createObjectURL(file);
      setUrl(created);
    } catch {
      setUrl(null);
    }
    return () => {
      if (created) URL.revokeObjectURL(created);
    };
  }, [file]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={file.name}
      width={96}
      height={96}
      style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
    />
  );
}

function downloadBlob(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkPhotoUploadPanel() {
  const [batchId, setBatchId] = useState(() => suggestBatchId());
  const [rightsClass, setRightsClass] = useState<BulkRightsClass>('lgfc_collection');
  const [source, setSource] = useState('');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [status, setStatus] = useState('Set batch options, then drop files.');
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(
    () => items.map((i) => i.result).filter((r): r is UploadFileResult => r !== null),
    [items],
  );
  const counts = useMemo(() => summarizeResults(results), [results]);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const next: QueueItem[] = [];
    const rejectedHeic: string[] = [];
    for (const file of Array.from(fileList)) {
      if (isHeicClientFileName(file.name)) {
        rejectedHeic.push(file.name);
        continue;
      }
      if (!isAcceptedImageFile(file)) continue;
      next.push({
        id: newId(),
        file,
        result: {
          fileName: file.name,
          status: 'queued',
        },
      });
    }
    if (rejectedHeic.length) {
      setStatus(`Error: ${HEIC_GUIDANCE} Skipped: ${rejectedHeic.slice(0, 5).join(', ')}`);
    }
    if (next.length) {
      setItems((prev) => [...prev, ...next]);
      if (!rejectedHeic.length) setStatus(`Queued ${next.length} file(s).`);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const uploadOne = useCallback(
    async (item: QueueItem, signal: AbortSignal): Promise<UploadFileResult> => {
      const form = buildBulkUploadFormData({
        file: item.file,
        batchId,
        rightsClass,
        source: rightsClass === 'someone_elses' ? source : undefined,
      });
      // Guard: never attach publish
      if (form.has('publish') || form.has('published')) {
        return {
          fileName: item.file.name,
          status: 'failed',
          error: 'publish field must never be sent',
          batchId,
          rightsClass,
        };
      }
      const raw = await adminMultipartUpload(ENDPOINT, form, { signal });
      return classifyUploadResponse(item.file.name, raw, { batchId, rightsClass });
    },
    [batchId, rightsClass, source],
  );

  const startRun = useCallback(
    async (onlyFailed: boolean) => {
      if (!isValidBulkBatchId(batchId)) {
        setStatus('Error: Invalid batch id (1–64 of A–Z a–z 0–9 . _ -; not .. or dots-only).');
        return;
      }
      if (rightsClass === 'someone_elses' && !source.trim()) {
        setStatus("Error: Source is required when rights class is Someone else's.");
        return;
      }

      const work = items.filter((i) => {
        if (!onlyFailed) return !i.result || i.result.status === 'queued';
        return (
          i.result &&
          (i.result.status === 'failed' || i.result.status === 'rejected' || i.result.status === 'cancelled')
        );
      });
      if (!work.length) {
        setStatus(onlyFailed ? 'No failed items to retry.' : 'No queued files.');
        return;
      }

      const ac = new AbortController();
      abortRef.current = ac;
      setRunning(true);
      setStatus(onlyFailed ? 'Retrying failed…' : 'Uploading…');

      const { stoppedAuth } = await runUploadQueue({
        items: work,
        concurrency: CONCURRENCY,
        signal: ac.signal,
        uploadOne,
        onItem: (id, result) => {
          setItems((prev) => prev.map((it) => (it.id === id ? { ...it, result } : it)));
        },
      });

      setRunning(false);
      abortRef.current = null;
      if (ac.signal.aborted) {
        setStatus('Upload cancelled.');
        return;
      }
      if (stoppedAuth) {
        setStatus('Error: Admin session required (401/403). Upload stopped.');
        return;
      }
      setStatus('Batch pass finished. Review results below.');
    },
    [batchId, items, rightsClass, source, uploadOne],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    border: '1px solid rgba(0,0,0,0.16)',
    borderRadius: 10,
    padding: '10px 12px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? 'rgba(0,0,0,0.05)' : 'var(--lgfc-bg-card)',
  });

  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
      <p style={{ margin: 0, opacity: 0.9 }}>
        Every upload lands <strong>unpublished</strong> and on <strong>rights hold</strong>. Nothing is
        published or deleted from this page.
      </p>

      <fieldset style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 12, padding: 12 }}>
        <legend style={{ fontWeight: 800 }}>Batch settings</legend>
        <label style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
          <span>Batch id</span>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            disabled={running}
            style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.16)' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name="rights"
              checked={rightsClass === 'lgfc_collection'}
              disabled={running}
              onChange={() => setRightsClass('lgfc_collection')}
            />
            LGFC-owned
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="radio"
              name="rights"
              checked={rightsClass === 'someone_elses'}
              disabled={running}
              onChange={() => setRightsClass('someone_elses')}
            />
            Someone else&apos;s, rights unknown
          </label>
        </div>
        {rightsClass === 'lgfc_collection' ? (
          <p style={{ margin: '0 0 8px', opacity: 0.85 }}>
            LGFC-owned batches still stay on rights hold until Product Authority records ownership
            evidence.
          </p>
        ) : (
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Source (required)</span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={running}
              placeholder="Where this batch came from"
              style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.16)' }}
            />
          </label>
        )}
      </fieldset>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        style={{
          border: '2px dashed rgba(0,0,0,0.22)',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          background: 'rgba(0,0,0,0.02)',
        }}
      >
        <p style={{ marginTop: 0, fontWeight: 700 }}>Drop JPEG, PNG, or WebP files here</p>
        <p style={{ opacity: 0.8 }}>{HEIC_GUIDANCE}</p>
        <button type="button" style={btnStyle(running)} disabled={running} onClick={() => inputRef.current?.click()}>
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" style={btnStyle(running)} disabled={running} onClick={() => void startRun(false)}>
          Start upload
        </button>
        <button type="button" style={btnStyle(!running)} disabled={!running} onClick={cancel}>
          Cancel
        </button>
        <button type="button" style={btnStyle(running)} disabled={running} onClick={() => void startRun(true)}>
          Retry failed
        </button>
        <button
          type="button"
          style={btnStyle(results.length === 0)}
          disabled={results.length === 0}
          onClick={() => downloadBlob(`bulk-report-${batchId}.csv`, resultsToCsv(results), 'text/csv')}
        >
          Download CSV
        </button>
        <button
          type="button"
          style={btnStyle(results.length === 0)}
          disabled={results.length === 0}
          onClick={() =>
            downloadBlob(`bulk-report-${batchId}.json`, resultsToJson(results), 'application/json')
          }
        >
          Download JSON
        </button>
      </div>

      {status.startsWith('Error:') ? (
        <AdminStatusText message={status} />
      ) : (
        <p style={{ margin: 0, opacity: 0.85 }}>{status}</p>
      )}

      <div style={{ opacity: 0.9 }}>
        Counts — uploaded {counts.uploaded}, duplicate {counts.duplicate_skipped}, rejected{' '}
        {counts.rejected}, check-these {counts.check_these}, failed {counts.failed}, cancelled{' '}
        {counts.cancelled}, queued {items.filter((i) => !i.result || i.result.status === 'queued').length}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((item) => {
          const r = item.result;
          return (
            <div
              key={item.id}
              style={{
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                padding: 10,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              {wantsThumbnail(r?.status) ? <FileThumbnail file={item.file} /> : null}
              <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800 }}>{item.file.name}</div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>
                {r?.status || 'queued'}
                {r?.error ? ` — ${r.error}` : ''}
              </div>
              {r?.reasons?.length ? (
                <div style={{ opacity: 0.8, marginTop: 4 }}>reasons: {r.reasons.join(', ')}</div>
              ) : null}
              {r?.screenshotReasons?.length ? (
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  screenshot: {r.screenshotReasons.join(', ')}
                </div>
              ) : null}
              {r?.flatCopyReasons?.length ? (
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  flat-copy: {r.flatCopyReasons.join(', ')}
                </div>
              ) : null}
              {r?.identicalPhashPhotoId != null ? (
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  identical phash photo id: {r.identicalPhashPhotoId} (note only)
                </div>
              ) : null}
              {r?.nearDuplicateMatches?.length ? (
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  near-duplicate photo ids:{' '}
                  {r.nearDuplicateMatches
                    .map((m) => `${m.photoId} (distance ${m.distance})`)
                    .join(', ')}
                </div>
              ) : null}
              {r?.status === 'check_these' ? (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  Check list is read-only in this slice.{' '}
                  <Link href="/admin/rights-review">Open rights review</Link>
                </div>
              ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
