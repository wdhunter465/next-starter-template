'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './FanClubHeader.module.css';
import HamburgerMenu from './HamburgerMenu';
import SignedInAs from './SignedInAs';

type FanClubHeaderProps = {
  showLogo?: boolean;
};

export default function FanClubHeader({ showLogo = true }: FanClubHeaderProps = {}) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  // #5122: which account is signed in. Nothing is shown if the check fails.
  const [accountEmail, setAccountEmail] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (typeof fetch !== 'function') return;
        const res = await fetch('/api/session/me', { credentials: 'include', cache: 'no-store' });
        const json: unknown = await res.json().catch(() => null);
        const record = typeof json === 'object' && json !== null ? (json as { ok?: unknown; email?: unknown }) : null;
        if (!cancelled && record?.ok === true && typeof record.email === 'string') setAccountEmail(record.email);
      } catch {
        // No account line if the check cannot be made.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const leftClassName = showLogo ? styles.left : `${styles.left} ${styles.leftOffset}`;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* LEFT: Logo (small header logo; hidden when FloatingLogo is active) */}
        <div className={leftClassName}>
          {showLogo ? (
            <Link href="/" aria-label="Lou Gehrig Fan Club" className={styles.logoLink}>
              <img className={styles.logoImg} src="/IMG_1946.png" alt="LGFC" />
            </Link>
          ) : (
            <span className={styles.leftPlaceholder} aria-hidden="true" />
          )}
        </div>

        {/* CENTER: Member buttons + Hamburger grouped together */}
        <nav className={styles.center} aria-label="Member">
          <Link className={styles.btn} href="/fanclub">Club Home</Link>
          <Link className={styles.btn} href="/fanclub/myprofile">My Profile</Link>
          <Link className={styles.btn} href="/search">Search</Link>
          <a
            className={styles.btn}
            href="https://www.bonfire.com/store/lou-gehrig-fan-club/"
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Store
          </a>
          <Link className={styles.btn} href="/logout">Logout</Link>

          {/* Hamburger (grouped with buttons) */}
          <div className={styles.right}>
            <button
              ref={toggleRef}
              className={styles.hamburger}
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="member-hamburger-menu"
            >
              <span className={styles.hamburgerBar} />
              <span className={styles.hamburgerBar} />
              <span className={styles.hamburgerBar} />
            </button>

            {open ? (
              <HamburgerMenu
                variant="fanclub"
                menuId="member-hamburger-menu"
                onClose={() => setOpen(false)}
                toggleRef={toggleRef}
              />
            ) : null}
          </div>
        </nav>
      </div>
      <SignedInAs email={accountEmail} />
    </header>
  );
}
