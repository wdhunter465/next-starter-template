'use client';

import Link from 'next/link';
import { useRef, RefObject } from 'react';
import { useClickAway } from '@/hooks/useClickAway';
import styles from './HamburgerMenu.module.css';
import { LOGIN_TAB_ROUTE, STORE_URL } from '@/lib/auth-routes';

export type HamburgerMenuVariant = 'public-guest' | 'public-member' | 'fanclub';

type MenuItem =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'external'; label: string; href: string };

export const HAMBURGER_MENU_ITEMS: Record<HamburgerMenuVariant, MenuItem[]> = {
  'public-guest': [
    { kind: 'link', label: 'Join', href: '/join' },
    { kind: 'link', label: 'Search', href: '/search' },
    { kind: 'external', label: 'Store', href: STORE_URL },
    { kind: 'link', label: 'Login', href: LOGIN_TAB_ROUTE },
    { kind: 'link', label: 'About', href: '/about' },
    { kind: 'link', label: 'Contact', href: '/contact' },
  ],
  'public-member': [
    { kind: 'link', label: 'Club Home', href: '/fanclub' },
    { kind: 'link', label: 'Search', href: '/search' },
    { kind: 'external', label: 'Store', href: STORE_URL },
    { kind: 'link', label: 'Logout', href: '/logout' },
    { kind: 'link', label: 'About', href: '/about' },
    { kind: 'link', label: 'Contact', href: '/contact' },
  ],
  fanclub: [
    { kind: 'link', label: 'Club Home', href: '/fanclub' },
    { kind: 'link', label: 'My Profile', href: '/fanclub/myprofile' },
    { kind: 'link', label: 'Photo', href: '/fanclub/photo' },
    { kind: 'link', label: 'Library', href: '/fanclub/library' },
    { kind: 'link', label: 'Memorabilia', href: '/fanclub/memorabilia' },
    { kind: 'link', label: 'Chat', href: '/fanclub/chat' },
    { kind: 'link', label: 'Submit', href: '/fanclub/submit' },
    { kind: 'link', label: 'Search', href: '/search' },
    { kind: 'external', label: 'Store', href: STORE_URL },
    { kind: 'link', label: 'Logout', href: '/logout' },
    { kind: 'link', label: 'About', href: '/about' },
    { kind: 'link', label: 'Contact', href: '/contact' },
  ],
};

type HamburgerMenuProps = {
  variant: HamburgerMenuVariant;
  menuId: string;
  onClose: () => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
};

export default function HamburgerMenu({
  variant,
  menuId,
  onClose,
  toggleRef,
}: HamburgerMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const items = HAMBURGER_MENU_ITEMS[variant];

  useClickAway(menuRef, toggleRef, () => onClose(), true);

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" />
      <div id={menuId} ref={menuRef} className={styles.menu} role="dialog" aria-label="Menu">
        <nav aria-label="Primary">
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={`${item.label}-${item.href}`} className={styles.item}>
                {item.kind === 'external' ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    onClick={onClose}
                    className={styles.link}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link href={item.href} onClick={onClose} className={styles.link}>
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
