// P1-07 (#3419/#4077) rendition contract. Mirrors
// functions/_lib/content-inventory-media.ts's RENDITION_SIZES /
// RENDITION_LONG_EDGE_PX exactly — src/ does not import functions/_lib, so
// this is kept in sync by hand. The server independently recomputes and
// validates these dimensions from the declared source size
// (validatePersistedRenditionDimensions), so a mismatch here fails closed
// server-side rather than silently persisting wrong dimensions.
export const RENDITION_SIZES = ['thumbnail', 'small', 'medium', 'large'] as const;
export type RenditionSize = (typeof RENDITION_SIZES)[number];
export const RENDITION_LONG_EDGE_PX: Record<RenditionSize, number> = {
  thumbnail: 320,
  small: 640,
  medium: 1280,
  large: 1920,
};
export const RENDITION_OUTPUT_CONTENT_TYPE = 'image/jpeg';

/** Aspect-preserving long-edge resize; never upscales. Must match the server's computeRenditionDimensions exactly. */
export function computeRenditionDimensions(sourceWidth: number, sourceHeight: number, size: RenditionSize): { width: number; height: number } {
  const contract = RENDITION_LONG_EDGE_PX[size];
  const sourceLong = Math.max(sourceWidth, sourceHeight);
  if (sourceLong <= contract) return { width: sourceWidth, height: sourceHeight };
  const scale = contract / sourceLong;
  return { width: Math.max(1, Math.round(sourceWidth * scale)), height: Math.max(1, Math.round(sourceHeight * scale)) };
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the source image (check CORS / B2 public access).'));
    img.src = url;
  });
}

function canvasToJpegBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL(RENDITION_OUTPUT_CONTENT_TYPE, 0.85);
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  return idx >= 0 ? dataUrl.slice(idx + marker.length) : '';
}

export type RenditionPayloadItem = {
  media_id: number;
  size: RenditionSize;
  source_width: number;
  source_height: number;
  width_px: number;
  height_px: number;
  content_type: string;
  bytes_base64: string;
};

/**
 * Browser-side Canvas resize per the accepted D5 decision (#4077): no
 * server-side image processing, no new paid provider. Dimensions are
 * computed with computeRenditionDimensions so they match what the server's
 * validatePersistedRenditionDimensions independently recomputes and checks
 * from the declared source_width/source_height - this function cannot make
 * the server accept mismatched dimensions, only fail to match them.
 */
export async function buildRenditionPayload(mediaId: number, url: string): Promise<{ ok: true; items: RenditionPayloadItem[] } | { ok: false; error: string }> {
  let img: HTMLImageElement;
  try {
    img = await loadImageElement(url);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not load source image.' };
  }

  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;
  if (!sourceWidth || !sourceHeight) {
    return { ok: false, error: 'Source image has no usable dimensions.' };
  }

  const items: RenditionPayloadItem[] = [];
  for (const size of RENDITION_SIZES) {
    const { width, height } = computeRenditionDimensions(sourceWidth, sourceHeight, size);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { ok: false, error: 'Canvas 2D context is not available in this browser.' };
    }
    ctx.drawImage(img, 0, 0, width, height);
    items.push({
      media_id: mediaId,
      size,
      source_width: sourceWidth,
      source_height: sourceHeight,
      width_px: width,
      height_px: height,
      content_type: RENDITION_OUTPUT_CONTENT_TYPE,
      bytes_base64: canvasToJpegBase64(canvas),
    });
  }
  return { ok: true, items };
}
