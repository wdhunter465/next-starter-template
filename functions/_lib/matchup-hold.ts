import { WEEKLY_MATCHUP_HOLD } from "../../src/lib/matchup-hold";

export { isWeeklyMatchupHeld, WEEKLY_MATCHUP_HOLD } from "../../src/lib/matchup-hold";

export function matchupHoldResponse(): Response {
  return new Response(
    JSON.stringify(
      {
        ok: false,
        paused: true,
        error: "weekly_matchup_paused",
        reason: WEEKLY_MATCHUP_HOLD.reason,
        message: WEEKLY_MATCHUP_HOLD.message,
        items: [],
      },
      null,
      2,
    ),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
