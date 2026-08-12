// Deterministic editorial rotation scoring and selection for content_inventory.

import { publishedInventoryWhere } from './content-inventory-public';

export const HOMEPAGE_SPOTLIGHT_SECTION = 'homepage_spotlight';
export const HOMEPAGE_DISCUSSIONS_SECTION = 'homepage_discussions';
export const HOMEPAGE_MILESTONES_SECTION = 'homepage_milestones';

export const DEFAULT_RECENT_FEATURE_WINDOW_DAYS = 90;
export const DEFAULT_EVENT_PROXIMITY_WINDOW_DAYS = 30;
/** Hard recent-use exclusion window (#2663 / content-strategy.md). Soft 90-day penalty remains after this. */
export const DEFAULT_HARD_COOLDOWN_DAYS = 14;
const USAGE_COUNT_SCORE_PENALTY = 30;

export type RotationRow = {
  id: number;
  title?: string | null;
  priority?: number | null;
  canonical?: number | boolean | null;
  event_date?: string | null;
  event_year?: number | string | null;
  rotation_group?: string | null;
  last_featured?: string | null;
  usage_count?: number | null;
  feature_weight?: number | null;
  allowed_sections?: string | null;
  status?: string | null;
  source_name?: string | null;
  credit_line?: string | null;
  updated_at?: string | null;
};

export type RotationContext = {
  asOfDate?: Date;
  includeAlternates?: boolean;
  recentFeaturedGroupCounts?: Record<string, number>;
  recentFeatureWindowDays?: number;
  eventProximityWindowDays?: number;
  hardCooldownDays?: number;
  /** When true (default), if every candidate is in hard cooldown, fall back to the soft-penalty pool. */
  relaxHardCooldownWhenEmpty?: boolean;
};

export type FetchRotationRankedOptions = {
  sectionKey: string;
  limit?: number;
  offset?: number;
  q?: string;
  includeAlternates?: boolean;
  asOfDate?: Date;
  recentFeaturedGroupCounts?: Record<string, number>;
};

function normalizeCanonical(value: RotationRow['canonical']): boolean {
  return Number(value) === 1 || value === true;
}

function normalizeTitle(value: RotationRow['title']): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseEventYear(value: RotationRow['event_year']): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function daysUntilAnniversary(eventDate: string, asOf: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(eventDate || '').trim());
  if (!match) return null;

  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const year = asOf.getUTCFullYear();
  const asOfUtc = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  let candidate = Date.UTC(year, month - 1, day);
  if (candidate < asOfUtc) {
    candidate = Date.UTC(year + 1, month - 1, day);
  }
  return Math.round((candidate - asOfUtc) / 86_400_000);
}

export function parseRotationTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  let dateStr = String(value).trim();
  if (!dateStr) return null;
  if (dateStr.length === 19 && !dateStr.includes('T')) {
    dateStr = `${dateStr.replace(' ', 'T')}Z`;
  }
  const parsed = Date.parse(dateStr);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeRecentFeaturePenalty(
  row: RotationRow,
  asOf: Date,
  windowDays = DEFAULT_RECENT_FEATURE_WINDOW_DAYS,
): number {
  const featuredAt = parseRotationTimestamp(row.last_featured);
  if (featuredAt === null) return 0;

  const daysSince = (asOf.getTime() - featuredAt) / 86_400_000;
  if (daysSince < 0 || daysSince >= windowDays) return 0;
  return Math.round(120 * (1 - daysSince / windowDays));
}

export function computeEventProximityBoost(
  row: RotationRow,
  asOf: Date,
  windowDays = DEFAULT_EVENT_PROXIMITY_WINDOW_DAYS,
): number {
  let boost = 0;
  const eventDate = typeof row.event_date === 'string' ? row.event_date.trim() : '';
  if (eventDate) {
    const days = daysUntilAnniversary(eventDate, asOf);
    if (days !== null && days <= windowDays) {
      boost += Math.round(80 * (1 - days / windowDays));
    }
  }

  const eventYear = parseEventYear(row.event_year);
  const currentYear = asOf.getUTCFullYear();
  if (eventYear !== null && eventYear > 0) {
    if (eventYear === currentYear) boost += 60;
    const age = currentYear - eventYear;
    if (age > 0 && age % 25 === 0) boost += 40;
  }

  return boost;
}

export function computeRotationGroupPenalty(
  row: RotationRow,
  recentFeaturedGroupCounts?: Record<string, number>,
): number {
  const group = String(row.rotation_group || '').trim().toLowerCase();
  if (!group || !recentFeaturedGroupCounts?.[group]) return 0;
  return recentFeaturedGroupCounts[group] * 40;
}

export function normalizeUsageCount(value: RotationRow['usage_count']): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

export function isWithinHardCooldown(
  row: RotationRow,
  asOf: Date,
  cooldownDays = DEFAULT_HARD_COOLDOWN_DAYS,
): boolean {
  const featuredAt = parseRotationTimestamp(row.last_featured);
  if (featuredAt === null) return false;
  const daysSince = (asOf.getTime() - featuredAt) / 86_400_000;
  return daysSince >= 0 && daysSince < cooldownDays;
}

/**
 * Apply hard recent-use exclusion. If every row is cooling down and relaxation is
 * enabled, return the original pool so surfaces can still render (soft penalty remains).
 */
export function filterRotationFairnessPool<T extends RotationRow>(
  rows: T[],
  context: RotationContext = {},
): T[] {
  if (!rows.length) return rows;
  const asOf = context.asOfDate ?? new Date();
  const cooldownDays = context.hardCooldownDays ?? DEFAULT_HARD_COOLDOWN_DAYS;
  const outsideCooldown = rows.filter((row) => !isWithinHardCooldown(row, asOf, cooldownDays));
  if (outsideCooldown.length) return outsideCooldown;
  if (context.relaxHardCooldownWhenEmpty === false) return [];
  return rows;
}

export function computeRotationScore(row: RotationRow, context: RotationContext = {}): number {
  const asOf = context.asOfDate ?? new Date();
  const priority = Number(row.priority ?? 0);
  const featureWeight = Math.max(1, Number(row.feature_weight ?? 1));

  let score = priority * 100;
  score += featureWeight * 50;
  score += computeEventProximityBoost(row, asOf, context.eventProximityWindowDays);
  score -= computeRecentFeaturePenalty(row, asOf, context.recentFeatureWindowDays);
  score -= computeRotationGroupPenalty(row, context.recentFeaturedGroupCounts);
  score -= normalizeUsageCount(row.usage_count) * USAGE_COUNT_SCORE_PENALTY;

  if (!context.includeAlternates && !normalizeCanonical(row.canonical)) {
    score -= 200;
  }

  return score;
}

export function compareRotationRows(a: RotationRow, b: RotationRow, context: RotationContext = {}): number {
  const scoreDelta = computeRotationScore(b, context) - computeRotationScore(a, context);
  if (scoreDelta !== 0) return scoreDelta;

  // Least-used preference after score (contract: prefer least-used eligible row).
  const usageDelta = normalizeUsageCount(a.usage_count) - normalizeUsageCount(b.usage_count);
  if (usageDelta !== 0) return usageDelta;

  const canonicalDelta = Number(normalizeCanonical(b.canonical)) - Number(normalizeCanonical(a.canonical));
  if (canonicalDelta !== 0) return canonicalDelta;

  const priorityDelta = Number(b.priority ?? 0) - Number(a.priority ?? 0);
  if (priorityDelta !== 0) return priorityDelta;

  const weightDelta = Number(b.feature_weight ?? 1) - Number(a.feature_weight ?? 1);
  if (weightDelta !== 0) return weightDelta;

  const titleA = normalizeTitle(a.title);
  const titleB = normalizeTitle(b.title);
  if (titleA !== titleB) return titleA < titleB ? -1 : 1;

  return Number(a.id ?? 0) - Number(b.id ?? 0);
}

export function sortRotationRows<T extends RotationRow>(rows: T[], context: RotationContext = {}): T[] {
  return [...rows].sort((left, right) => compareRotationRows(left, right, context));
}

export function isRotationEligibleRow(row: RotationRow, sectionKey: string): boolean {
  if (row.status !== 'published') return false;
  if (!String(row.allowed_sections || '').toLowerCase().includes(sectionKey.toLowerCase())) return false;
  if (!String(row.source_name || '').trim()) return false;
  if (!String(row.credit_line || '').trim()) return false;
  return true;
}

export async function fetchRotationEligibleRows(
  db: any,
  options: { sectionKey: string; q?: string },
): Promise<RotationRow[]> {
  const whereParts = [publishedInventoryWhere(options.sectionKey)];
  const args: unknown[] = [];
  const q = String(options.q || '').trim().toLowerCase();

  if (q) {
    whereParts.push(
      "(lower(COALESCE(title,'')) LIKE ? OR lower(COALESCE(text,'')) LIKE ? OR lower(COALESCE(summary,'')) LIKE ? OR lower(COALESCE(search_text,'')) LIKE ? OR lower(COALESCE(credit_line,'')) LIKE ? OR lower(COALESCE(source_name,'')) LIKE ? OR lower(COALESCE(perspective_label,'')) LIKE ?)",
    );
    const like = `%${q}%`;
    args.push(like, like, like, like, like, like, like);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;
  const rows = await db
    .prepare(
      `SELECT id, title, text, summary, credit_line, source_name, event_date, event_year,
              rotation_group, last_featured, usage_count, feature_weight, canonical, priority,
              allowed_sections, status, updated_at
       FROM content_inventory
       ${whereSql}`,
    )
    .bind(...args)
    .all();

  return (rows.results ?? []) as RotationRow[];
}

export async function fetchRotationRankedInventory<T extends RotationRow>(
  db: any,
  options: FetchRotationRankedOptions,
): Promise<{ items: T[]; total: number }> {
  const limit = Math.max(1, Number(options.limit ?? 20) || 20);
  const offset = Math.max(0, Number(options.offset ?? 0) || 0);
  const context: RotationContext = {
    asOfDate: options.asOfDate,
    includeAlternates: options.includeAlternates,
    recentFeaturedGroupCounts: options.recentFeaturedGroupCounts,
  };

  const eligible = (await fetchRotationEligibleRows(db, {
    sectionKey: options.sectionKey,
    q: options.q,
  })) as T[];
  const fairnessPool = filterRotationFairnessPool(eligible, context);
  const ranked = sortRotationRows(fairnessPool, context);
  return {
    items: ranked.slice(offset, offset + limit),
    total: ranked.length,
  };
}

export async function recordRotationFeature(
  db: any,
  storyId: number,
  featuredAt?: string,
): Promise<{ ok: boolean; id: number; last_featured: string }> {
  const nowRow = await db.prepare("SELECT datetime('now') AS now").first();
  const timestamp = featuredAt || String((nowRow as { now?: string } | null)?.now || new Date().toISOString());

  await db
    .prepare(
      `UPDATE content_inventory
          SET last_featured = ?,
              usage_count = COALESCE(usage_count, 0) + 1,
              updated_at = ?
        WHERE id = ? AND status = 'published'`,
    )
    .bind(timestamp, timestamp, storyId)
    .run();

  return { ok: true, id: storyId, last_featured: timestamp };
}
