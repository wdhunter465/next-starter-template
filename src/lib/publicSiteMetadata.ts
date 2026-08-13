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
  '/faq/',
  '/join/',
  '/login/',
  '/privacy/',
  '/search/',
  '/terms/',
] as const;
