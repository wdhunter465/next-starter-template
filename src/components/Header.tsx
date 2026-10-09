'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LOGIN_TAB_ROUTE } from '@/lib/auth-routes';
import styles from './Header.module.css';
import HamburgerMenu from './HamburgerMenu';

type HeaderProps = {
  showLogo?: boolean;
};

type SessionState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | { status: 'member'; email?: string; role?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/**
 * Visitor Header (public pages).
 * Design invariants (repo docs):
 * - Not logged in: Join, Search, Store (external), Login, Hamburger
 * - Logged in: Club Home, Search, Store (external), Logout, Hamburger
 * - When logged-in (browsing public pages): add Club Home + Logout
 * - Hamburger present on all public pages
 * - Store must open new tab to Bonfire storefront URL
 */
export default function Header({ showLogo = true }: HeaderProps = {}) {
  const [session, setSession] = useState<SessionState>({ status: 'unknown' });
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/session/me', { credentials: 'include' });
        const json: unknown = await res.json().catch(() => null);

        if (!isRecord(json)) {
          if (!cancelled) setSession({ status: 'guest' });
          return;
        }

        const ok = asBoolean(json.ok) === true;
        const email = asString(json.email);
        const role = asString(json.role);

        if (ok && email) {
          if (!cancelled) setSession({ status: 'member', email, role });
        } else {
          if (!cancelled) setSession({ status: 'guest' });
        }
      } catch {
        if (!cancelled) setSession({ status: 'guest' });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isLoggedIn = session.status === 'member';

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {showLogo ? (
          <div className={styles.logoContainer}>
            <Link href="/" aria-label="Lou Gehrig Fan Club" className={styles.logoLink}>
              <img className={styles.logo} src="/IMG_1946.png" alt="LGFC Logo" />
            </Link>
          </div>
        ) : (
          <span className={styles.leftOffset} aria-hidden="true" />
        )}

        {/* CENTER: Public buttons */}
        <nav className={styles.center} aria-label="Site">
          {!isLoggedIn ? (
            <Link className={styles.btn} href="/join">Join</Link>
          ) : (
            <Link className={styles.btn} href="/fanclub">Club Home</Link>
          )}
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

          {!isLoggedIn ? (
            <Link className={styles.btn} href={LOGIN_TAB_ROUTE}>Login</Link>
          ) : (
            <>
              <Link className={styles.btn} href="/logout">Logout</Link>
            </>
          )}

          {/* Hamburger */}
          <div className={styles.right}>
            <button
              ref={toggleRef}
              className={styles.hamburger}
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="hamburger-menu"
            >
              <span className={styles.hamburgerBar} />
              <span className={styles.hamburgerBar} />
              <span className={styles.hamburgerBar} />
            </button>

            {open ? (
              <HamburgerMenu
                variant={isLoggedIn ? 'public-member' : 'public-guest'}
                menuId="hamburger-menu"
                onClose={() => setOpen(false)}
                toggleRef={toggleRef}
              />
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
