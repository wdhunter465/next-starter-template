'use client';

import Link from 'next/link';
import GehrigTimelineFull from '@/components/fanclub/GehrigTimelineFull';
import { clubHomeColors, clubHomeHeadlineFontFamily, clubHomeMutedText } from '@/components/fanclub/clubHomeStyles';
import { useMemberSession } from '@/hooks/useMemberSession';

export default function FanclubTimelinePage() {
  const { isLoading, isAuthenticated } = useMemberSession({ redirectTo: '/' });

  if (isLoading || !isAuthenticated) return null;

  return (
    <main style={{ boxSizing: 'border-box', width: '100%', maxWidth: 860, margin: '0 auto', padding: '32px 16px 48px' }}>
      <p style={{ margin: '0 0 16px' }}>
        <Link href="/fanclub" style={{ fontWeight: 600 }}>
          &larr; Back to Club Home
        </Link>
      </p>
      <h1 style={{ fontFamily: clubHomeHeadlineFontFamily, color: clubHomeColors.navy, margin: '0 0 8px', fontSize: 36 }}>
        Gehrig Timeline
      </h1>
      <p style={{ ...clubHomeMutedText, margin: '0 0 24px' }}>
        Lou Gehrig&rsquo;s life and career in order, with sources.
      </p>
      <GehrigTimelineFull />
    </main>
  );
}
