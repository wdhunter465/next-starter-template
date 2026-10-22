import type { MetadataRoute } from 'next';

import { PUBLIC_SITEMAP_LAST_MODIFIED, PUBLIC_SITEMAP_ROUTES, SITE_URL } from '@/lib/publicSiteMetadata';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SITEMAP_ROUTES.map((route) => ({
    url: `${SITE_URL}${route === '/' ? '/' : route}`,
    lastModified: new Date(PUBLIC_SITEMAP_LAST_MODIFIED[route]),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.7,
  }));
}
