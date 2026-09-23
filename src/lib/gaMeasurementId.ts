/** Product-owned GA4 web stream for lougehrigfanclub.com (#4350). Public client id. */
export const PRODUCTION_GA_MEASUREMENT_ID = 'G-BRV48J1VEJ';

/**
 * Resolve the GA4 Measurement ID for a static export build.
 * Preview Cloudflare Pages branches never emit an id (even if env is set).
 * Production `main` Pages builds always bake the Product id so a truncated
 * Cloudflare env value cannot win.
 * Local/dev builds omit GA unless NEXT_PUBLIC_GA_ID is set explicitly.
 */
export function resolveGaMeasurementId(
  env: Record<string, string | undefined> = process.env,
): string {
  const branch = String(env.CF_PAGES_BRANCH || '').trim();
  const onPages = env.CF_PAGES === '1' || Boolean(branch);
  if (onPages && branch !== 'main') {
    return '';
  }
  if (branch === 'main') return PRODUCTION_GA_MEASUREMENT_ID;

  const explicit = String(env.NEXT_PUBLIC_GA_ID || '').trim();
  return explicit;
}
