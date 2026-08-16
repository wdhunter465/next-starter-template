import { isWeeklyMatchupHeld } from "../../../src/lib/matchup-hold";
import { matchupHoldResponse } from "../../_lib/matchup-hold";

export const onRequest = async (context: any): Promise<Response> => {
  // #3548: intercept every /api/matchup/* request before its handler can read or mutate D1.
  if (isWeeklyMatchupHeld()) return matchupHoldResponse();
  return context.next();
};
