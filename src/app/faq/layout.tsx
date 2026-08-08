import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '@/lib/publicSiteMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'FAQ',
  description:
    'Legacy FAQ route. Approved FAQ browsing and Ask a Question are consolidated at /ask/.',
  path: '/faq/',
});

export default function FaqLayout({ children }: { children: ReactNode }) {
  return children;
}
