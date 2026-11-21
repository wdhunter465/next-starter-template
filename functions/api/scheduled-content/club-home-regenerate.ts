// POST /api/scheduled-content/club-home-regenerate  { "apply": false }
// Scheduled Club Home edition regeneration (#4906). The admin regenerate endpoint is session-only (#3547), so an
// unattended job cannot call it; this is the bounded bridge-token route for exactly one action: build and activate a
// new Club Home edition with the same code the admin button uses (regenerateClubHomeEdition), and nothing else.
//
// Dry run by default: without "apply": true it only reports the eligible story count, the active edition and its age.
// Apply is refused when:
//   - fewer than MIN_ELIGIBLE_STORIES are eligible (seven slots per edition; below that an edition would repeat), or
//   - the date is on or after FREEZE_START (website freeze begins 2027-01-01 per Product Authority on #4764 /
//     docs correction #5437). There is no coded FREEZE_END: after the freeze starts, changes are packages in a
//     safe change window Product Authority still records (#4764); until then apply stays refused. A Production
//     Go / PR can reintroduce an end or a window when that decision exists.
// A failed regeneration leaves the prior active edition unchanged (regenerateClubHomeEdition guarantees this).

import { requireScheduledContentBridge } from "../../_lib/scheduled-content-auth";
import { CLUB_HOME_SECTION, getActiveClubHomeEdition, regenerateClubHomeEdition } from "../../_lib/content-inventory-club-home";
import { countPublishedInventoryForSection } from "../../_lib/content-inventory-public";
import { requireTables } from "../../_lib/d1";

export const MIN_ELIGIBLE_STORIES = 7;
export const FREEZE_START = "2027-01-01";
const EDITION_TABLES = [
  "content_inventory",
  "content_inventory_club_home_editions",
  "content_inventory_club_home_edition_placements",
  "content_inventory_club_home_active_edition",
];

type Context = { request: Request; env: { DB?: unknown; PUBLIC_B2_BASE_URL?: unknown; SCHEDULED_CONTENT_BRIDGE_TOKEN?: string } };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export function inFreeze(today: string): boolean {
  return today >= FREEZE_START;
}

export const onRequestPost = async (context: Context & { now?: Date }): Promise<Response> => {
  const { request, env } = context;
  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ ok: false, error: "DB binding unavailable" }, 503);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the shared edition helpers take an untyped D1 handle
  const db = env.DB as any;

  let body: { apply?: unknown } = {};
  try {
    body = ((await request.json()) as { apply?: unknown }) ?? {};
  } catch {
    body = {};
  }
  const apply = body?.apply === true;
  const today = (context.now ?? new Date()).toISOString().slice(0, 10);

  try {
    const tables = await requireTables(db, EDITION_TABLES);
    if (!tables.ok) return json(tables.body, tables.status);

    const eligible = await countPublishedInventoryForSection(db, CLUB_HOME_SECTION);
    const active = await getActiveClubHomeEdition(db);
    const status = {
      eligible_stories: eligible,
      active_edition_id: active?.edition.id ?? null,
      active_activated_at: active?.active.activated_at ?? null,
      freeze: inFreeze(today),
    };
    if (!apply) return json({ ok: true, applied: false, ...status });

    if (inFreeze(today)) return json({ ok: true, applied: false, skipped: "launch_freeze", ...status });
    if (eligible < MIN_ELIGIBLE_STORIES) return json({ ok: true, applied: false, skipped: "fewer_than_7_eligible", ...status });

    const result = await regenerateClubHomeEdition(db, {
      createdBy: "scheduled-regenerate",
      request,
      publicB2BaseUrl: env.PUBLIC_B2_BASE_URL,
    });
    if (!result.ok) return json({ ok: false, error: result.error, building_edition_id: result.building_edition_id ?? null }, result.status);
    return json({
      ok: true,
      applied: true,
      edition_id: result.edition_id,
      previous_edition_id: result.previous_edition_id,
      placements: result.placements.length,
      eligible_stories: eligible,
    });
  } catch (err) {
    console.error("scheduled club home regenerate error:", err);
    return json({ ok: false, error: "Regeneration failed." }, 500);
  }
};
