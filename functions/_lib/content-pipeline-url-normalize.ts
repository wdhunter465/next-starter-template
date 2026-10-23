// #4592: one spelling for "is this the same page?" comparisons.
// Stored source_url values are not rewritten. Callers compare this form.
//
// Rules, applied in order. Conservative: a difference that might be a
// different page is kept.
// 1. Trim. Reject anything that is not http or https.
// 2. Drop the fragment.
// 3. Force https. Leave the path, userinfo, and non-default port unchanged.
// 4. Lowercase the host only. Strip a leading www.
// 5. Drop default ports :80 and :443.
// 6. Drop a trailing slash on the path. The site root has no slash.
// 7. Drop tracking parameters utm_*, fbclid, and gclid. Sort the rest as raw
//    text. Do not decode or re-encode, so two encodings of the same character
//    stay different.
// 8. Different paths and different remaining query values do not match.

export function normalizeSourceUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hashAt = trimmed.indexOf('#');
  const hashless = hashAt >= 0 ? trimmed.slice(0, hashAt) : trimmed;
  const match = /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?$/i.exec(hashless);
  if (!match) return null;
  const hostport = normalizeHost(match[2]);
  if (!hostport) return null;
  const path = normalizePath(match[3] ?? '');
  const query = normalizeQuery(match[4] ? match[4].slice(1) : '');
  return `https://${hostport}${path}${query ? `?${query}` : ''}`;
}

export function sourceUrlsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeSourceUrl(left);
  const b = normalizeSourceUrl(right);
  return a !== null && a === b;
}

function normalizeHost(hostport: string): string | null {
  const at = hostport.lastIndexOf('@');
  const userinfo = at >= 0 ? hostport.slice(0, at + 1) : '';
  let host = (at >= 0 ? hostport.slice(at + 1) : hostport).toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  if (host.endsWith(':443') || host.endsWith(':80')) host = host.slice(0, host.lastIndexOf(':'));
  if (!host) return null;
  return `${userinfo}${host}`;
}

function normalizePath(path: string): string {
  if (path === '/' || path === '') return '';
  return path.replace(/\/+$/, '');
}

function normalizeQuery(query: string): string {
  return query
    .split('&')
    .filter((param) => param.length > 0 && !isTrackingParam(param))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join('&');
}

function isTrackingParam(param: string): boolean {
  const key = (param.split('=')[0] ?? '').toLowerCase();
  return key.startsWith('utm_') || key === 'fbclid' || key === 'gclid';
}

// SQL twin of normalizeSourceUrl. Both sides of a comparison must use this
// expression so a stored spelling and a new spelling are judged the same way.
// `expr` is a SQL expression controlled by the caller, not a URL value.
export function normalizedSourceUrlSql(expr: string): string {
  const hostSql = (hostExpr: string) => {
    const lowered = `lower(${hostExpr})`;
    const stripped = `CASE WHEN ${lowered} LIKE 'www.%' THEN substr(${lowered}, 5) ELSE ${lowered} END`;
    return `CASE
      WHEN substr(${stripped}, -4) = ':443' THEN substr(${stripped}, 1, length(${stripped}) - 4)
      WHEN substr(${stripped}, -3) = ':80' THEN substr(${stripped}, 1, length(${stripped}) - 3)
      ELSE ${stripped}
    END`;
  };
  return `(
    WITH raw(u) AS (SELECT trim(${expr})),
    hashless(u) AS (
      SELECT CASE WHEN instr(u, '#') > 0 THEN substr(u, 1, instr(u, '#') - 1) ELSE u END FROM raw
    ),
    body(rest) AS (
      SELECT CASE
        WHEN lower(substr(u, 1, 8)) = 'https://' THEN substr(u, 9)
        WHEN lower(substr(u, 1, 7)) = 'http://' THEN substr(u, 8)
        ELSE NULL
      END
      FROM hashless
    ),
    splitq(hostpath, query) AS (
      SELECT
        CASE WHEN instr(rest, '?') > 0 THEN substr(rest, 1, instr(rest, '?') - 1) ELSE rest END,
        CASE WHEN instr(rest, '?') > 0 THEN substr(rest, instr(rest, '?') + 1) ELSE '' END
      FROM body
      WHERE rest IS NOT NULL
    ),
    parts(hostport, path, query) AS (
      SELECT
        CASE WHEN instr(hostpath, '/') > 0 THEN substr(hostpath, 1, instr(hostpath, '/') - 1) ELSE hostpath END,
        CASE WHEN instr(hostpath, '/') > 0 THEN substr(hostpath, instr(hostpath, '/')) ELSE '' END,
        query
      FROM splitq
    ),
    shaped(hostport, path, query) AS (
      SELECT
        CASE
          WHEN instr(hostport, '@') > 0 THEN substr(hostport, 1, instr(hostport, '@')) || ${hostSql(`substr(hostport, instr(hostport, '@') + 1)`)}
          ELSE ${hostSql('hostport')}
        END,
        CASE
          WHEN path = '/' OR path = '' THEN ''
          WHEN substr(path, -1) = '/' THEN substr(path, 1, length(path) - 1)
          ELSE path
        END,
        query
      FROM parts
    ),
    filtered(query) AS (
      SELECT group_concat(param, '&' ORDER BY param)
      FROM (
        WITH RECURSIVE walk(rest, param) AS (
          SELECT
            CASE WHEN query = '' THEN '' ELSE substr(query || '&', instr(query || '&', '&') + 1) END,
            CASE WHEN query = '' THEN '' ELSE substr(query || '&', 1, instr(query || '&', '&') - 1) END
          FROM shaped
          UNION ALL
          SELECT
            CASE WHEN rest = '' OR instr(rest, '&') = 0 THEN '' ELSE substr(rest, instr(rest, '&') + 1) END,
            CASE WHEN rest = '' THEN '' WHEN instr(rest, '&') = 0 THEN rest ELSE substr(rest, 1, instr(rest, '&') - 1) END
          FROM walk
          WHERE rest <> ''
        )
        SELECT param FROM walk
        WHERE param <> ''
          AND lower(CASE WHEN instr(param, '=') > 0 THEN substr(param, 1, instr(param, '=') - 1) ELSE param END) NOT LIKE 'utm_%'
          AND lower(CASE WHEN instr(param, '=') > 0 THEN substr(param, 1, instr(param, '=') - 1) ELSE param END) NOT IN ('fbclid', 'gclid')
      )
    )
    SELECT CASE
      WHEN hostport IS NULL OR hostport = '' THEN NULL
      ELSE 'https://' || hostport || path || CASE WHEN (SELECT query FROM filtered) IS NULL OR (SELECT query FROM filtered) = '' THEN '' ELSE '?' || (SELECT query FROM filtered) END
    END
    FROM shaped
  )`;
}
