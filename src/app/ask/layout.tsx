import type { ReactNode } from 'react';
import { buildPublicPageMetadata } from '@/lib/publicSiteMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'FAQ & Ask a Question',
  description:
    'Browse approved FAQ answers and submit a question for moderator review on the Lou Gehrig Fan Club website.',
  path: '/ask/',
});

export default function AskLayout({ children }: { children: ReactNode }) {
  return children;
}
