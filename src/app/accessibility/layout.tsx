import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '@/lib/publicSiteMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Accessibility',
  description:
    'Accessibility approach for the Lou Gehrig Fan Club website, including how to report barriers.',
  path: '/accessibility',
});

export default function AccessibilityLayout({ children }: { children: ReactNode }) {
  return children;
}
