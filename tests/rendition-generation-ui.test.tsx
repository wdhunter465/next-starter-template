import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RenditionGenerationControl from '@/components/admin/RenditionGenerationControl';
import {
  RENDITION_LONG_EDGE_PX as CLIENT_RENDITION_LONG_EDGE_PX,
  RENDITION_SIZES as CLIENT_RENDITION_SIZES,
  computeRenditionDimensions,
  type RenditionSize,
} from '@/lib/renditionGeneration';
import {
  RENDITION_LONG_EDGE_PX as SERVER_RENDITION_LONG_EDGE_PX,
  RENDITION_SIZES as SERVER_RENDITION_SIZES,
  computeRenditionDimensions as serverComputeRenditionDimensions,
} from '../functions/_lib/content-inventory-media';

const FAKE_JPEG_BASE64 = 'ZmFrZS1qcGVn'; // "fake-jpeg"

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  crossOrigin: string | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    // Resolve synchronously-ish (next microtask) so tests can await it.
    queueMicrotask(() => {
      if (!value) {
        this.onerror?.();
        return;
      }
      this.naturalWidth = 4000;
      this.naturalHeight = 3000;
      this.onload?.();
    });
  }
}

describe('#4077 rendition generation contract', () => {
  it('client contract constants match the server contract exactly', () => {
    expect(CLIENT_RENDITION_SIZES).toEqual(SERVER_RENDITION_SIZES);
    expect(CLIENT_RENDITION_LONG_EDGE_PX).toEqual(SERVER_RENDITION_LONG_EDGE_PX);
  });

  it('computeRenditionDimensions matches the server for a downscale case', () => {
    for (const size of CLIENT_RENDITION_SIZES) {
      const client = computeRenditionDimensions(4000, 3000, size);
      const server = serverComputeRenditionDimensions(4000, 3000, size);
      expect('ok' in server ? null : server).toMatchObject(client);
    }
  });

  it('never upscales when the source is already smaller than the contract', () => {
    const dims = computeRenditionDimensions(200, 100, 'large');
    expect(dims).toEqual({ width: 200, height: 100 });
  });

  it('preserves aspect ratio when downscaling', () => {
    const dims = computeRenditionDimensions(4000, 2000, 'thumbnail');
    expect(dims.width).toBe(320);
    expect(dims.height).toBe(160);
  });
});

describe('#4077 RenditionGenerationControl', () => {
  const originalImage = globalThis.Image;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  beforeEach(() => {
    // @ts-expect-error - test double, not a full Image implementation
    globalThis.Image = FakeImage;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => `data:image/jpeg;base64,${FAKE_JPEG_BASE64}`);
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    vi.restoreAllMocks();
  });

  it('generates all four rendition sizes with contract-matching dimensions and persists them', async () => {
    type PersistRenditionsBody = {
      action: string;
      story_id: number;
      renditions: Array<{
        media_id: number;
        size: string;
        source_width: number;
        source_height: number;
        width_px: number;
        height_px: number;
        content_type: string;
        bytes_base64: string;
      }>;
    };
    let capturedBody: PersistRenditionsBody | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      capturedBody = JSON.parse(String((init as RequestInit).body)) as PersistRenditionsBody;
      return new Response(
        JSON.stringify({
          ok: true,
          story_id: 7,
          renditions: capturedBody.renditions.map((r) => ({ media_id: r.media_id, size: r.size, status: 'ready' })),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const onStatus = vi.fn();
    render(
      <RenditionGenerationControl storyId={7} mediaId={42} url="https://cdn.example/photo.jpg" onStatus={onStatus} actionsEnabled />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Generate/i }));

    await waitFor(() => expect(capturedBody).not.toBeNull());
    const body = capturedBody as unknown as PersistRenditionsBody;

    expect(body.action).toBe('persist_renditions');
    expect(body.story_id).toBe(7);
    expect(body.renditions).toHaveLength(4);

    for (const item of body.renditions) {
      expect(item.media_id).toBe(42);
      expect(item.source_width).toBe(4000);
      expect(item.source_height).toBe(3000);
      expect(item.content_type).toBe('image/jpeg');
      expect(item.bytes_base64).toBe(FAKE_JPEG_BASE64);

      const expected = computeRenditionDimensions(4000, 3000, item.size as RenditionSize);
      expect(item.width_px).toBe(expected.width);
      expect(item.height_px).toBe(expected.height);
      // Cross-check against the real server validator's own math too.
      const serverExpected = serverComputeRenditionDimensions(4000, 3000, item.size as RenditionSize);
      expect('ok' in serverExpected ? null : serverExpected).toMatchObject(expected);
    }

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('all 4 rendition sizes generated and persisted')));
  });

  it('fails closed by disabling the trigger (not by allowing a click) when there is no source URL', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<RenditionGenerationControl storyId={7} mediaId={42} url={null} onStatus={vi.fn()} actionsEnabled />);

    const button = screen.getByRole('button', { name: /Generate/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('disables the trigger when actionsEnabled is false', () => {
    render(
      <RenditionGenerationControl storyId={7} mediaId={42} url="https://cdn.example/photo.jpg" onStatus={vi.fn()} actionsEnabled={false} />,
    );
    expect(screen.getByRole('button', { name: /Generate/i })).toBeDisabled();
  });
});
