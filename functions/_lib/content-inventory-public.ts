// Shared read helpers for published content_inventory public/member surfaces.

import { fetchRotationRankedInventory } from './content-inventory-rotation';

export const LIBRARY_SECTION = 'library';
export const CLUB_HOME_SECTION = 'club_home';
export const RELATED_CONTENT_SECTION = 'related_content';
export const SEARCH_SECTION = 'search';

const INVENTORY_TEXT_SEARCH_FIELDS = [
  'title',
  'text',
  'summary',
  'search_text',
  'tag',
  'source_name',
  'credit_line',
  'perspective_label',
  'event_date',
] as const;

export type PublicInventoryStory = {
  id: number;
  title: string | null;
  excerpt: string | null;
  summary: string | null;
  author: string | null;
  year: number | null;
  tag: string | null;
  perspective_label: string | null;
  canonical: boolean;
};

export type RelatedStoriesResult = {
  items: PublicInventoryStory[];
  source: 'content_inventory' | 'library_entries';
};

type InventoryRow = Record<string, unknown>;

export function parseInventoryYear(eventYear: unknown, eventDate: unknown): number | null {
  if (eventYear !== null && eventYear !== undefined && String(eventYear).trim() !== '') {
    const parsed = Number(eventYear);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return eventDate ? Number(String(eventDate).slice(0, 4)) || null : null;
}

export function sectionAllowedClause(sectionKey: string, alias?: string): string {
  const escaped = sectionKey.replace(/'/g, "''");
  const prefix = alias ? `${alias}.` : '';
  return `lower(COALESCE(${prefix}allowed_sections,'')) LIKE '%${escaped}%'`;
}

export function publishedInventoryWhere(sectionKey: string, alias?: string): string {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}status = 'published' AND ${sectionAllowedClause(sectionKey, alias)} AND COALESCE(TRIM(${prefix}source_name), '') != '' AND COALESCE(TRIM(${prefix}credit_line), '') != ''`;
}

export function mapPublicInventoryStory(row: InventoryRow): PublicInventoryStory {
  const text = typeof row.text === 'string' ? row.text : '';
  const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
  return {
    id: Number(row.id),
    title: typeof row.title === 'string' ? row.title : null,
    excerpt: summary || (text ? text.slice(0, 160) : null),
    summary: summary || null,
    author:
      (typeof row.credit_line === 'string' && row.credit_line.trim()) ||
      (typeof row.source_name === 'string' && row.source_name.trim()) ||
      null,
    year: parseInventoryYear(row.event_year, row.event_date),
    tag: typeof row.tag === 'string' ? row.tag : null,
    perspective_label: typeof row.perspective_label === 'string' ? row.perspective_label : null,
    canonical: Number(row.canonical) === 1,
  };
}

export function sanitizePublicHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function librarySearchDestination(q?: string): string {
  const needle = String(q || '').trim();
  if (!needle) return '/fanclub/library';
  return `/fanclub/library?q=${encodeURIComponent(needle)}`;
}

export function mapLibraryInventoryItem(row: InventoryRow) {
  const sourceName = typeof row.source_name === 'string' && row.source_name.trim() ? row.source_name.trim() : null;
  return {
    id: Number(row.id),
    year: parseInventoryYear(row.event_year, row.event_date),
    author:
      (typeof row.credit_line === 'string' && row.credit_line.trim()) ||
      sourceName ||
      null,
    title: typeof row.title === 'string' ? row.title : null,
    description:
      (typeof row.summary === 'string' && row.summary.trim()) ||
      (typeof row.text === 'string' && row.text ? row.text.slice(0, 100) : null),
    url: null,
    content: typeof row.text === 'string' ? row.text : null,
    created_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    source_name: sourceName,
    source_url: sanitizePublicHttpUrl(row.source_url),
  };
}

const tableExistsCache = new Map<string, boolean>();

export async function tableExists(db: any, table: string): Promise<boolean> {
  if (tableExistsCache.has(table)) {
    return tableExistsCache.get(table)!;
  }
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1")
    .bind(table)
    .first();
  const exists = Boolean((row as { name?: string } | null)?.name);
  tableExistsCache.set(table, exists);
  return exists;
}

export async function countPublishedInventoryForSection(db: any, sectionKey: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(1) AS n FROM content_inventory WHERE ${publishedInventoryWhere(sectionKey)}`)
    .first();
  return Number((row as { n?: number } | null)?.n ?? 0) || 0;
}

type FetchLibraryInventoryOptions = {
  q?: string;
  limit: number;
  offset: number;
};

export async function fetchLibraryInventoryPage(
  db: any,
  options: FetchLibraryInventoryOptions,
): Promise<{ items: ReturnType<typeof mapLibraryInventoryItem>[]; total: number }> {
  const q = String(options.q || '').trim().toLowerCase();
  const { items: rankedRows, total } = await fetchRotationRankedInventory(db, {
    sectionKey: LIBRARY_SECTION,
    q,
    limit: options.limit,
    offset: options.offset,
    includeAlternates: true,
  });

  const items = rankedRows.map((row) => mapLibraryInventoryItem(row));
  return { items, total };
}

export type FetchRelatedInventoryOptions = {
  q?: string;
  tag?: string;
  eventYear?: number | null;
  rotationGroup?: string;
  excludeId?: number;
  limit?: number;
};

export async function fetchRelatedInventoryStories(
  db: any,
  options: FetchRelatedInventoryOptions,
): Promise<PublicInventoryStory[]> {
  const limit = Math.max(1, Math.min(20, Number(options.limit ?? 5) || 5));
  const whereParts = [publishedInventoryWhere(RELATED_CONTENT_SECTION)];
  const args: unknown[] = [];

  const q = String(options.q || '').trim().toLowerCase();
  if (q) {
    whereParts.push(
      "(lower(COALESCE(title,'')) LIKE ? OR lower(COALESCE(text,'')) LIKE ? OR lower(COALESCE(summary,'')) LIKE ? OR lower(COALESCE(search_text,'')) LIKE ? OR lower(COALESCE(tag,'')) LIKE ?)",
    );
    const like = `%${q}%`;
    args.push(like, like, like, like, like);
  }

  const tag = String(options.tag || '').trim();
  if (tag) {
    whereParts.push('lower(COALESCE(tag,\'\')) = ?');
    args.push(tag.toLowerCase());
  }

  if (options.eventYear !== null && options.eventYear !== undefined && Number.isFinite(options.eventYear)) {
    whereParts.push('event_year = ?');
    args.push(Math.trunc(Number(options.eventYear)));
  }

  const rotationGroup = String(options.rotationGroup || '').trim();
  if (rotationGroup) {
    whereParts.push('lower(COALESCE(rotation_group,\'\')) = ?');
    args.push(rotationGroup.toLowerCase());
  }

  if (typeof options.excludeId === 'number' && Number.isFinite(options.excludeId)) {
    whereParts.push('id != ?');
    args.push(options.excludeId);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;
  const rows = await db
    .prepare(
      `SELECT id, tag, title, text, summary, credit_line, source_name, event_date, event_year,
              perspective_label, canonical, priority, updated_at
       FROM content_inventory
       ${whereSql}
       ORDER BY canonical DESC, priority DESC, updated_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(...args, limit)
    .all();

  return ((rows.results ?? []) as InventoryRow[]).map((row) => mapPublicInventoryStory(row));
}

export async function fetchLegacyLibraryRelated(
  db: any,
  options: { q?: string; limit?: number },
): Promise<PublicInventoryStory[]> {
  if (!(await tableExists(db, 'library_entries'))) return [];

  const limit = Math.max(1, Math.min(20, Number(options.limit ?? 5) || 5));
  const q = String(options.q || '').trim().toLowerCase();
  const rows = await db
    .prepare(
      q
        ? `SELECT id, title, content
           FROM library_entries
           WHERE lower(COALESCE(title,'')) LIKE ? OR lower(COALESCE(content,'')) LIKE ?
           ORDER BY created_at DESC, id DESC
           LIMIT ?`
        : `SELECT id, title, content
           FROM library_entries
           ORDER BY created_at DESC, id DESC
           LIMIT ?`,
    )
    .bind(...(q ? [`%${q}%`, `%${q}%`, limit] : [limit]))
    .all();

  return ((rows.results ?? []) as InventoryRow[]).map((row) => ({
    id: Number(row.id),
    title: typeof row.title === 'string' ? row.title : null,
    excerpt: typeof row.content === 'string' ? row.content.slice(0, 160) : null,
    summary: null,
    author: null,
    year: null,
    tag: null,
    perspective_label: null,
    canonical: true,
  }));
}

export async function resolveRelatedStories(
  db: any,
  options: FetchRelatedInventoryOptions,
): Promise<RelatedStoriesResult> {
  if (!(await tableExists(db, 'content_inventory'))) {
    const legacyItems = await fetchLegacyLibraryRelated(db, options);
    return { items: legacyItems, source: 'library_entries' };
  }

  const eligibleCount = await countPublishedInventoryForSection(db, RELATED_CONTENT_SECTION);
  if (eligibleCount > 0) {
    const items = await fetchRelatedInventoryStories(db, options);
    return { items, source: 'content_inventory' };
  }

  const legacyItems = await fetchLegacyLibraryRelated(db, options);
  return { items: legacyItems, source: 'library_entries' };
}

export function toLegacyRelatedLibraryEntries(items: PublicInventoryStory[]) {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
  }));
}

export type SearchInventoryHit = {
  id: number;
  title: string;
  body: string;
  excerpt: string;
  url: string;
  canonical: boolean;
  perspective_label: string | null;
  year: number | null;
  tag: string | null;
};

function inventoryTextSearchClause(alias: string): string {
  const fieldClauses = INVENTORY_TEXT_SEARCH_FIELDS.map(
    (field) => `lower(COALESCE(${alias}.${field},'')) LIKE ?`,
  );
  fieldClauses.push(`lower(COALESCE(CAST(${alias}.event_year AS TEXT),'')) LIKE ?`);
  return `(${fieldClauses.join(' OR ')})`;
}

function inventoryMediaSearchClause(cimAlias: string, photoAlias: string): string {
  return `(
    lower(COALESCE(${cimAlias}.caption,'')) LIKE ?
    OR lower(COALESCE(${cimAlias}.alt_text,'')) LIKE ?
    OR lower(COALESCE(${photoAlias}.description,'')) LIKE ?
    OR lower(COALESCE(${photoAlias}.title,'')) LIKE ?
  )`;
}

function inventoryTextSearchPlaceholderCount(): number {
  return INVENTORY_TEXT_SEARCH_FIELDS.length + 1;
}

function inventoryMediaSearchPlaceholderCount(): number {
  return 4;
}

function pushInventoryLikeArgs(args: unknown[], like: string, includeMedia: boolean): void {
  for (let i = 0; i < inventoryTextSearchPlaceholderCount(); i += 1) {
    args.push(like);
  }
  if (includeMedia) {
    for (let i = 0; i < inventoryMediaSearchPlaceholderCount(); i += 1) {
      args.push(like);
    }
  }
}

export function formatSearchInventoryTitle(row: InventoryRow): string {
  const baseTitle = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Archive story';
  const perspective =
    typeof row.perspective_label === 'string' && row.perspective_label.trim()
      ? row.perspective_label.trim()
      : null;
  if (perspective) return `${baseTitle} (${perspective})`;
  if (Number(row.canonical) !== 1) return `${baseTitle} (Alternate perspective)`;
  return baseTitle;
}

export function buildInventorySearchBody(row: InventoryRow, mediaText = ''): string {
  const parts = [
    row.text,
    row.summary,
    row.search_text,
    row.tag,
    row.source_name,
    row.credit_line,
    row.perspective_label,
    row.event_date,
    row.event_year,
    mediaText,
  ];
  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

function mapSearchInventoryHit(row: InventoryRow, mediaText = '', q = ''): SearchInventoryHit {
  const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
  const text = typeof row.text === 'string' ? row.text : '';
  const body = buildInventorySearchBody(row, mediaText);
  return {
    id: Number(row.id),
    title: formatSearchInventoryTitle(row),
    body,
    excerpt: summary || (text ? text.slice(0, 120) : body.slice(0, 120)),
    url: librarySearchDestination(q),
    canonical: Number(row.canonical) === 1,
    perspective_label: typeof row.perspective_label === 'string' ? row.perspective_label : null,
    year: parseInventoryYear(row.event_year, row.event_date),
    tag: typeof row.tag === 'string' ? row.tag : null,
  };
}

type FetchSearchInventoryOptions = {
  sectionKey: string;
  q: string;
  limit?: number;
};

export async function fetchSearchInventoryResults(
  db: any,
  options: FetchSearchInventoryOptions,
): Promise<SearchInventoryHit[]> {
  const q = String(options.q || '').trim().toLowerCase();
  if (!q) return [];

  const limit = Math.max(1, Math.min(30, Number(options.limit ?? 30) || 30));
  const like = `%${q}%`;
  const whereParts = [publishedInventoryWhere(options.sectionKey, 'ci')];
  const args: unknown[] = [];

  const hasMediaTables =
    (await tableExists(db, 'content_inventory_media')) && (await tableExists(db, 'photos'));

  if (hasMediaTables) {
    whereParts.push(
      `(${inventoryTextSearchClause('ci')} OR ${inventoryMediaSearchClause('cim', 'p')})`,
    );
    pushInventoryLikeArgs(args, like, true);
  } else {
    whereParts.push(inventoryTextSearchClause('ci'));
    pushInventoryLikeArgs(args, like, false);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;
  const fromSql = hasMediaTables
    ? `FROM content_inventory ci
       LEFT JOIN content_inventory_media cim ON cim.story_id = ci.id
       LEFT JOIN photos p ON p.id = cim.media_id`
    : 'FROM content_inventory ci';

  const selectSql = hasMediaTables
    ? `SELECT DISTINCT ci.id, ci.title, ci.text, ci.summary, ci.search_text, ci.tag,
              ci.source_name, ci.credit_line, ci.event_date, ci.event_year,
              ci.perspective_label, ci.canonical, ci.priority, ci.updated_at,
              GROUP_CONCAT(
                COALESCE(cim.caption, '') || ' ' ||
                COALESCE(cim.alt_text, '') || ' ' ||
                COALESCE(p.description, '') || ' ' ||
                COALESCE(p.title, ''),
                ' '
              ) AS media_search_text`
    : `SELECT ci.id, ci.title, ci.text, ci.summary, ci.search_text, ci.tag,
              ci.source_name, ci.credit_line, ci.event_date, ci.event_year,
              ci.perspective_label, ci.canonical, ci.priority, ci.updated_at`;

  const groupBySql = hasMediaTables ? ' GROUP BY ci.id' : '';
  const rows = await db
    .prepare(
      `${selectSql}
       ${fromSql}
       ${whereSql}
       ${groupBySql}
       ORDER BY ci.canonical DESC, ci.priority DESC, ci.updated_at DESC, ci.id DESC
       LIMIT ?`,
    )
    .bind(...args, limit)
    .all();

  return ((rows.results ?? []) as InventoryRow[]).map((row) =>
    mapSearchInventoryHit(
      row,
      typeof row.media_search_text === 'string' ? row.media_search_text : '',
      q,
    ),
  );
}

export type SearchLibraryResolution = {
  items: SearchInventoryHit[];
  source: 'content_inventory' | 'library_entries';
};

export async function resolveMemberLibrarySearchResults(
  db: any,
  options: { q: string; limit?: number },
): Promise<SearchLibraryResolution> {
  const q = String(options.q || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(20, Number(options.limit ?? 20) || 20));

  if (await tableExists(db, 'content_inventory')) {
    const eligibleCount = await countPublishedInventoryForSection(db, LIBRARY_SECTION);
    if (eligibleCount > 0) {
      const items = await fetchSearchInventoryResults(db, {
        sectionKey: LIBRARY_SECTION,
        q,
        limit,
      });
      return { items, source: 'content_inventory' };
    }
  }

  if (!(await tableExists(db, 'library_entries'))) {
    return { items: [], source: 'library_entries' };
  }

  const like = `%${q}%`;
  const rows = await db
    .prepare(
      q
        ? `SELECT id, title, content
           FROM library_entries
           WHERE lower(COALESCE(title,'')) LIKE ? OR lower(COALESCE(content,'')) LIKE ?
           ORDER BY created_at DESC, id DESC
           LIMIT ?`
        : `SELECT id, title, content
           FROM library_entries
           ORDER BY created_at DESC, id DESC
           LIMIT ?`,
    )
    .bind(...(q ? [like, like, limit] : [limit]))
    .all();

  const items = ((rows.results ?? []) as InventoryRow[]).map((row) => ({
    id: Number(row.id),
    title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Library item',
    body: typeof row.content === 'string' ? row.content : '',
    excerpt:
      typeof row.content === 'string' && row.content
        ? row.content.slice(0, 120)
        : '',
    url: librarySearchDestination(q),
    canonical: true,
    perspective_label: null,
    year: null,
    tag: null,
  }));

  return { items, source: 'library_entries' };
}
