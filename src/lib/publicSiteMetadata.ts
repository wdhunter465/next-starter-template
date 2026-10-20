import type { Metadata } from 'next';

export const SITE_URL = 'https://www.lougehrigfanclub.com';

export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Canonical-only metadata for pages whose title and description are set elsewhere. */
export function buildCanonicalMetadata(path: string): Metadata {
  return { alternates: { canonical: canonicalUrl(path) } };
}

export const DEFAULT_SITE_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Lou Gehrig Fan Club',
    template: '%s | Lou Gehrig Fan Club',
  },
  description:
    'Official Lou Gehrig Fan Club website with fan stories, historical archives, events, and member access.',
  alternates: { canonical: `${SITE_URL}/` },
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
  const url = canonicalUrl(path);
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
