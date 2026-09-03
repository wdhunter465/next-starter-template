import {
  CLUB_HOME_MEDIA_RENDITION_SIZE,
  getMediaRendition,
  listStoryMediaAssociations,
  readyRenditionUrl,
} from "./content-inventory-media";
import { countPublishedInventoryForSection, mapPublicInventoryStory, publishedInventoryWhere } from "./content-inventory-public";
import {
  CLUB_HOME_PLACEMENT_ZONES,
  filterRotationFairnessPool,
  recordPlacementHistory,
  type PlacementHistoryRecord,
  type RotationRow,
  sortRotationRows,
} from "./content-inventory-rotation";
import { normalizePhotoUrl } from "./photo-url";
import { rightsClearedClause } from "./rights-hold";

export const CLUB_HOME_SECTION = "club_home";

const RAIL_STORY_TYPES = new Set(["secondary", "brief"]);
const PRIMARY_STORY_TYPE = "primary";

const EDITION_STATUS = {
  building: "building",
  ready: "ready",
  failed: "failed",
} as const;

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

export type ClubHomeEditionRecord = {
  id: number;
  status: string;
  created_at: string;
  created_by: string | null;
  completed_at: string | null;
  failure_reason: string | null;
};

export type ClubHomeEditionPlacementRecord = {
  edition_id: number;
  zone_id: string;
  story_id: number | null;
  position: number;
  selection_mode: string;
  feature_size: string | null;
};

export type ClubHomeActiveEditionRecord = {
  edition_id: number;
  activated_at: string;
  activated_by: string | null;
};

export function isClubHomePinnableZone(value: unknown): value is ClubHomePinnableZone {
  return CLUB_HOME_PINNABLE_ZONES.includes(String(value || "").trim() as ClubHomePinnableZone);
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
export async function loadActiveClubHomePins(db: any, asOfDate = new Date()): Promise<ClubHomePinRecord[]> {
  try {
    const rows = await db
      .prepare(
        `SELECT zone_id, story_id, pinned_at, pinned_by, expires_at
           FROM content_inventory_club_home_pins`,
      )
      .all();
    return ((rows.results ?? []) as ClubHomePinRecord[]).filter((pin) => isClubHomePinnableZone(pin.zone_id) && pinIsActive(pin, asOfDate));
  } catch (err) {
    console.error("content inventory club home pins load error:", err);
    return [];
  }
}

function findEligiblePinnedRow(rows: ClubHomeInventoryRow[], storyId: number, zoneId: ClubHomePinnableZone): ClubHomeInventoryRow | null {
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
  /** Size label of the persisted rendition used for thumbnail_url, when any. */
  media_rendition: string | null;
  title: string | null;
  description: string | null;
  credit_line: string | null;
  source_name: string | null;
  href: string;
  is_memorabilia: boolean;
};

export type ClubHomeContentPayload = {
  ok: true;
  source: "content_inventory" | "static";
  lead_story: ClubHomeStoryPayload | null;
  rail_stories: ClubHomeStoryPayload[];
  archive_spotlight: ClubHomeStoryPayload | null;
  media_feature: ClubHomeMediaFeaturePayload | null;
  /** Present when the payload was hydrated from a persisted active edition. */
  edition_id?: number | null;
};

type ClubHomeInventoryRow = RotationRow & {
  story_type?: string | null;
  tag?: string | null;
  perspective_label?: string | null;
  text?: string | null;
};

type ComposedClubHomeSelection = {
  leadRow: ClubHomeInventoryRow | null;
  railRows: ClubHomeInventoryRow[];
  spotlightRow: ClubHomeInventoryRow | null;
  leadSelectionMode: string;
  railPinnedStoryId: number | null;
  spotlightSelectionMode: string;
  placements: PlacementHistoryRecord[];
};

function mapClubHomeStory(row: ClubHomeInventoryRow): ClubHomeStoryPayload {
  const mapped = mapPublicInventoryStory(row);
  const summary = mapped.summary || mapped.excerpt || (typeof row.text === "string" && row.text ? row.text.slice(0, 200) : null);
  return {
    id: mapped.id,
    title: mapped.title,
    headline: mapped.title,
    summary,
    credit: mapped.author,
    source_name: typeof row.source_name === "string" ? row.source_name.trim() || null : null,
    year: mapped.year,
    tag: mapped.tag,
    perspective_label: mapped.perspective_label,
    canonical: mapped.canonical,
    story_type: typeof row.story_type === "string" ? row.story_type : null,
  };
}

function normalizeStoryType(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
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

function pickRailStories(rows: ClubHomeInventoryRow[], excludeId: number | null, asOfDate = new Date()): ClubHomeInventoryRow[] {
  const eligible = rows.filter((row) => {
    if (excludeId !== null && Number(row.id) === excludeId) return false;
    return RAIL_STORY_TYPES.has(normalizeStoryType(row.story_type));
  });
  const context = { asOfDate, includeAlternates: true };
  const pool = filterRotationFairnessPool(eligible, context);
  return sortRotationRows(pool, context).slice(0, 4);
}

function pickArchiveSpotlight(rows: ClubHomeInventoryRow[], excludeIds: Set<number>, asOfDate = new Date()): ClubHomeInventoryRow | null {
  const eligible = rows.filter((row) => !excludeIds.has(Number(row.id)));
  if (!eligible.length) return null;
  const context = { asOfDate, includeAlternates: true };
  const pool = filterRotationFairnessPool(eligible, context);
  if (!pool.length) return null;
  const ranked = sortRotationRows(pool, context);
  return ranked[0] ?? null;
}

async function resolveReadyClubHomeRenditionUrl(
  db: any,
  mediaId: number,
  request: Request,
  publicB2BaseUrl?: unknown,
): Promise<{ url: string; size: string } | null> {
  if (!mediaId) return null;
  try {
    const row = await getMediaRendition(db, mediaId, CLUB_HOME_MEDIA_RENDITION_SIZE);
    const raw = readyRenditionUrl(row || undefined);
    if (!raw) return null;
    const url = normalizePhotoUrl({ rawUrl: raw, request, publicB2BaseUrl });
    if (!url) return null;
    return { url, size: CLUB_HOME_MEDIA_RENDITION_SIZE };
  } catch {
    // Table missing or query failure → fail closed (omit image).
    return null;
  }
}

async function resolveMediaFeature(
  db: any,
  leadStory: ClubHomeStoryPayload | null,
  request: Request,
  publicB2BaseUrl?: unknown,
): Promise<ClubHomeMediaFeaturePayload | null> {
  // Fail-closed: never substitute original photos.url when the required rendition is absent.
  if (leadStory) {
    const associations = await listStoryMediaAssociations(db, [leadStory.id]);
    const mediaRows = associations.get(leadStory.id) || [];
    const primary = mediaRows.find((row) => String((row as any).media_role || "") === "primary_image") || mediaRows[0];
    if (primary) {
      const mediaId = Number((primary as any).media_id || 0);
      const rendition = await resolveReadyClubHomeRenditionUrl(db, mediaId, request, publicB2BaseUrl);
      const isMemorabilia = Number((primary as any).is_memorabilia) === 1;
      return {
        thumbnail_url: rendition?.url ?? null,
        media_rendition: rendition?.size ?? null,
        title:
          (typeof (primary as any).caption === "string" && (primary as any).caption.trim()) ||
          (typeof (primary as any).photo_title === "string" && (primary as any).photo_title) ||
          leadStory.title,
        description: (typeof (primary as any).photo_description === "string" && (primary as any).photo_description) || leadStory.summary,
        credit_line: (typeof (primary as any).credit_line === "string" && (primary as any).credit_line.trim()) || leadStory.credit,
        source_name: (typeof (primary as any).source_name === "string" && (primary as any).source_name.trim()) || leadStory.source_name,
        href: isMemorabilia ? "/fanclub/memorabilia" : "/fanclub/photo",
        is_memorabilia: isMemorabilia,
      };
    }
  }

  const photoRow = await db
    .prepare(
      `SELECT id, url, title, description, source, is_memorabilia
         FROM photos
        WHERE COALESCE(TRIM(url), '') != ''
          AND ${rightsClearedClause()}
        ORDER BY id DESC
        LIMIT 1`,
    )
    .first();

  if (!photoRow) return null;

  const mediaId = Number((photoRow as any).id || 0);
  const rendition = await resolveReadyClubHomeRenditionUrl(db, mediaId, request, publicB2BaseUrl);
  const isMemorabilia = Number((photoRow as any).is_memorabilia) === 1;
  return {
    thumbnail_url: rendition?.url ?? null,
    media_rendition: rendition?.size ?? null,
    title: typeof (photoRow as any).title === "string" ? (photoRow as any).title : null,
    description: typeof (photoRow as any).description === "string" ? (photoRow as any).description : null,
    credit_line: typeof (photoRow as any).source === "string" ? (photoRow as any).source : null,
    source_name: typeof (photoRow as any).source === "string" ? (photoRow as any).source : null,
    href: isMemorabilia ? "/fanclub/memorabilia" : "/fanclub/photo",
    is_memorabilia: isMemorabilia,
  };
}

/**
 * Compose zone placements using live publication gates, fairness, and pins.
 * Does not persist edition or placement-history rows.
 */
export async function composeClubHomeSelection(db: any, asOfDate = new Date()): Promise<ComposedClubHomeSelection | null> {
  const eligibleTotal = await countPublishedInventoryForSection(db, CLUB_HOME_SECTION);
  if (eligibleTotal <= 0) return null;

  const rows = await fetchClubHomeRows(db);
  const activePins = await loadActiveClubHomePins(db, asOfDate);
  const pinByZone = new Map(activePins.map((pin) => [String(pin.zone_id), pin]));

  const leadPin = pinByZone.get(CLUB_HOME_PLACEMENT_ZONES.leadStory);
  const pinnedLeadRow = leadPin ? findEligiblePinnedRow(rows, Number(leadPin.story_id), CLUB_HOME_PLACEMENT_ZONES.leadStory) : null;
  const leadRow = pinnedLeadRow ?? pickLeadStory(rows, asOfDate);
  const leadSelectionMode = pinnedLeadRow ? "pinned" : "automatic";
  const leadStoryId = leadRow ? Number(leadRow.id) : null;

  const railPin = pinByZone.get(CLUB_HOME_PLACEMENT_ZONES.storyRail);
  const pinnedRailRow = railPin ? findEligiblePinnedRow(rows, Number(railPin.story_id), CLUB_HOME_PLACEMENT_ZONES.storyRail) : null;
  let railRows = pickRailStories(rows, leadStoryId, asOfDate);
  let railPinnedStoryId: number | null = null;
  if (pinnedRailRow && Number(pinnedRailRow.id) !== leadStoryId) {
    railPinnedStoryId = Number(pinnedRailRow.id);
    railRows = [pinnedRailRow, ...railRows.filter((row) => Number(row.id) !== Number(pinnedRailRow.id))].slice(0, 4);
  }

  const excludeIds = new Set<number>();
  if (leadStoryId !== null) excludeIds.add(leadStoryId);
  for (const story of railRows) excludeIds.add(Number(story.id));

  const spotlightPin = pinByZone.get(CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight);
  const pinnedSpotlightRow = spotlightPin
    ? findEligiblePinnedRow(rows, Number(spotlightPin.story_id), CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight)
    : null;
  const spotlightRow =
    pinnedSpotlightRow && !excludeIds.has(Number(pinnedSpotlightRow.id))
      ? pinnedSpotlightRow
      : pickArchiveSpotlight(rows, excludeIds, asOfDate);
  const spotlightSelectionMode =
    pinnedSpotlightRow && spotlightRow && Number(spotlightRow.id) === Number(pinnedSpotlightRow.id) ? "pinned" : "automatic";

  const placements: PlacementHistoryRecord[] = [];
  if (leadRow) {
    placements.push({
      story_id: Number(leadRow.id),
      zone_id: CLUB_HOME_PLACEMENT_ZONES.leadStory,
      section_key: CLUB_HOME_SECTION,
      selection_mode: leadSelectionMode,
    });
  }
  for (const story of railRows) {
    placements.push({
      story_id: Number(story.id),
      zone_id: CLUB_HOME_PLACEMENT_ZONES.storyRail,
      section_key: CLUB_HOME_SECTION,
      selection_mode: railPinnedStoryId === Number(story.id) ? "pinned" : "automatic",
    });
  }
  if (spotlightRow) {
    placements.push({
      story_id: Number(spotlightRow.id),
      zone_id: CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight,
      section_key: CLUB_HOME_SECTION,
      selection_mode: spotlightSelectionMode,
    });
  }
  if (leadRow) {
    placements.push({
      story_id: Number(leadRow.id),
      zone_id: CLUB_HOME_PLACEMENT_ZONES.mediaFeature,
      section_key: CLUB_HOME_SECTION,
      selection_mode: leadSelectionMode,
    });
  }

  return {
    leadRow,
    railRows,
    spotlightRow,
    leadSelectionMode,
    railPinnedStoryId,
    spotlightSelectionMode,
    placements,
  };
}

async function editionTablesAvailable(db: any): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .bind("content_inventory_club_home_editions")
      .first();
    return Boolean(row?.name);
  } catch {
    try {
      await db.prepare(`SELECT 1 AS ok FROM content_inventory_club_home_editions LIMIT 1`).first();
      return true;
    } catch (err) {
      console.error("content inventory club home editions availability check:", err);
      return false;
    }
  }
}

export async function getActiveClubHomeEdition(
  db: any,
): Promise<{ active: ClubHomeActiveEditionRecord; edition: ClubHomeEditionRecord } | null> {
  try {
    const active = await db
      .prepare(
        `SELECT edition_id, activated_at, activated_by
           FROM content_inventory_club_home_active_edition
          WHERE singleton = 1`,
      )
      .first();
    if (!active || !Number(active.edition_id)) return null;

    const edition = await db
      .prepare(
        `SELECT id, status, created_at, created_by, completed_at, failure_reason
           FROM content_inventory_club_home_editions
          WHERE id = ?`,
      )
      .bind(Number(active.edition_id))
      .first();
    if (!edition || String(edition.status) !== EDITION_STATUS.ready) return null;

    return {
      active: {
        edition_id: Number(active.edition_id),
        activated_at: String(active.activated_at),
        activated_by: active.activated_by == null ? null : String(active.activated_by),
      },
      edition: {
        id: Number(edition.id),
        status: String(edition.status),
        created_at: String(edition.created_at),
        created_by: edition.created_by == null ? null : String(edition.created_by),
        completed_at: edition.completed_at == null ? null : String(edition.completed_at),
        failure_reason: edition.failure_reason == null ? null : String(edition.failure_reason),
      },
    };
  } catch (err) {
    console.error("content inventory club home active edition load error:", err);
    return null;
  }
}

export async function listClubHomeEditionPlacements(db: any, editionId: number): Promise<ClubHomeEditionPlacementRecord[]> {
  const rows = await db
    .prepare(
      `SELECT edition_id, zone_id, story_id, position, selection_mode, feature_size
         FROM content_inventory_club_home_edition_placements
        WHERE edition_id = ?
        ORDER BY zone_id ASC, position ASC, id ASC`,
    )
    .bind(editionId)
    .all();
  return ((rows.results ?? []) as any[]).map((row) => ({
    edition_id: Number(row.edition_id),
    zone_id: String(row.zone_id),
    story_id: row.story_id == null ? null : Number(row.story_id),
    position: Number(row.position) || 0,
    selection_mode: String(row.selection_mode || "automatic"),
    feature_size: row.feature_size == null ? null : String(row.feature_size),
  }));
}

async function loadEligibleStoryById(db: any, storyId: number): Promise<ClubHomeInventoryRow | null> {
  const row = await db
    .prepare(
      `SELECT id, title, text, summary, credit_line, source_name, story_type, tag,
              perspective_label, event_date, event_year, rotation_group, last_featured,
              usage_count, feature_weight, canonical, priority, allowed_sections, status, updated_at
         FROM content_inventory
        WHERE id = ? AND ${publishedInventoryWhere(CLUB_HOME_SECTION)}`,
    )
    .bind(storyId)
    .first();
  return (row as ClubHomeInventoryRow | null) ?? null;
}

async function payloadFromEdition(
  db: any,
  editionId: number,
  options?: { request?: Request; publicB2BaseUrl?: unknown },
): Promise<ClubHomeContentPayload> {
  const placements = await listClubHomeEditionPlacements(db, editionId);
  const leadPlacement = placements.find((row) => row.zone_id === CLUB_HOME_PLACEMENT_ZONES.leadStory);
  const railPlacements = placements
    .filter((row) => row.zone_id === CLUB_HOME_PLACEMENT_ZONES.storyRail)
    .sort((a, b) => a.position - b.position);
  const spotlightPlacement = placements.find((row) => row.zone_id === CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight);
  const mediaPlacement = placements.find((row) => row.zone_id === CLUB_HOME_PLACEMENT_ZONES.mediaFeature);

  const leadRow = leadPlacement?.story_id != null ? await loadEligibleStoryById(db, leadPlacement.story_id) : null;
  const leadStory = leadRow ? mapClubHomeStory(leadRow) : null;

  const railStories: ClubHomeStoryPayload[] = [];
  for (const placement of railPlacements) {
    if (placement.story_id == null) continue;
    const row = await loadEligibleStoryById(db, placement.story_id);
    if (row) railStories.push(mapClubHomeStory(row));
  }

  const spotlightRow = spotlightPlacement?.story_id != null ? await loadEligibleStoryById(db, spotlightPlacement.story_id) : null;
  const archiveSpotlight = spotlightRow ? mapClubHomeStory(spotlightRow) : null;

  let mediaLeadStory = leadStory;
  if (!mediaLeadStory && mediaPlacement?.story_id != null) {
    const mediaLeadRow = await loadEligibleStoryById(db, mediaPlacement.story_id);
    mediaLeadStory = mediaLeadRow ? mapClubHomeStory(mediaLeadRow) : null;
  }

  let mediaFeature: ClubHomeMediaFeaturePayload | null = null;
  if (mediaLeadStory) {
    mediaFeature = await resolveMediaFeature(
      db,
      mediaLeadStory,
      options?.request ?? new Request("https://www.lougehrigfanclub.com"),
      options?.publicB2BaseUrl,
    );
    if (mediaFeature && mediaPlacement?.feature_size) {
      mediaFeature = {
        ...mediaFeature,
        is_memorabilia: mediaPlacement.feature_size === "memorabilia",
        href: mediaPlacement.feature_size === "memorabilia" ? "/fanclub/memorabilia" : "/fanclub/photo",
      };
    }
  }

  return {
    ok: true,
    source: "content_inventory",
    lead_story: leadStory,
    rail_stories: railStories,
    archive_spotlight: archiveSpotlight,
    media_feature: mediaFeature,
    edition_id: editionId,
  };
}

async function fetchClubHomeContentLive(
  db: any,
  options?: { request?: Request; publicB2BaseUrl?: unknown; recordHistory?: boolean },
): Promise<ClubHomeContentPayload> {
  const composed = await composeClubHomeSelection(db);
  if (!composed) {
    return {
      ok: true,
      source: "static",
      lead_story: null,
      rail_stories: [],
      archive_spotlight: null,
      media_feature: null,
      edition_id: null,
    };
  }

  const leadStory = composed.leadRow ? mapClubHomeStory(composed.leadRow) : null;
  const railStories = composed.railRows.map(mapClubHomeStory);
  const archiveSpotlight = composed.spotlightRow ? mapClubHomeStory(composed.spotlightRow) : null;
  const mediaFeature = await resolveMediaFeature(
    db,
    leadStory,
    options?.request ?? new Request("https://www.lougehrigfanclub.com"),
    options?.publicB2BaseUrl,
  );

  const placements = [...composed.placements];
  if (leadStory && mediaFeature) {
    const mediaIdx = placements.findIndex((row) => row.zone_id === CLUB_HOME_PLACEMENT_ZONES.mediaFeature);
    if (mediaIdx >= 0) {
      placements[mediaIdx] = {
        ...placements[mediaIdx],
        feature_size: mediaFeature.is_memorabilia ? "memorabilia" : "photo",
        media_rendition: mediaFeature.media_rendition,
      };
    }
  }

  if (options?.recordHistory !== false) {
    await recordPlacementHistory(db, placements);
  }

  return {
    ok: true,
    source: "content_inventory",
    lead_story: leadStory,
    rail_stories: railStories,
    archive_spotlight: archiveSpotlight,
    media_feature: mediaFeature,
    edition_id: null,
  };
}

export async function fetchClubHomeContent(
  db: any,
  options?: { request?: Request; publicB2BaseUrl?: unknown },
): Promise<ClubHomeContentPayload> {
  const tablesReady = await editionTablesAvailable(db);
  if (tablesReady) {
    const active = await getActiveClubHomeEdition(db);
    if (active) {
      try {
        return await payloadFromEdition(db, active.edition.id, options);
      } catch (err) {
        console.error("content inventory club home edition serve error:", err);
        return {
          ok: true,
          source: "static",
          lead_story: null,
          rail_stories: [],
          archive_spotlight: null,
          media_feature: null,
          edition_id: active.edition.id,
        };
      }
    }
    // Schema present but no active edition: fail closed to static (do not recompute rotation).
    return {
      ok: true,
      source: "static",
      lead_story: null,
      rail_stories: [],
      archive_spotlight: null,
      media_feature: null,
      edition_id: null,
    };
  }

  // Migration absent: preserve pre-edition live rotation behavior.
  return fetchClubHomeContentLive(db, options);
}

async function nowIso(db: any): Promise<string> {
  const nowRow = await db.prepare("SELECT datetime('now') AS now").first();
  return String((nowRow as any)?.now || new Date().toISOString());
}

async function markEditionFailed(db: any, editionId: number, reason: string): Promise<void> {
  const now = await nowIso(db);
  await db
    .prepare(
      `UPDATE content_inventory_club_home_editions
          SET status = ?, completed_at = ?, failure_reason = ?
        WHERE id = ? AND status = ?`,
    )
    .bind(EDITION_STATUS.failed, now, reason.slice(0, 500), editionId, EDITION_STATUS.building)
    .run();
}

async function activateEditionPointer(
  db: any,
  editionId: number,
  activatedBy: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number; building_edition_id?: number }> {
  const now = await nowIso(db);
  const result = await db
    .prepare(
      `INSERT INTO content_inventory_club_home_active_edition
         (singleton, edition_id, activated_at, activated_by)
       SELECT 1, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM content_inventory_club_home_editions WHERE status = ?
        )
       ON CONFLICT(singleton) DO UPDATE SET
         edition_id = excluded.edition_id,
         activated_at = excluded.activated_at,
         activated_by = excluded.activated_by
       WHERE NOT EXISTS (
         SELECT 1 FROM content_inventory_club_home_editions WHERE status = ?
       )`,
    )
    .bind(editionId, now, activatedBy, EDITION_STATUS.building, EDITION_STATUS.building)
    .run();

  const changes = Number((result as any)?.meta?.changes ?? 0);
  if (changes < 1) {
    const building = await db
      .prepare(`SELECT id FROM content_inventory_club_home_editions WHERE status = ? LIMIT 1`)
      .bind(EDITION_STATUS.building)
      .first();
    return {
      ok: false,
      error: "Cannot activate while an edition regeneration is in progress.",
      status: 409,
      building_edition_id: building?.id ? Number(building.id) : undefined,
    };
  }
  return { ok: true };
}

export type ClubHomeEditionMutationResult =
  | {
      ok: true;
      edition_id: number;
      activated: true;
      placements: ClubHomeEditionPlacementRecord[];
      previous_edition_id: number | null;
    }
  | { ok: false; error: string; status: number; building_edition_id?: number };

/**
 * Create a complete immutable edition from current gates/pins/fairness, then activate it.
 * Concurrent building editions fail closed (409). Failure leaves the prior active edition unchanged.
 */
export async function regenerateClubHomeEdition(
  db: any,
  options?: { createdBy?: string; request?: Request; publicB2BaseUrl?: unknown },
): Promise<ClubHomeEditionMutationResult> {
  const createdBy = String(options?.createdBy || "admin-ui").trim() || "admin-ui";

  try {
    const building = await db
      .prepare(`SELECT id FROM content_inventory_club_home_editions WHERE status = ? LIMIT 1`)
      .bind(EDITION_STATUS.building)
      .first();
    if (building?.id) {
      return {
        ok: false,
        error: "A Club Home edition regeneration is already in progress.",
        status: 409,
        building_edition_id: Number(building.id),
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      error: String(err?.message || err || "Edition tables unavailable."),
      status: 503,
    };
  }

  const previous = await getActiveClubHomeEdition(db);
  const previousEditionId = previous?.edition.id ?? null;
  const now = await nowIso(db);

  let insertResult: any;
  try {
    insertResult = await db
      .prepare(
        `INSERT INTO content_inventory_club_home_editions
           (status, created_at, created_by, completed_at, failure_reason)
         SELECT ?, ?, ?, NULL, NULL
          WHERE NOT EXISTS (
            SELECT 1 FROM content_inventory_club_home_editions WHERE status = ?
          )`,
      )
      .bind(EDITION_STATUS.building, now, createdBy, EDITION_STATUS.building)
      .run();
  } catch (err: any) {
    const message = String(err?.message || err || "");
    if (/UNIQUE|unique|constraint/i.test(message)) {
      const building = await db
        .prepare(`SELECT id FROM content_inventory_club_home_editions WHERE status = ? LIMIT 1`)
        .bind(EDITION_STATUS.building)
        .first();
      return {
        ok: false,
        error: "A Club Home edition regeneration is already in progress.",
        status: 409,
        building_edition_id: building?.id ? Number(building.id) : undefined,
      };
    }
    return { ok: false, error: message || "Edition insert failed.", status: 500 };
  }

  if (Number(insertResult?.meta?.changes ?? 0) < 1) {
    const building = await db
      .prepare(`SELECT id FROM content_inventory_club_home_editions WHERE status = ? LIMIT 1`)
      .bind(EDITION_STATUS.building)
      .first();
    return {
      ok: false,
      error: "A Club Home edition regeneration is already in progress.",
      status: 409,
      building_edition_id: building?.id ? Number(building.id) : undefined,
    };
  }

  const idRow = await db.prepare("SELECT last_insert_rowid() AS id").first();
  const editionId = Number((idRow as any)?.id || 0);
  if (!editionId) {
    return { ok: false, error: "Failed to allocate edition identity.", status: 500 };
  }

  try {
    const composed = await composeClubHomeSelection(db);
    if (!composed) {
      await markEditionFailed(db, editionId, "No published club_home inventory eligible for an edition.");
      return {
        ok: false,
        error: "No published club_home inventory eligible for an edition.",
        status: 400,
      };
    }

    const leadStory = composed.leadRow ? mapClubHomeStory(composed.leadRow) : null;
    const mediaFeature = await resolveMediaFeature(
      db,
      leadStory,
      options?.request ?? new Request("https://www.lougehrigfanclub.com"),
      options?.publicB2BaseUrl,
    );

    const placementRows: Array<{
      zone_id: string;
      story_id: number | null;
      position: number;
      selection_mode: string;
      feature_size: string | null;
      media_rendition: string | null;
    }> = [];

    if (composed.leadRow) {
      placementRows.push({
        zone_id: CLUB_HOME_PLACEMENT_ZONES.leadStory,
        story_id: Number(composed.leadRow.id),
        position: 0,
        selection_mode: composed.leadSelectionMode,
        feature_size: null,
        media_rendition: null,
      });
    }
    for (const [index, row] of composed.railRows.entries()) {
      placementRows.push({
        zone_id: CLUB_HOME_PLACEMENT_ZONES.storyRail,
        story_id: Number(row.id),
        position: index,
        selection_mode: composed.railPinnedStoryId === Number(row.id) ? "pinned" : "automatic",
        feature_size: null,
        media_rendition: null,
      });
    }
    if (composed.spotlightRow) {
      placementRows.push({
        zone_id: CLUB_HOME_PLACEMENT_ZONES.archiveSpotlight,
        story_id: Number(composed.spotlightRow.id),
        position: 0,
        selection_mode: composed.spotlightSelectionMode,
        feature_size: null,
        media_rendition: null,
      });
    }
    if (composed.leadRow) {
      placementRows.push({
        zone_id: CLUB_HOME_PLACEMENT_ZONES.mediaFeature,
        story_id: Number(composed.leadRow.id),
        position: 0,
        selection_mode: composed.leadSelectionMode,
        feature_size: mediaFeature ? (mediaFeature.is_memorabilia ? "memorabilia" : "photo") : null,
        media_rendition: mediaFeature?.media_rendition ?? null,
      });
    }

    if (!placementRows.length) {
      await markEditionFailed(db, editionId, "Edition composition produced no placements.");
      return { ok: false, error: "Edition composition produced no placements.", status: 400 };
    }

    const completedAt = await nowIso(db);
    for (const row of placementRows) {
      await db
        .prepare(
          `INSERT INTO content_inventory_club_home_edition_placements
             (edition_id, zone_id, story_id, position, selection_mode, feature_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(editionId, row.zone_id, row.story_id, row.position, row.selection_mode, row.feature_size, completedAt)
        .run();
    }

    await db
      .prepare(
        `UPDATE content_inventory_club_home_editions
            SET status = ?, completed_at = ?, failure_reason = NULL
          WHERE id = ? AND status = ?`,
      )
      .bind(EDITION_STATUS.ready, completedAt, editionId, EDITION_STATUS.building)
      .run();

    // Activate only after the edition is complete/valid.
    const activated = await activateEditionPointer(db, editionId, createdBy);
    if (!activated.ok) {
      // Leave the ready edition in place but do not steal activation from a concurrent build.
      return {
        ok: false,
        error: activated.error,
        status: activated.status,
        building_edition_id: activated.building_edition_id,
      };
    }

    const historyPlacements: PlacementHistoryRecord[] = placementRows
      .filter((row) => row.story_id != null)
      .map((row) => ({
        story_id: Number(row.story_id),
        zone_id: row.zone_id,
        section_key: CLUB_HOME_SECTION,
        selection_mode: row.selection_mode,
        edition_id: editionId,
        feature_size: row.feature_size,
        media_rendition: row.media_rendition,
        placed_at: completedAt,
      }));
    await recordPlacementHistory(db, historyPlacements);

    const persisted = await listClubHomeEditionPlacements(db, editionId);
    return {
      ok: true,
      edition_id: editionId,
      activated: true,
      placements: persisted,
      previous_edition_id: previousEditionId,
    };
  } catch (err: any) {
    const message = String(err?.message || err || "Edition regeneration failed.");
    try {
      await markEditionFailed(db, editionId, message);
    } catch {
      // ignore secondary failure
    }
    return { ok: false, error: message, status: 500 };
  }
}

/**
 * Reactivate a prior ready edition without mutating its historical placements.
 */
export async function rollbackClubHomeEdition(
  db: any,
  editionId: number,
  options?: { activatedBy?: string },
): Promise<ClubHomeEditionMutationResult> {
  const activatedBy = String(options?.activatedBy || "admin-ui").trim() || "admin-ui";
  const targetId = Math.trunc(Number(editionId));
  if (!Number.isFinite(targetId) || targetId <= 0) {
    return { ok: false, error: "edition_id must be a positive integer.", status: 400 };
  }

  try {
    const building = await db
      .prepare(`SELECT id FROM content_inventory_club_home_editions WHERE status = ? LIMIT 1`)
      .bind(EDITION_STATUS.building)
      .first();
    if (building?.id) {
      return {
        ok: false,
        error: "Cannot rollback while an edition regeneration is in progress.",
        status: 409,
        building_edition_id: Number(building.id),
      };
    }

    const edition = await db.prepare(`SELECT id, status FROM content_inventory_club_home_editions WHERE id = ?`).bind(targetId).first();
    if (!edition) {
      return { ok: false, error: "Edition not found.", status: 404 };
    }
    if (String(edition.status) !== EDITION_STATUS.ready) {
      return {
        ok: false,
        error: "Only a completed ready edition can be reactivated.",
        status: 400,
      };
    }

    const placements = await listClubHomeEditionPlacements(db, targetId);
    if (!placements.length) {
      return {
        ok: false,
        error: "Target edition has no persisted placements and cannot be activated.",
        status: 400,
      };
    }

    const previous = await getActiveClubHomeEdition(db);
    const activated = await activateEditionPointer(db, targetId, activatedBy);
    if (!activated.ok) {
      return {
        ok: false,
        error: activated.error,
        status: activated.status,
        building_edition_id: activated.building_edition_id,
      };
    }

    return {
      ok: true,
      edition_id: targetId,
      activated: true,
      placements,
      previous_edition_id: previous?.edition.id ?? null,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: String(err?.message || err || "Edition rollback failed."),
      status: 503,
    };
  }
}
