// functions/_lib/givebutter.ts
// Read-only Givebutter API client for the 2027 fundraiser leaderboard (#4993, #4432).
//
// Boundary rule (#4139): LGFC keeps zero donor or user information from Givebutter.
// The members endpoint returns email and phone, so every response is reduced to an
// explicit allowlist of aggregate fields here, before anything is returned, stored
// or logged. Never log a response body, a request header or the API key.

export const GIVEBUTTER_API_ORIGIN = "https://api.givebutter.com";
const GIVEBUTTER_API_BASE = `${GIVEBUTTER_API_ORIGIN}/v1`;
const GIVEBUTTER_PAGE_ORIGIN = "https://givebutter.com";
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 10_000;

export type GivebutterCampaignTotals = {
  title: string;
  status: string;
  raised: number;
  goal: number | null;
  supporters: number;
};

export type GivebutterParticipant = {
  id: string;
  displayName: string;
  raised: number;
  goal: number | null;
  supporters: number;
  pageUrl: string | null;
};

export type GivebutterTeam = {
  id: string;
  name: string;
  raised: number;
  goal: number | null;
  supporters: number;
  members: number;
};

export type GivebutterSnapshot = {
  capturedAt: string;
  campaign: GivebutterCampaignTotals;
  participants: GivebutterParticipant[];
  teams: GivebutterTeam[];
};

export type GivebutterErrorCode =
  | "not_configured"
  | "http_error"
  | "network_error"
  | "invalid_response"
  | "too_many_pages";

/** Carries a code and a short message only: never a response body or the key. */
export class GivebutterError extends Error {
  code: GivebutterErrorCode;
  status?: number;

  constructor(code: GivebutterErrorCode, message: string, status?: number) {
    super(message);
    this.name = "GivebutterError";
    this.code = code;
    this.status = status;
  }
}

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(what: string): never {
  throw new GivebutterError("invalid_response", `Invalid Givebutter ${what}.`);
}

function amount(value: unknown, what: string): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) invalid(what);
  return n;
}

function count(value: unknown, what: string): number {
  const n = amount(value, what);
  if (!Number.isInteger(n)) invalid(what);
  return n;
}

function goalOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

function text(value: unknown, what: string): string {
  if (typeof value !== "string" || value.trim() === "") invalid(what);
  return value.trim();
}

function id(value: unknown, what: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return text(value, what);
}

/** Only a givebutter.com page link survives; any other host is dropped. */
function givebutterPageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.origin !== GIVEBUTTER_PAGE_ORIGIN && url.origin !== "https://www.givebutter.com") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeCampaign(raw: unknown): GivebutterCampaignTotals {
  const source = isRecord(raw) && isRecord(raw.data) ? raw.data : raw;
  if (!isRecord(source)) invalid("campaign");
  return {
    title: text(source.title, "campaign title"),
    status: text(source.status, "campaign status"),
    raised: amount(source.raised, "campaign raised"),
    goal: goalOrNull(source.goal),
    supporters: count(source.donors ?? 0, "campaign supporters"),
  };
}

export function normalizeParticipant(raw: unknown): GivebutterParticipant {
  if (!isRecord(raw)) invalid("participant");
  return {
    id: id(raw.id, "participant id"),
    displayName: text(raw.display_name, "participant display name"),
    raised: amount(raw.raised, "participant raised"),
    goal: goalOrNull(raw.goal),
    supporters: count(raw.donors ?? 0, "participant supporters"),
    pageUrl: givebutterPageUrl(raw.url),
  };
}

export function normalizeTeam(raw: unknown): GivebutterTeam {
  if (!isRecord(raw)) invalid("team");
  return {
    id: id(raw.id, "team id"),
    name: text(raw.name, "team name"),
    raised: amount(raw.raised, "team raised"),
    goal: goalOrNull(raw.goal),
    supporters: count(raw.supporters ?? 0, "team supporters"),
    members: count(raw.members ?? 0, "team members"),
  };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

async function getJson(fetchImpl: FetchLike, url: string, apiKey: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    throw new GivebutterError("network_error", "Could not reach Givebutter.");
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new GivebutterError("http_error", `Givebutter returned HTTP ${response.status}.`, response.status);
  }
  try {
    return await response.json();
  } catch {
    throw new GivebutterError("invalid_response", "Givebutter returned a body that is not JSON.");
  }
}

/** Follows `links.next` across pages. A next link on any other host is refused. */
async function getAllPages(fetchImpl: FetchLike, firstUrl: string, apiKey: string): Promise<unknown[]> {
  const items: unknown[] = [];
  let url: string | null = firstUrl;
  for (let page = 0; url; page += 1) {
    if (page >= MAX_PAGES) throw new GivebutterError("too_many_pages", "Givebutter returned too many pages.");
    const body = await getJson(fetchImpl, url, apiKey);
    if (!isRecord(body) || !Array.isArray(body.data)) invalid("list response");
    items.push(...body.data);
    const next: unknown = isRecord(body.links) ? body.links.next : null;
    if (typeof next === "string" && next) {
      if (!next.startsWith(`${GIVEBUTTER_API_ORIGIN}/`)) invalid("pagination link");
      url = next;
    } else {
      url = null;
    }
  }
  return items;
}

export function givebutterConfigFromEnv(env: Record<string, unknown> | undefined): {
  apiKey: string;
  campaignId: string;
} | null {
  const apiKey = String(env?.GIVEBUTTER_API_KEY ?? "").trim();
  const campaignId = String(env?.GIVEBUTTER_CAMPAIGN_ID ?? "").trim();
  if (!apiKey || !/^[0-9]+$/.test(campaignId)) return null;
  return { apiKey, campaignId };
}

/**
 * Reads the campaign, its participants and its teams. Throws GivebutterError
 * rather than returning a partial snapshot: a wrong number is worse than none.
 */
export async function fetchGivebutterSnapshot(opts: {
  apiKey: string;
  campaignId: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}): Promise<GivebutterSnapshot> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const base = `${GIVEBUTTER_API_BASE}/campaigns/${encodeURIComponent(opts.campaignId)}`;

  const campaign = normalizeCampaign(await getJson(fetchImpl, base, opts.apiKey));
  const participants = (await getAllPages(fetchImpl, `${base}/members`, opts.apiKey)).map(normalizeParticipant);
  const teams = (await getAllPages(fetchImpl, `${base}/teams`, opts.apiKey)).map(normalizeTeam);

  return {
    capturedAt: (opts.now ? opts.now() : new Date()).toISOString(),
    campaign,
    participants,
    teams,
  };
}
