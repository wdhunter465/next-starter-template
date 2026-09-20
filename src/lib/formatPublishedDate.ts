// #4253 -- content_blocks.published_at comes back from D1/SQLite as a naive
// "YYYY-MM-DD HH:MM:SS" string in UTC (via datetime('now')), with no 'T' or
// 'Z'. Passing that straight to `new Date(...)` is not reliably parseable
// across browsers and can be interpreted as local time instead of UTC.

export function parseSqliteUtcTimestamp(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}

export function formatPublishedDate(value: string): string {
  return parseSqliteUtcTimestamp(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
