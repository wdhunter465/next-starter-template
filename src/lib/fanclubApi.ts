export function buildFanclubPhotoListApiUrl(options?: {
  limit?: number;
  offset?: number;
  memorabilia?: boolean;
  q?: string;
  tags?: string;
}): string {
  const params = new URLSearchParams();

  if (typeof options?.offset === 'number' && Number.isFinite(options.offset)) {
    const page = Math.floor(options.offset / (options?.limit || 24)) + 1;
    params.set('page', String(Math.max(1, page)));
  }

  const q = options?.q?.trim();
  if (q) params.set('q', q);

  const tags = options?.tags?.trim();
  if (tags) params.set('tags', tags);

  const path = options?.memorabilia ? '/api/fanclub/memorabilia' : '/api/fanclub/photos';
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Deep-link helper for #2900 photo detail (`/fanclub/photo?id=<n>`). */
export function buildFanclubPhotoDetailHref(photoId: number): string {
  const id = Math.trunc(Number(photoId));
  if (!Number.isFinite(id) || id <= 0) return '/fanclub/photo';
  return `/fanclub/photo?id=${id}`;
}
