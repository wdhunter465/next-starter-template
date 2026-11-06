// #5116: asks Elfsight why the social wall widget is not showing, so a fallback can be logged with a
// real reason. Elfsight's boot endpoint answers HTTP 200 either way and states the condition in its body:
//   {"status":1,"data":{"widgets":{"<id>":{"status":0,"reason":"APP_VIEWS_LIMIT_REACHED"}}}}
// A working widget has status 1.

export const SOCIAL_WALL_ELFSIGHT_WIDGET_UUID = '805f3c5c-67cd-4edf-bde6-2d5978e386a8';
export const SOCIAL_WALL_PAGE = 'https://www.lougehrigfanclub.com/';
export const ELFSIGHT_BOOT_URL = 'https://core.service.elfsight.com/p/boot/';
export const ELFSIGHT_TIMEOUT_MS = 4000;
export const REASON_CACHE_MS = 5 * 60 * 1000;

export const REASON_UNREACHABLE = 'ELFSIGHT_UNREACHABLE';
export const REASON_CLIENT_RENDER_FAILED = 'CLIENT_RENDER_FAILED';

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** Turns Elfsight's boot body into the reason to log. Anything unexpected is treated as unreachable. */
export function reasonFromBoot(body: unknown, widgetUuid = SOCIAL_WALL_ELFSIGHT_WIDGET_UUID): string {
  const widget = (body as any)?.data?.widgets?.[widgetUuid];
  if (!widget || typeof widget !== 'object') return REASON_UNREACHABLE;
  if (Number(widget.status) === 1) return REASON_CLIENT_RENDER_FAILED;
  const reason = typeof widget.reason === 'string' ? widget.reason.trim() : '';
  return /^[A-Z0-9_]{3,64}$/.test(reason) ? reason : REASON_UNREACHABLE;
}

let cached: { reason: string; at: number } | null = null;

/** Elfsight's current reason for the widget, cached for five minutes. Never throws. */
export async function currentWidgetReason(options?: { fetchImpl?: FetchLike; now?: number }): Promise<string> {
  const now = options?.now ?? Date.now();
  if (cached && now - cached.at < REASON_CACHE_MS) return cached.reason;

  let reason = REASON_UNREACHABLE;
  try {
    const url = `${ELFSIGHT_BOOT_URL}?page=${encodeURIComponent(SOCIAL_WALL_PAGE)}&w=${SOCIAL_WALL_ELFSIGHT_WIDGET_UUID}`;
    const run = options?.fetchImpl ?? ((input: string, init?: RequestInit) => fetch(input, init));
    const response = await run(url, { signal: AbortSignal.timeout(ELFSIGHT_TIMEOUT_MS), headers: { Accept: 'application/json' } });
    if (response.ok) reason = reasonFromBoot(await response.json());
  } catch {
    reason = REASON_UNREACHABLE;
  }
  cached = { reason, at: now };
  return reason;
}

export function resetWidgetReasonCache(): void {
  cached = null;
}
