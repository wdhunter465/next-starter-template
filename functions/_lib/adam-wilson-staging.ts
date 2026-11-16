// Validation for the admin-only Adam Wilson award staging surface (#4876, child of #2078).
// Validation only: no storage access and no publish path. status can only be draft or reviewed.

export const AWARD_KINDS = ['purpose', 'criteria', 'honoree_entry', 'draft'] as const;
export const AWARD_STATUSES = ['draft', 'reviewed'] as const;
export const AWARD_CONSENTS = ['unknown', 'requested', 'given', 'declined'] as const;

export type AwardStagingInput = {
  id: number | null;
  kind: (typeof AWARD_KINDS)[number];
  title: string;
  body_md: string;
  status: (typeof AWARD_STATUSES)[number];
  honoree_consent: (typeof AWARD_CONSENTS)[number];
  notes: string;
};

export type AwardValidation = { ok: true; value: AwardStagingInput } | { ok: false; error: string };

const oneOf = <T extends readonly string[]>(list: T, v: unknown): v is T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

export function validateAwardStagingInput(raw: unknown): AwardValidation {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kind = body.kind;
  if (!oneOf(AWARD_KINDS, kind)) return { ok: false, error: 'kind must be purpose, criteria, honoree_entry or draft.' };
  const status = body.status ?? 'draft';
  if (!oneOf(AWARD_STATUSES, status)) return { ok: false, error: 'status must be draft or reviewed. Staging content cannot be published.' };
  const consent = body.honoree_consent ?? 'unknown';
  if (!oneOf(AWARD_CONSENTS, consent)) return { ok: false, error: 'honoree_consent must be unknown, requested, given or declined.' };
  const title = String(body.title ?? '').trim();
  if (!title || title.length > 200) return { ok: false, error: 'title is required (200 characters at most).' };
  const body_md = String(body.body_md ?? '').trim();
  if (body_md.length > 20000) return { ok: false, error: 'body_md is too long (20000 characters at most).' };
  const notes = String(body.notes ?? '').trim();
  if (notes.length > 5000) return { ok: false, error: 'notes is too long (5000 characters at most).' };
  let id: number | null = null;
  if (body.id !== undefined && body.id !== null && body.id !== '') {
    id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'id must be a positive integer.' };
  }
  return { ok: true, value: { id, kind, title, body_md, status, honoree_consent: consent, notes } };
}

// Minimal D1 and handler-context shapes for the three admin handlers (no storage access happens in this file).
export type AwardStatement = {
  bind(...values: unknown[]): {
    all(): Promise<{ results?: unknown[] }>;
    run(): Promise<{ meta?: { changes?: number; last_row_id?: number } }>;
  };
  all(): Promise<{ results?: unknown[] }>;
};
export type AwardContext = {
  request: Request;
  env: { DB: { prepare(sql: string): AwardStatement } };
};
