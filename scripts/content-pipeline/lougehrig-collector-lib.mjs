// Pure helpers for the lougehrig.com discovery source (#4839). No network, no D1, no B2.
//
// lougehrig.com is a WordPress site run for CMG Worldwide. Its REST API (`/index.php/wp-json/wp/v2/`)
// serves the pages, news posts and media records, so nothing here scrapes a page layout except the
// photo gallery, whose per-photo captions (and the credit inside each) exist only in the gallery
// page's HTML. Product Authority decisions (2026-10-24, 2026-11-19): collect the URL and provenance of
// everything found; photos credited to AP or Getty are held and not hosted; news is eligible for the
// fan club section only within 12 months. Collection never decides rights.

export const LOUGEHRIG_ORIGIN = 'https://lougehrig.com';
export const LOUGEHRIG_REST = `${LOUGEHRIG_ORIGIN}/index.php/wp-json/wp/v2`;
export const LOUGEHRIG_SOURCE_NAME = 'lougehrig.com (CMG Worldwide)';
export const LOUGEHRIG_NEWS_FRESH_MONTHS = 12;

// The About pages Product Authority named on 2026-10-24, by WordPress slug.
export const LOUGEHRIG_ABOUT_SLUGS = Object.freeze([
  'achievements',
  'als',
  'awards',
  'biography',
  'farewell-speech',
  'quotes',
  'rip-van-winkle-foundation',
]);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function htmlToText(html) {
  return decodeEntities(String(html ?? '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Credit inside a gallery caption. The site writes "(AP Photo)" or "(Photo by <name>/Getty Images)".
 * Returns the credit line as written, and which agency (if any) it names. An agency match means the
 * photo is third-party material that is held and not hosted (Product Authority, 2026-11-19).
 */
export function extractCredit(caption) {
  const text = String(caption ?? '');
  const parens = [...text.matchAll(/\(([^()]*(?:AP Photo|Getty|Photo by|Pictorial Parade|Transcendental)[^()]*)\)/gi)];
  const creditLine = parens.length ? parens[parens.length - 1][1].trim() : '';
  const haystack = `${creditLine} ${text}`;
  const agencies = [];
  if (/\bAP Photo\b|\bAssociated Press\b/i.test(haystack)) agencies.push('ap');
  if (/\bGetty\b/i.test(haystack)) agencies.push('getty');
  return { creditLine: creditLine || null, agencies, thirdParty: agencies.length > 0 };
}

/**
 * The gallery page's `<figure class='gallery-item'>` blocks. Each carries a thumbnail and a
 * `<figcaption id='gallery-1-<media id>'>` with the caption text (and so the credit). The media id
 * ties the caption to the media record, so a credit applies to its own photo, not the whole page.
 */
export function parseGalleryFigures(html) {
  const figures = [];
  for (const block of String(html ?? '').split(/<figure\b/i).slice(1)) {
    const end = block.search(/<\/figure>/i);
    const body = end === -1 ? block : block.slice(0, end);
    const img = /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(body);
    const cap = /<figcaption\b[^>]*\bid=["'][^"']*?-(\d+)["'][^>]*>([\s\S]*?)<\/figcaption>/i.exec(body);
    if (!img) continue;
    const link = /<a\b[^>]*\bhref=["']([^"']+\.(?:jpe?g|png))["']/i.exec(body);
    const caption = cap ? htmlToText(cap[2]) : '';
    figures.push({
      mediaId: cap ? Number(cap[1]) : null,
      thumbnailUrl: img[1],
      fullUrl: link ? link[1] : fullSizeFromThumbnail(img[1]),
      caption,
      ...extractCredit(caption),
    });
  }
  return figures;
}

/** `name-150x150.jpg` -> `name.jpg` (WordPress thumbnail naming). */
export function fullSizeFromThumbnail(url) {
  return String(url ?? '').replace(/-\d{2,4}x\d{2,4}(\.[a-z0-9]+)$/i, '$1');
}

/**
 * Freshness of a news item for the fan club news section: within `months` months of `now`.
 * Older items are still recorded (everything found is collected); they are only not eligible.
 */
export function newsFreshness(dateIso, now = new Date(), months = LOUGEHRIG_NEWS_FRESH_MONTHS) {
  const published = new Date(dateIso);
  if (Number.isNaN(published.getTime())) return 'unknown';
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return published.getTime() >= cutoff.getTime() ? 'current' : 'older';
}

const ALS_PATTERN = /\bals\b|\bamyotrophic\b|\bgehrig['’]?s\s+disease\b/i;

/**
 * The 2026-11-01 content rule (#5044): ALS as a disease is out of scope. Two tags only, never a decision:
 * `als-subject` when the page slug or title is about ALS, and `als-mentioned` when only the body says so
 * (a Lou Gehrig Day article often does). The content quality gate makes the call.
 */
export function isAlsSubject({ slug = '', title = '' } = {}) {
  return slug === 'als' || ALS_PATTERN.test(String(title));
}

export function isAlsMentioned({ text = '' } = {}) {
  return ALS_PATTERN.test(String(text));
}

function alsTags({ slug = '', title = '', text = '' }) {
  if (isAlsSubject({ slug, title })) return ['als-subject'];
  return isAlsMentioned({ text }) ? ['als-mentioned'] : [];
}

export function dateOnly(value) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value ?? ''));
  return match ? match[1] : undefined;
}

/**
 * Turn the three REST/HTML inputs into plain field objects for the collector's `baseCandidate`.
 * Pure: pass `now` so freshness is testable.
 *
 * @param {{ pages: object[], posts: object[], media: object[], now?: Date }} input
 */
export function buildLougehrigCandidateFields({ pages = [], posts = [], media = [], now = new Date() }) {
  const out = [];
  const mediaById = new Map(media.map((m) => [Number(m.id), m]));
  const gallery = pages.find((p) => p.slug === 'photo-gallery');

  if (gallery) {
    const seen = new Set();
    for (const fig of parseGalleryFigures(gallery.content?.rendered)) {
      const record = fig.mediaId != null ? mediaById.get(fig.mediaId) : undefined;
      const fileUrl = record?.source_url || fig.fullUrl;
      if (!fileUrl || seen.has(fileUrl)) continue;
      seen.add(fileUrl);
      const heldNote = fig.thirdParty
        ? ` Credit names ${fig.agencies.map((a) => (a === 'ap' ? 'AP' : 'Getty Images')).join(' and ')}: third-party material, HELD and not hosted (Product Authority, 2026-11-19) until written consent covers it.`
        : '';
      out.push({
        kind: 'photo',
        title: fig.caption ? fig.caption.slice(0, 140) : `lougehrig.com gallery photo ${fig.mediaId ?? ''}`.trim(),
        contentType: 'photo',
        // The photo's own file address is its source address: every photo shares one gallery page, and the
        // collector drops a candidate whose normalized source address was already recorded.
        sourceUrl: fileUrl,
        originalFileUrl: fileUrl,
        fileFormat: /\.png$/i.test(fileUrl) ? 'png' : 'jpeg',
        summary: fig.caption || 'Photo from the lougehrig.com photo gallery (no caption).',
        creditLine: fig.creditLine || undefined,
        dateOrPeriod: dateOnly(record?.date),
        sourceRecordId: fig.mediaId != null ? `wp-media-${fig.mediaId}` : undefined,
        topicTags: ['lougehrig-com', 'photo-gallery', ...(fig.thirdParty ? ['third-party-credit', 'hold-do-not-host', ...fig.agencies] : [])],
        heldDoNotHost: fig.thirdParty,
        provenanceNotes: `Collected from the lougehrig.com photo gallery at ${gallery.link || `${LOUGEHRIG_ORIGIN}/index.php/photo-gallery/`} (WordPress media id ${fig.mediaId ?? 'unknown'}). Caption credit: ${fig.creditLine ?? 'none stated'}.${heldNote} The page footer says "© Lou Gehrig"; the licensing page names CMG Worldwide as exclusive agent and states no terms. Not a rights conclusion.`,
      });
    }
  }

  for (const page of pages) {
    if (!LOUGEHRIG_ABOUT_SLUGS.includes(page.slug)) continue;
    const text = htmlToText(page.content?.rendered);
    const als = alsTags({ slug: page.slug, title: htmlToText(page.title?.rendered), text });
    out.push({
      kind: 'about',
      title: htmlToText(page.title?.rendered) || `lougehrig.com ${page.slug}`,
      contentType: 'article',
      sourceUrl: page.link,
      summary: text.slice(0, 400),
      dateOrPeriod: dateOnly(page.modified || page.date),
      sourceRecordId: `wp-page-${page.id}`,
      topicTags: ['lougehrig-com', 'about-page', page.slug, ...als],
      provenanceNotes: `Collected from the lougehrig.com About page "${page.slug}" (WordPress page ${page.id}, ${text.split(' ').length} words). Text written for CMG Worldwide's Gehrig site; rights and relevance need review.${als.length ? ` ALS tag (${als[0]}): content rule of 2026-11-01 (#5044) keeps ALS as a disease out of scope; the quality gate decides.` : ''}`,
    });
  }

  for (const post of posts) {
    const title = htmlToText(post.title?.rendered);
    const text = htmlToText(post.content?.rendered);
    const freshness = newsFreshness(post.date, now);
    const als = alsTags({ title, text });
    out.push({
      kind: 'news',
      title,
      contentType: 'article',
      sourceUrl: post.link,
      summary: htmlToText(post.excerpt?.rendered).slice(0, 400) || text.slice(0, 400),
      dateOrPeriod: dateOnly(post.date),
      sourceRecordId: `wp-post-${post.id}`,
      topicTags: ['lougehrig-com', 'news', freshness === 'current' ? 'news-current' : 'news-older-than-12-months', ...als],
      provenanceNotes: `Collected from the lougehrig.com News & Stories feed (WordPress post ${post.id}), published ${dateOnly(post.date) ?? 'date unknown'}. ${freshness === 'current' ? `Within ${LOUGEHRIG_NEWS_FRESH_MONTHS} months: eligible for the fan club news section once rights are reviewed.` : `Older than ${LOUGEHRIG_NEWS_FRESH_MONTHS} months: recorded, not eligible for the fan club news section.`} Most items are republished articles from other outlets; the original outlet owns that text, so it is held for rights review.${als.length ? ` ALS tag (${als[0]}): content rule #5044; the quality gate decides.` : ''}`,
    });
  }

  return out;
}
