// Shared hand-rolled D1 test double for content_blocks scheduled-publish
// tests (#4253). Mutable, unlike the read-only mocks used elsewhere, because
// these routes actually INSERT/UPDATE content_blocks and content_revisions.

export type ContentBlockRow = {
  key: string;
  page: string;
  section: string;
  title: string;
  body_md: string;
  status: 'draft' | 'published';
  published_body_md: string | null;
  version: number;
  updated_at: string;
  published_at: string | null;
  updated_by: string;
  scheduled_publish_at: string | null;
  social_caption: string | null;
};

export function makeScheduledContentDb(initialRows: ContentBlockRow[] = [], now = '2027-02-01 15:00:00') {
  const rows = new Map<string, ContentBlockRow>(initialRows.map((r) => [r.key, { ...r }]));
  const revisions: unknown[][] = [];

  function statement(sql: string, args: unknown[]) {
    return {
      first: async () => {
        if (sql.includes("datetime('now')")) return { now };
        if (sql.includes('SELECT key, version, status FROM content_blocks')) {
          const [key] = args;
          return rows.get(String(key)) || null;
        }
        return null;
      },
      all: async () => {
        if (sql.includes('scheduled_publish_at <= datetime')) {
          const due = [...rows.values()]
            .filter((r) => r.status === 'draft' && r.scheduled_publish_at && r.scheduled_publish_at <= now)
            .sort((a, b) => String(a.scheduled_publish_at).localeCompare(String(b.scheduled_publish_at)));
          return { results: due };
        }
        if (sql.includes("status = 'published'") && sql.includes('LIMIT')) {
          const [, , limit] = args;
          const published = [...rows.values()]
            .filter((r) => r.status === 'published')
            .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
          return { results: published.slice(0, Number(limit) || 30) };
        }
        if (sql.includes('ORDER BY COALESCE(scheduled_publish_at')) {
          const all = [...rows.values()].sort((a, b) =>
            String(b.scheduled_publish_at || b.published_at || b.updated_at).localeCompare(
              String(a.scheduled_publish_at || a.published_at || a.updated_at),
            ),
          );
          return { results: all };
        }
        return { results: [] };
      },
      run: async () => {
        if (sql.includes('INSERT INTO content_blocks')) {
          const [key, page, section, title, body_md, updated_at, updated_by, scheduled_publish_at, social_caption] = args;
          rows.set(String(key), {
            key: String(key),
            page: String(page),
            section: String(section),
            title: String(title),
            body_md: String(body_md),
            status: 'draft',
            published_body_md: null,
            version: 1,
            updated_at: String(updated_at),
            published_at: null,
            updated_by: String(updated_by),
            scheduled_publish_at: (scheduled_publish_at as string) ?? null,
            social_caption: (social_caption as string) ?? null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('UPDATE content_blocks') && sql.includes('SET title')) {
          const [title, body_md, version, updated_at, updated_by, scheduled_publish_at, social_caption, key] = args;
          const existing = rows.get(String(key));
          if (!existing) return { meta: { changes: 0 } };
          Object.assign(existing, {
            title: String(title),
            body_md: String(body_md),
            status: 'draft',
            version: Number(version),
            updated_at: String(updated_at),
            updated_by: String(updated_by),
            scheduled_publish_at: (scheduled_publish_at as string) ?? null,
            social_caption: (social_caption as string) ?? null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes("SET status = 'published'")) {
          const [published_at, version, updated_at, updated_by, key] = args;
          const existing = rows.get(String(key));
          if (!existing || existing.status !== 'draft') return { meta: { changes: 0 } };
          Object.assign(existing, {
            status: 'published',
            published_body_md: existing.body_md,
            published_at: String(published_at),
            version: Number(version),
            updated_at: String(updated_at),
            updated_by: String(updated_by),
            scheduled_publish_at: null,
          });
          return { meta: { changes: 1 } };
        }
        if (sql.includes('INSERT INTO content_revisions')) {
          revisions.push(args);
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
    };
  }

  return {
    prepare: (sql: string) => ({
      ...statement(sql, []),
      bind: (...args: unknown[]) => statement(sql, args),
    }),
    _rows: rows,
    _revisions: revisions,
  };
}
