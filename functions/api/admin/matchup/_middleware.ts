import { isWeeklyMatchupHeld } from "../../../../src/lib/matchup-hold";
import { matchupHoldResponse } from "../../../_lib/matchup-hold";

export const onRequest = async (context: any): Promise<Response> => {
  // #3548: block all admin matchup reads and mutations during the media-rights hold.
  if (isWeeklyMatchupHeld()) return matchupHoldResponse();
  return context.next();
};
