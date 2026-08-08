// #2900 — authorized member-photo moderation (approve/reject pending rows).
// Side effects: D1 status/review metadata updates; optional B2 promote of
// quarantine objects to a published key. No Production activation authority.

import { AwsClient } from './aws4fetch';
import { requireB2, type B2Bindings } from './b2';

export type PhotoModerationAction = 'approve' | 'reject';

export type PendingPhotoRow = {
  id: number;
  url: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  status: string;
  submitted_by: string | null;
  submitted_at: string | null;
  quarantine_key: string | null;
  consent_confirmed: number;
  credit_line: string | null;
  rights_owner: string | null;
  moderation_notes: string | null;
};

export async function photosHasStatusColumn(db: any): Promise<boolean> {
  try {
    const result = await db.prepare(`PRAGMA table_info(photos)`).all();
    const names = new Set((result?.results || []).map((row: any) => row.name));
    return names.has('status');
  } catch {
    return false;
  }
}

function makeAwsClient(cfg: B2Bindings) {
  return new AwsClient({
    accessKeyId: cfg.B2_KEY_ID,
    secretAccessKey: cfg.B2_APP_KEY,
    sessionToken: undefined,
    service: 's3',
    region: undefined,
    cache: undefined,
    retries: 2,
    initRetryMs: undefined,
  });
}

function b2ObjectUrl(cfg: B2Bindings, key: string): string {
  const pathBucket = cfg.B2_BUCKET.split('/').map(encodeURIComponent).join('/');
  const pathKey = key.split('/').map(encodeURIComponent).join('/');
  return `${cfg.B2_ENDPOINT}/${pathBucket}/${pathKey}`;
}

export function publishedKeyFromQuarantine(quarantineKey: string): string {
  const base = String(quarantineKey || '').trim();
  if (!base) return '';
  if (base.includes('/quarantine/')) {
    return base.replace('/quarantine/', '/published/');
  }
  const file = base.split('/').pop() || `photo-${Date.now()}.bin`;
  return `member-photos/published/${file}`;
}

export async function listPendingPhotos(
  db: any,
  { limit = 50 }: { limit?: number } = {},
): Promise<{ ok: true; items: PendingPhotoRow[] } | { ok: false; error: string; code: string }> {
  if (!(await photosHasStatusColumn(db))) {
    return { ok: false, error: 'Pending photo schema is not available.', code: 'SCHEMA_UNAVAILABLE' };
  }
  const capped = Math.max(1, Math.min(100, Math.floor(limit)));
  try {
    const rows = await db
      .prepare(
        `SELECT id, url, title, description, tags, status, submitted_by, submitted_at,
                quarantine_key, consent_confirmed, credit_line, rights_owner, moderation_notes
           FROM photos
          WHERE status = 'pending'
          ORDER BY id ASC
          LIMIT ?`,
      )
      .bind(capped)
      .all();
    return { ok: true, items: (rows.results || []) as PendingPhotoRow[] };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), code: 'LIST_FAILED' };
  }
}

async function promoteQuarantineObject(
  env: Record<string, unknown>,
  quarantineKey: string,
): Promise<{ ok: true; publishedKey: string } | { ok: false; error: string }> {
  const b2 = requireB2(env);
  if (!b2.ok) {
    return { ok: false, error: 'B2 is not configured; cannot promote quarantine object.' };
  }
  const cfg = b2.cfg;
  const publishedKey = publishedKeyFromQuarantine(quarantineKey);
  if (!publishedKey) return { ok: false, error: 'Invalid quarantine key.' };

  try {
    const aws = makeAwsClient(cfg);
    const getRes = await aws.fetch(b2ObjectUrl(cfg, quarantineKey), { method: 'GET' });
    if (!getRes.ok) {
      const text = await getRes.text();
      return { ok: false, error: `B2 GET quarantine failed: HTTP ${getRes.status} ${text.slice(0, 200)}` };
    }
    const bytes = new Uint8Array(await getRes.arrayBuffer());
    const contentType = getRes.headers.get('content-type') || 'application/octet-stream';
    const putRes = await aws.fetch(b2ObjectUrl(cfg, publishedKey), {
      method: 'PUT',
      body: bytes,
      headers: { 'Content-Type': contentType },
    });
    if (!putRes.ok) {
      const text = await putRes.text();
      return { ok: false, error: `B2 PUT published failed: HTTP ${putRes.status} ${text.slice(0, 200)}` };
    }
    return { ok: true, publishedKey };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'B2 promote failed' };
  }
}

export async function reviewPendingPhoto(
  db: any,
  env: Record<string, unknown>,
  params: {
    photoId: number;
    action: PhotoModerationAction;
    reviewer: string;
    notes?: string | null;
    /** Test/offline hook: skip B2 and publish in place when quarantine key exists. */
    skipObjectPromote?: boolean;
  },
): Promise<
  | { ok: true; id: number; status: 'published' | 'rejected'; publishedKey?: string }
  | { ok: false; error: string; code: string; status?: number }
> {
  if (!(await photosHasStatusColumn(db))) {
    return { ok: false, error: 'Pending photo schema is not available.', code: 'SCHEMA_UNAVAILABLE', status: 503 };
  }

  const photoId = Number(params.photoId);
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return { ok: false, error: 'Invalid photo id.', code: 'INVALID_ID', status: 400 };
  }
  if (params.action !== 'approve' && params.action !== 'reject') {
    return { ok: false, error: 'Action must be approve or reject.', code: 'INVALID_ACTION', status: 400 };
  }
  const reviewer = String(params.reviewer || '').trim().toLowerCase();
  if (!reviewer) {
    return { ok: false, error: 'Reviewer identity is required.', code: 'REVIEWER_REQUIRED', status: 400 };
  }

  const row = await db
    .prepare(
      `SELECT id, status, url, quarantine_key
         FROM photos
        WHERE id = ?
        LIMIT 1`,
    )
    .bind(photoId)
    .first();

  if (!row) {
    return { ok: false, error: 'Photo not found.', code: 'NOT_FOUND', status: 404 };
  }
  if (String((row as any).status) !== 'pending') {
    return { ok: false, error: 'Only pending photos can be reviewed.', code: 'NOT_PENDING', status: 409 };
  }

  const notes = params.notes ? String(params.notes).slice(0, 2000) : null;

  if (params.action === 'reject') {
    await db
      .prepare(
        `UPDATE photos
            SET status = 'rejected',
                reviewed_by = ?,
                reviewed_at = datetime('now'),
                moderation_notes = ?
          WHERE id = ? AND status = 'pending'`,
      )
      .bind(reviewer, notes, photoId)
      .run();
    return { ok: true, id: photoId, status: 'rejected' };
  }

  const quarantineKey = String((row as any).quarantine_key || (row as any).url || '').trim();
  let publishedKey = quarantineKey;

  if (quarantineKey && !params.skipObjectPromote) {
    const promoted = await promoteQuarantineObject(env, quarantineKey);
    if (!promoted.ok) {
      return { ok: false, error: promoted.error, code: 'PROMOTE_FAILED', status: 503 };
    }
    publishedKey = promoted.publishedKey;
  } else if (quarantineKey && params.skipObjectPromote) {
    publishedKey = publishedKeyFromQuarantine(quarantineKey) || quarantineKey;
  }

  await db
    .prepare(
      `UPDATE photos
          SET status = 'published',
              url = ?,
              reviewed_by = ?,
              reviewed_at = datetime('now'),
              moderation_notes = ?
        WHERE id = ? AND status = 'pending'`,
    )
    .bind(publishedKey || (row as any).url, reviewer, notes, photoId)
    .run();

  return { ok: true, id: photoId, status: 'published', publishedKey };
}
