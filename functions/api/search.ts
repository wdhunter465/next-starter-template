import { getSessionEmail, getSessionId } from '../_lib/session';
import { requireD1 } from '../_lib/d1';
import {
  fetchSearchInventoryResults,
  resolveMemberLibrarySearchResults,
  SEARCH_SECTION,
  tableExists,
} from '../_lib/content-inventory-public';
import { rightsClearedClause } from '../_lib/rights-hold';

type SearchResult = {
  type: string;
  title: string;
  excerpt: string;
  url: string;
  score: number;
};

function excerpt(value: unknown, max = 120): string {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function scoreForMatch(title: string, body: string, query: string): number {
  const q = query.toLowerCase();
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let score = 0;
  if (t.includes(q)) score += 3;
  if (b.includes(q)) score += 1;
  return score;
}

async function runLikeQuery(
  db: any,
  sql: string,
  args: any[],
): Promise<any[]> {
  const rows = await db.prepare(sql).bind(...args).all();
  return rows.results ?? [];
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request } = context;
  const d1 = requireD1(context.env);
  if (!d1.ok) {
    return new Response(JSON.stringify(d1.body), {
      status: d1.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
    const pageSize = 20;

    if (q.length < 2) {
      return new Response(
        JSON.stringify({ ok: true, query: q, page, pages: 0, total: 0, results: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const like = `%${q.toLowerCase()}%`;
    const sessionId = getSessionId(request);
    const memberEmail = await getSessionEmail(d1.db, sessionId);
    const isMember = Boolean(memberEmail);

    const results: SearchResult[] = [];

    const faqRows = await runLikeQuery(
      d1.db,
      `SELECT id, question, answer, view_count
       FROM faq_entries
       WHERE status='approved' AND answer IS NOT NULL AND answer != ''
         AND (lower(question) LIKE ?1 OR lower(answer) LIKE ?1)
       ORDER BY pinned DESC, view_count DESC, id DESC
       LIMIT 30`,
      [like],
    );
    for (const row of faqRows) {
      const title = String(row.question || 'FAQ');
      results.push({
        type: 'FAQ',
        title,
        excerpt: excerpt(row.answer),
        url: '/faq',
        score: scoreForMatch(title, String(row.answer || ''), q),
      });
    }

    const eventRows = await runLikeQuery(
      d1.db,
      `SELECT id, title, description, start_date
       FROM events
       WHERE status='posted'
         AND (lower(title) LIKE ?1 OR lower(COALESCE(description,'')) LIKE ?1 OR lower(COALESCE(location,'')) LIKE ?1)
       ORDER BY start_date ASC, id ASC
       LIMIT 30`,
      [like],
    );
    for (const row of eventRows) {
      const title = String(row.title || 'Event');
      const body = String(row.description || row.location || '');
      results.push({
        type: 'Event',
        title,
        excerpt: excerpt(body || row.start_date),
        url: '/events',
        score: scoreForMatch(title, body, q),
      });
    }

    const milestoneRows = await runLikeQuery(
      d1.db,
      `SELECT id, title, description, year
       FROM milestones
       WHERE status='posted'
         AND (lower(title) LIKE ?1 OR lower(COALESCE(description,'')) LIKE ?1)
       ORDER BY year DESC, id DESC
       LIMIT 30`,
      [like],
    );
    for (const row of milestoneRows) {
      const title = String(row.title || 'Milestone');
      const body = String(row.description || '');
      results.push({
        type: 'Milestone',
        title: `${row.year ? `${row.year}: ` : ''}${title}`,
        excerpt: excerpt(body),
        url: '/',
        score: scoreForMatch(title, body, q),
      });
    }

    const friendRows = await runLikeQuery(
      d1.db,
      `SELECT id, name, blurb, url
       FROM friends
       WHERE status='posted'
         AND (lower(name) LIKE ?1 OR lower(COALESCE(blurb,'')) LIKE ?1)
       ORDER BY name ASC
       LIMIT 20`,
      [like],
    );
    for (const row of friendRows) {
      const title = String(row.name || 'Friend');
      const body = String(row.blurb || '');
      results.push({
        type: 'Friend',
        title,
        excerpt: excerpt(body),
        url: String(row.url || '/'),
        score: scoreForMatch(title, body, q),
      });
    }

    if (await tableExists(d1.db, 'content_inventory')) {
      const archiveHits = await fetchSearchInventoryResults(d1.db, {
        sectionKey: SEARCH_SECTION,
        q,
        limit: 30,
      });
      for (const hit of archiveHits) {
        results.push({
          type: 'Archive',
          title: hit.title,
          excerpt: excerpt(hit.excerpt),
          url: hit.url,
          score: scoreForMatch(hit.title, hit.body, q),
        });
      }
    }

    if (isMember) {
      const discussionRows = await runLikeQuery(
        d1.db,
        `SELECT id, title, body
         FROM discussions
         WHERE status='posted'
           AND (lower(title) LIKE ?1 OR lower(body) LIKE ?1)
         ORDER BY created_at DESC, id DESC
         LIMIT 30`,
        [like],
      );
      for (const row of discussionRows) {
        const title = String(row.title || 'Discussion');
        const body = String(row.body || '');
        results.push({
          type: 'Discussion',
          title,
          excerpt: excerpt(body),
          url: '/fanclub',
          score: scoreForMatch(title, body, q),
        });
      }

      const libraryResolution = await resolveMemberLibrarySearchResults(d1.db, { q, limit: 20 });
      for (const hit of libraryResolution.items) {
        results.push({
          type: 'Library',
          title: hit.title,
          excerpt: excerpt(hit.excerpt),
          url: hit.url,
          score: scoreForMatch(hit.title, hit.body, q),
        });
      }

      const photoRows = await runLikeQuery(
        d1.db,
        `SELECT id, title, description
         FROM photos
         WHERE (is_memorabilia IS NULL OR is_memorabilia = 0)
           AND ${rightsClearedClause()}
           AND (lower(COALESCE(title,'')) LIKE ?1 OR lower(COALESCE(description,'')) LIKE ?1 OR lower(COALESCE(tags,'')) LIKE ?1)
         ORDER BY id DESC
         LIMIT 20`,
        [like],
      );
      for (const row of photoRows) {
        const title = String(row.title || 'Photo');
        const body = String(row.description || '');
        results.push({
          type: 'Photo',
          title,
          excerpt: excerpt(body),
          url: '/fanclub/photo',
          score: scoreForMatch(title, body, q),
        });
      }

      const memorabiliaRows = await runLikeQuery(
        d1.db,
        `SELECT id, title, description
         FROM photos
         WHERE is_memorabilia = 1
           AND ${rightsClearedClause()}
           AND (lower(COALESCE(title,'')) LIKE ?1 OR lower(COALESCE(description,'')) LIKE ?1 OR lower(COALESCE(tags,'')) LIKE ?1)
         ORDER BY id DESC
         LIMIT 20`,
        [like],
      );
      for (const row of memorabiliaRows) {
        const title = String(row.title || 'Memorabilia');
        const body = String(row.description || '');
        results.push({
          type: 'Memorabilia',
          title,
          excerpt: excerpt(body),
          url: '/fanclub/memorabilia',
          score: scoreForMatch(title, body, q),
        });
      }
    }

    const ranked = results
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

    const total = ranked.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * pageSize;
    const pageResults = ranked.slice(start, start + pageSize);

    return new Response(
      JSON.stringify({
        ok: true,
        query: q,
        page: safePage,
        pages,
        total,
        isMember,
        results: pageResults,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
