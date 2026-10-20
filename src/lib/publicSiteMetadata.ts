import type { Metadata } from 'next';

export const SITE_URL = 'https://www.lougehrigfanclub.com';

export const DEFAULT_SITE_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Lou Gehrig Fan Club',
    template: '%s | Lou Gehrig Fan Club',
  },
  description:
    'Official Lou Gehrig Fan Club website with fan stories, historical archives, events, and member access.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'Lou Gehrig Fan Club',
    title: 'Lou Gehrig Fan Club',
    description:
      'Official Lou Gehrig Fan Club website with fan stories, historical archives, events, and member access.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lou Gehrig Fan Club',
    description:
      'Official Lou Gehrig Fan Club website with fan stories, historical archives, events, and member access.',
  },
};

export function buildPublicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
    },
    twitter: {
      title,
      description,
    },
  };
}

export const PUBLIC_SITEMAP_ROUTES = [
  '/',
  '/about/',
  '/accessibility/',
  '/ask/',
  '/contact/',
  '/events/',
  '/join/',
  '/privacy/',
  '/search/',
  '/terms/',
] as const;

/**
 * Last content change per sitemap route (#4734), from the git history of each route's source files.
 * Update the date when a page's content changes. The type requires an entry for every sitemap route.
 * Pages whose copy comes from the content API (/privacy/, /terms/) change there, not in git.
 */
export const PUBLIC_SITEMAP_LAST_MODIFIED: Record<(typeof PUBLIC_SITEMAP_ROUTES)[number], string> = {
  '/': '2026-10-09',
  '/about/': '2026-07-01',
  '/accessibility/': '2026-08-12',
  '/ask/': '2026-10-16',
  '/contact/': '2026-10-16',
  '/events/': '2026-07-01',
  '/join/': '2026-02-11',
  '/privacy/': '2026-09-04',
  '/search/': '2026-09-03',
  '/terms/': '2026-01-20',
};
