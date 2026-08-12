import { listStoryMediaAssociations } from './content-inventory-media';
import {
  countPublishedInventoryForSection,
  mapPublicInventoryStory,
  publishedInventoryWhere,
} from './content-inventory-public';
import {
  CLUB_HOME_PLACEMENT_ZONES,
  filterRotationFairnessPool,
  recordPlacementHistory,
  type PlacementHistoryRecord,
  type RotationRow,
  sortRotationRows,
} from './content-inventory-rotation';
import { normalizePhotoUrl } from './photo-url';

export const CLUB_HOME_SECTION = 'club_home';

const RAIL_STORY_TYPES = new Set(['secondary', 'brief']);
const PRIMARY_STORY_TYPE = 'primary';

/** Zones that accept a manual pin (media-feature follows lead pairing, not a separate pin slot). */
export const CLUB_HOME_PINNABLE_ZONES = [
  CLUB_HOME_PLACEMENT_ZONES.leadStory,
  CLUB_HOME_PLACEMENT_ZONES.storyRail,
  CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight,
] as const;

export type ClubHomePinnableZone = (typeof CLUB_HOME_PINNABLE_ZONES)[number];

export type ClubHomePinRecord = {
  zone_id: ClubHomePinnableZone | string;
  story_id: number;
  pinned_at: string;
  pinned_by: string | null;
  expires_at: string | null;
};

export function isClubHomePinnableZone(value: unknown): value is ClubHomePinnableZone {
  return CLUB_HOME_PINNABLE_ZONES.includes(String(value || '').trim() as ClubHomePinnableZone);
}

function pinIsActive(pin: ClubHomePinRecord, asOfDate: Date): boolean {
  if (!pin.expires_at) return true;
  const expiresMs = Date.parse(pin.expires_at);
  if (!Number.isFinite(expiresMs)) return false;
  return expiresMs > asOfDate.getTime();
}

/**
 * Load active Club Home pins. Fail-open when the pin table is absent/unavailable
 * so Club Home keeps rotating without weakening publication gates.
 */
export async function loadActiveClubHomePins(
  db: any,
  asOfDate = new Date(),
): Promise<ClubHomePinRecord[]> {
  try {
    const rows = await db
      .prepare(
        `SELECT zone_id, story_id, pinned_at, pinned_by, expires_at
           FROM content_inventory_club_home_pins`,
      )
      .all();
    return ((rows.results ?? []) as ClubHomePinRecord[]).filter(
      (pin) => isClubHomePinnableZone(pin.zone_id) && pinIsActive(pin, asOfDate),
    );
  } catch (err) {
    console.error('content inventory club home pins load error:', err);
    return [];
  }
}

function findEligiblePinnedRow(
  rows: ClubHomeInventoryRow[],
  storyId: number,
  zoneId: ClubHomePinnableZone,
): ClubHomeInventoryRow | null {
  const row = rows.find((candidate) => Number(candidate.id) === storyId) ?? null;
  if (!row) return null;
  const storyType = normalizeStoryType(row.story_type);
  if (zoneId === CLUB_HOME_PLACEMENT_ZONES.storyRail && !RAIL_STORY_TYPES.has(storyType)) {
    return null;
  }
  return row;
}
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
  const activePins = await loadActiveClubHomePins(db, asOfDate);
  const pinByZone = new Map(activePins.map((pin) => [String(pin.zone_id), pin]));

  const leadPin = pinByZone.get(CLUB_HOME_PLACEMENT_ZONES.leadStory);
  const pinnedLeadRow = leadPin
    ? findEligiblePinnedRow(rows, Number(leadPin.story_id), CLUB_HOME_PLACEMENT_ZONES.leadStory)
    : null;
  const leadRow = pinnedLeadRow ?? pickLeadStory(rows, asOfDate);
  const leadSelectionMode = pinnedLeadRow ? 'pinned' : 'automatic';
  const leadStory = leadRow ? mapClubHomeStory(leadRow) : null;

  const railPin = pinByZone.get(CLUB_HOME_PLACEMENT_ZONES.storyRail);
  const pinnedRailRow = railPin
    ? findEligiblePinnedRow(rows, Number(railPin.story_id), CLUB_HOME_PLACEMENT_ZONES.storyRail)
    : null;
  let railRows = pickRailStories(rows, leadStory?.id ?? null, asOfDate);
  let railPinnedStoryId: number | null = null;
  if (pinnedRailRow && Number(pinnedRailRow.id) !== leadStory?.id) {
    railPinnedStoryId = Number(pinnedRailRow.id);
    railRows = [
      pinnedRailRow,
      ...railRows.filter((row) => Number(row.id) !== Number(pinnedRailRow.id)),
    ].slice(0, 4);
  }
  const railStories = railRows.map(mapClubHomeStory);

  const excludeIds = new Set<number>();
  if (leadStory) excludeIds.add(leadStory.id);
  for (const story of railStories) excludeIds.add(story.id);

  const spotlightPin = pinByZone.get(CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight);
  const pinnedSpotlightRow = spotlightPin
    ? findEligiblePinnedRow(
        rows,
        Number(spotlightPin.story_id),
        CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight,
      )
    : null;
  const spotlightRow =
    pinnedSpotlightRow && !excludeIds.has(Number(pinnedSpotlightRow.id))
      ? pinnedSpotlightRow
      : pickArchiveSpotlight(rows, excludeIds, asOfDate);
  const spotlightSelectionMode =
    pinnedSpotlightRow && spotlightRow && Number(spotlightRow.id) === Number(pinnedSpotlightRow.id)
      ? 'pinned'
      : 'automatic';
  const archiveSpotlight = spotlightRow ? mapClubHomeStory(spotlightRow) : null;
  const mediaFeature = await resolveMediaFeature(
    db,
    leadStory,
    options?.request ?? new Request('https://www.lougehrigfanclub.com'),
    options?.publicB2BaseUrl,
  );

  const placements: PlacementHistoryRecord[] = [];
  if (leadStory) {
    placements.push({
      story_id: leadStory.id,
      zone_id: CLUB_HOME_PLACEMENT_ZONES.leadStory,
      section_key: CLUB_HOME_SECTION,
      selection_mode: leadSelectionMode,
    });
  }
  for (const story of railStories) {
    placements.push({
      story_id: story.id,
      zone_id: CLUB_HOME_PLACEMENT_ZONES.storyRail,
      section_key: CLUB_HOME_SECTION,
      selection_mode: railPinnedStoryId === story.id ? 'pinned' : 'automatic',
    });
  }
  if (archiveSpotlight) {
    placements.push({
      story_id: archiveSpotlight.id,
      zone_id: CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight,
      section_key: CLUB_HOME_SECTION,
      selection_mode: spotlightSelectionMode,
    });
  }
  // Media feature may resolve from photos rather than inventory; log only when lead-bound.
  if (leadStory && mediaFeature) {
    placements.push({
      story_id: leadStory.id,
      zone_id: CLUB_HOME_PLACEMENT_ZONES.mediaFeature,
      section_key: CLUB_HOME_SECTION,
      selection_mode: leadSelectionMode,
      feature_size: mediaFeature.is_memorabilia ? 'memorabilia' : 'photo',
    });
  }

  // Fail-open: history storage must not block Club Home rendering or weaken eligibility gates.
  await recordPlacementHistory(db, placements);

  return {
    ok: true,
    source: 'content_inventory',
    lead_story: leadStory,
    rail_stories: railStories,
    archive_spotlight: archiveSpotlight,
    media_feature: mediaFeature,
  };
}
