'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './AdminNav.module.css';

const items: Array<{ href: string; label: string }> = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/photos', label: 'Photo Queue' },
  { href: '/admin/audit', label: 'Audit & Reporting' },
  { href: '/admin/faq', label: 'FAQ Queue' },
  { href: '/admin/content', label: 'Page Content' },
  { href: '/admin/cms', label: 'CMS Blocks' },
  { href: '/admin/editorial', label: 'Editorial Archive' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/matchup', label: 'Matchup' },
  { href: '/admin/fundraiser-preview', label: 'Fundraiser Preview' },
  { href: '/admin/clubstaging', label: 'Club Staging' },
  { href: '/admin/join-requests', label: 'Join Requests' },
  { href: '/admin/worklist', label: 'Worklist' },
  { href: '/admin/member-operations', label: 'Member Operations' },
  { href: '/admin/media-assets', label: 'Media Assets' },
  { href: '/admin/d1-test', label: 'D1 Inspect' },
];

export default function AdminNav() {
  const pathname = usePathname() || '/admin';

  return (
    <nav className={styles.nav} aria-label="Admin navigation">
      {items.map(i => {
        const active = pathname === i.href || (i.href !== '/admin' && pathname.startsWith(i.href + '/')) || pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={[styles.link, active ? styles.active : ''].filter(Boolean).join(' ')}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
