// Shared pieces for the threaded Member Chat (#5550).

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const BODY_MIN = 2;
export const BODY_MAX = 4000;

/**
 * Display name for a post's author, from the join_requests row aliased `j`: the screen name, else
 * first name plus last initial ("Bill H."), else "Member". The email address is never part of it.
 */
export const DISPLAY_NAME_SQL = `COALESCE(
  NULLIF(TRIM(j.screen_name), ''),
  CASE WHEN TRIM(COALESCE(j.first_name, '')) <> ''
       THEN TRIM(j.first_name) || CASE WHEN TRIM(COALESCE(j.last_name, '')) <> ''
                                       THEN ' ' || UPPER(SUBSTR(TRIM(j.last_name), 1, 1)) || '.'
                                       ELSE '' END
  END,
  'Member')`;

export const AUTHOR_JOIN = `LEFT JOIN join_requests j ON lower(j.email) = lower(d.author_email)`;

export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

/** One topic as the browser sees it. `mine` is true for the signed-in member's own topics. */
export const TOPIC_COLUMNS = `d.id, d.title, d.body, d.created_at, d.closed_at,
  (lower(d.author_email) = lower(?1)) AS mine,
  CASE WHEN lower(d.author_email) = lower(?1) THEN d.notify_author END AS notify_author,
  ${DISPLAY_NAME_SQL} AS author_name,
  (SELECT COUNT(1) FROM discussions r WHERE r.parent_id = d.id AND r.status = 'posted') AS reply_count,
  COALESCE((SELECT MAX(r.created_at) FROM discussions r WHERE r.parent_id = d.id AND r.status = 'posted'), d.created_at) AS last_activity`;
