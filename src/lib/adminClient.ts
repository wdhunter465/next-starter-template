'use client';

export type AdminJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type AdminDownloadResult = {
  ok: boolean;
  status: number;
  error: string;
  filename: string;
  blob: Blob | null;
};

export async function adminDownload(path: string): Promise<AdminDownloadResult> {
  try {
    const response = await fetch(path, { credentials: 'include', cache: 'no-store' });
    const contentType = response.headers.get('Content-Type') || '';
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const filename = filenameMatch?.[1] || 'export.csv';

    if (!response.ok) {
      const data: unknown = await response.json().catch(() => ({}));
      const error = isRecord(data) && typeof data.error === 'string' ? data.error : `HTTP ${response.status}`;
      return { ok: false, status: response.status, error, filename, blob: null };
    }

    if (!contentType.includes('text/csv')) {
      return {
        ok: false,
        status: response.status,
        error: 'Export did not return CSV.',
        filename,
        blob: null,
      };
    }

    const blob = await response.blob();
    return { ok: true, status: response.status, error: '', filename, blob };
  } catch {
    return { ok: false, status: 0, error: 'Download failed.', filename: 'export.csv', blob: null };
  }
}

export async function adminJson<T>(path: string, init: RequestInit = {}): Promise<AdminJsonResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  try {
    const response = await fetch(path, {
      ...init,
      headers,
      credentials: init.credentials ?? 'include',
      cache: init.cache ?? 'no-store',
    });
    const data: unknown = await response.json().catch(() => ({}));
    const ok = isRecord(data) && data.ok === true;
    const error = isRecord(data) && typeof data.error === 'string' ? data.error : `HTTP ${response.status}`;

    return {
      ok,
      status: response.status,
      data: ok ? (data as T) : null,
      error,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: 'Request failed.',
    };
  }
}
