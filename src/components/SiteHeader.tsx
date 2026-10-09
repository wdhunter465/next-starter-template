'use client';

import { usePathname } from 'next/navigation';
import FloatingLogo from './FloatingLogo';
import Header from './Header';
import FanClubHeader from './FanClubHeader';

/**
 * Route-based header selection plus the one floating logo.
 * - /fanclub and /fanclub/** => FanClubHeader
 * - everything else => Header
 *
 * Classic/locked behavior:
 * - Sticky header always present.
 * - The large floating logo is mounted here, once, so it looks and behaves the same under every
 *   header on every route (#4489). It is a separate overlay that hides after a small scroll.
 * - Because the floating logo is always present, both headers hide their small logo and reserve
 *   its footprint instead.
 */
export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const isFanClub = pathname === '/fanclub' || pathname.startsWith('/fanclub/');

  return (
    <>
      <FloatingLogo />
      {isFanClub ? <FanClubHeader showLogo={false} /> : <Header showLogo={false} />}
    </>
  );
}
