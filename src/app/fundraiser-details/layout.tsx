import type { ReactNode } from 'react';
import { buildCanonicalMetadata } from '@/lib/publicSiteMetadata';

export const metadata = buildCanonicalMetadata('/fundraiser-details/');

export default function FundraiserDetailsLayout({ children }: { children: ReactNode }) {
  return children;
}
