/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import BulkPhotoUploadPanel, { THUMBNAIL_STATUSES, wantsThumbnail } from '../src/components/admin/BulkPhotoUploadPanel';

// #5475: a failed upload shows a thumbnail made from the local file.

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('bulk upload thumbnails (#5475)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows a thumbnail for every status except uploaded and queued', () => {
    for (const s of THUMBNAIL_STATUSES) expect(wantsThumbnail(s)).toBe(true);
    expect(wantsThumbnail('uploaded')).toBe(false);
    expect(wantsThumbnail('queued')).toBe(false);
    expect(wantsThumbnail(undefined)).toBe(false);
  });

  it('shows a thumbnail for the rejected file only, and releases the object URLs on unmount', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    let n = 0;
    Object.assign(URL, {
      createObjectURL: vi.fn(() => {
        const u = `blob:test-${++n}`;
        created.push(u);
        return u;
      }),
      revokeObjectURL: vi.fn((u: string) => revoked.push(u)),
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const form = init?.body as FormData;
      const file = form.get('file') as File;
      if (file.name === 'IMG_0484.jpeg') {
        return jsonResponse({ ok: false, error: 'File contains an embedded marker inconsistent with an image file: "<%".' }, 400);
      }
      return jsonResponse({ ok: true, photoId: 1, id: 1, status: 'uploaded' }, 200);
    });

    const { container, getByText, findByText, unmount } = render(<BulkPhotoUploadPanel />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const bad = new File([new Uint8Array([1, 2, 3])], 'IMG_0484.jpeg', { type: 'image/jpeg' });
    const good = new File([new Uint8Array([4, 5, 6])], 'IMG_1748.jpeg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [bad, good] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await findByText(/Queued 2 file/);
    expect(container.querySelectorAll('img')).toHaveLength(0); // queued rows show none

    getByText('Start upload').click();
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(1));

    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.map((i) => i.getAttribute('alt'))).toEqual(['IMG_0484.jpeg']);
    expect(created.length).toBeGreaterThan(0);

    unmount();
    for (const u of created) expect(revoked).toContain(u);
  });
});
