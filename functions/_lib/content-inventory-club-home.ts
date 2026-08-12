import { listStoryMediaAssociations } from './content-inventory-media';
import {
  countPublishedInventoryForSection,
  mapPublicInventoryStory,
  publishedInventoryWhere,
} from './content-inventory-public';
import {
  filterRotationFairnessPool,
  type RotationRow,
  sortRotationRows,
} from './content-inventory-rotation';
import { normalizePhotoUrl } from './photo-url';

export const CLUB_HOME_SECTION = 'club_home';

const RAIL_STORY_TYPES = new Set(['secondary', 'brief']);
const PRIMARY_STORY_TYPE = 'primary';

export type ClubHomeStoryPayload = {
  id: number;
  title: string | null;
  headline: string | null;
  summary: string | null;
  credit: string | null;
  source_name: string | null;
  year: number | null;
  tag: string | null;
  perspective_label: string | null;
  canonical: boolean;
  story_type: string | null;
};

export type ClubHomeMediaFeaturePayload = {
  thumbnail_url: string | null;
  title: string | null;
  description: string | null;
  credit_line: string | null;
  source_name: string | null;
  href: string;
  is_memorabilia: boolean;
};

export type ClubHomeContentPayload = {
  ok: true;
  source: 'content_inventory' | 'static';
  lead_story: ClubHomeStoryPayload | null;
  rail_stories: ClubHomeStoryPayload[];
  archive_spotlight: ClubHomeStoryPayload | null;
  media_feature: ClubHomeMediaFeaturePayload | null;
};

type ClubHomeInventoryRow = RotationRow & {
  story_type?: string | null;
  tag?: string | null;
  perspective_label?: string | null;
  text?: string | null;
};

function mapClubHomeStory(row: ClubHomeInventoryRow): ClubHomeStoryPayload {
  const mapped = mapPublicInventoryStory(row);
  const summary =
    mapped.summary ||
    mapped.excerpt ||
    (typeof row.text === 'string' && row.text ? row.text.slice(0, 200) : null);
  return {
    id: mapped.id,
    title: mapped.title,
    headline: mapped.title,
    summary,
    credit: mapped.author,
    source_name: typeof row.source_name === 'string' ? row.source_name.trim() || null : null,
    year: mapped.year,
    tag: mapped.tag,
    perspective_label: mapped.perspective_label,
    canonical: mapped.canonical,
    story_type: typeof row.story_type === 'string' ? row.story_type : null,
  };
}

function normalizeStoryType(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

async function fetchClubHomeRows(db: any): Promise<ClubHomeInventoryRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, title, text, summary, credit_line, source_name, story_type, tag,
              perspective_label, event_date, event_year, rotation_group, last_featured,
              usage_count, feature_weight, canonical, priority, allowed_sections, status, updated_at
         FROM content_inventory
        WHERE ${publishedInventoryWhere(CLUB_HOME_SECTION)}`,
    )
    .all();

  return (rows.results ?? []) as ClubHomeInventoryRow[];
}

function pickLeadStory(rows: ClubHomeInventoryRow[], asOfDate = new Date()): ClubHomeInventoryRow | null {
  const context = { asOfDate, includeAlternates: false };
  const pool = filterRotationFairnessPool(rows, context);
  const ranked = sortRotationRows(pool, context);
  const primary = ranked.find((row) => normalizeStoryType(row.story_type) === PRIMARY_STORY_TYPE);
  return primary ?? ranked[0] ?? null;
}

function pickRailStories(
  rows: ClubHomeInventoryRow[],
  excludeId: number | null,
  asOfDate = new Date(),
): ClubHomeInventoryRow[] {
  const eligible = rows.filter((row) => {
    if (excludeId !== null && Number(row.id) === excludeId) return false;
    return RAIL_STORY_TYPES.has(normalizeStoryType(row.story_type));
  });
  const context = { asOfDate, includeAlternates: true };
  const pool = filterRotationFairnessPool(eligible, context);
  return sortRotationRows(pool, context).slice(0, 4);
}

function pickArchiveSpotlight(
  rows: ClubHomeInventoryRow[],
  excludeIds: Set<number>,
  asOfDate = new Date(),
): ClubHomeInventoryRow | null {
  const eligible = rows.filter((row) => !excludeIds.has(Number(row.id)));
  if (!eligible.length) return null;
  const context = { asOfDate, includeAlternates: true };
  const pool = filterRotationFairnessPool(eligible, context);
  if (!pool.length) return null;
  const ranked = sortRotationRows(pool, context);
  return ranked[0] ?? null;
}

async function resolveMediaFeature(
  db: any,
  leadStory: ClubHomeStoryPayload | null,
  request: Request,
  publicB2BaseUrl?: unknown,
): Promise<ClubHomeMediaFeaturePayload | null> {
  if (leadStory) {
    const associations = await listStoryMediaAssociations(db, [leadStory.id]);
    const mediaRows = associations.get(leadStory.id) || [];
    const primary =
      mediaRows.find((row) => String((row as any).media_role || '') === 'primary_image') || mediaRows[0];
    if (primary) {
      const photoUrl = normalizePhotoUrl({
        rawUrl: (primary as any).url,
        request,
        publicB2BaseUrl,
      });
      if (photoUrl) {
        const isMemorabilia = Number((primary as any).is_memorabilia) === 1;
        return {
          thumbnail_url: photoUrl,
          title:
            (typeof (primary as any).caption === 'string' && (primary as any).caption.trim()) ||
            (typeof (primary as any).photo_title === 'string' && (primary as any).photo_title) ||
            leadStory.title,
          description:
            (typeof (primary as any).photo_description === 'string' && (primary as any).photo_description) ||
            leadStory.summary,
          credit_line:
            (typeof (primary as any).credit_line === 'string' && (primary as any).credit_line.trim()) ||
            leadStory.credit,
          source_name:
            (typeof (primary as any).source_name === 'string' && (primary as any).source_name.trim()) ||
            leadStory.source_name,
          href: isMemorabilia ? '/fanclub/memorabilia' : '/fanclub/photo',
          is_memorabilia: isMemorabilia,
        };
      }
    }
  }

  const photoRow = await db
    .prepare(
      `SELECT id, url, title, description, source, is_memorabilia
         FROM photos
        WHERE COALESCE(TRIM(url), '') != ''
        ORDER BY id DESC
        LIMIT 1`,
    )
    .first();

  if (!photoRow) return null;

  const photoUrl = normalizePhotoUrl({
    rawUrl: (photoRow as any).url,
    request,
    publicB2BaseUrl,
  });
  if (!photoUrl) return null;

  const isMemorabilia = Number((photoRow as any).is_memorabilia) === 1;
  return {
    thumbnail_url: photoUrl,
    title: typeof (photoRow as any).title === 'string' ? (photoRow as any).title : null,
    description: typeof (photoRow as any).description === 'string' ? (photoRow as any).description : null,
    credit_line: typeof (photoRow as any).source === 'string' ? (photoRow as any).source : null,
    source_name: typeof (photoRow as any).source === 'string' ? (photoRow as any).source : null,
    href: isMemorabilia ? '/fanclub/memorabilia' : '/fanclub/photo',
    is_memorabilia: isMemorabilia,
  };
}

export async function fetchClubHomeContent(
  db: any,
  options?: { request?: Request; publicB2BaseUrl?: unknown },
): Promise<ClubHomeContentPayload> {
  const eligibleTotal = await countPublishedInventoryForSection(db, CLUB_HOME_SECTION);
  if (eligibleTotal <= 0) {
    return {
      ok: true,
      source: 'static',
      lead_story: null,
      rail_stories: [],
      archive_spotlight: null,
      media_feature: null,
    };
  }

  const rows = await fetchClubHomeRows(db);
  const asOfDate = new Date();
  const leadRow = pickLeadStory(rows, asOfDate);
  const leadStory = leadRow ? mapClubHomeStory(leadRow) : null;
  const railStories = pickRailStories(rows, leadStory?.id ?? null, asOfDate).map(mapClubHomeStory);

  const excludeIds = new Set<number>();
  if (leadStory) excludeIds.add(leadStory.id);
  for (const story of railStories) excludeIds.add(story.id);

  const spotlightRow = pickArchiveSpotlight(rows, excludeIds, asOfDate);
  const archiveSpotlight = spotlightRow ? mapClubHomeStory(spotlightRow) : null;
  const mediaFeature = await resolveMediaFeature(
    db,
    leadStory,
    options?.request ?? new Request('https://www.lougehrigfanclub.com'),
    options?.publicB2BaseUrl,
  );

  return {
    ok: true,
    source: 'content_inventory',
    lead_story: leadStory,
    rail_stories: railStories,
    archive_spotlight: archiveSpotlight,
    media_feature: mediaFeature,
  };
}
