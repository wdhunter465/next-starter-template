'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import GoogleAnalytics from '@/components/GoogleAnalytics';

const STORAGE_KEY = 'lgfc_analytics_consent';

/** Admin work is not visitor traffic (#4745): no banner and no analytics on /admin and below. */
function isAnalyticsExcludedPath(pathname: string | null): boolean {
  return pathname === '/admin' || Boolean(pathname?.startsWith('/admin/'));
}

type ConsentState = 'unknown' | 'granted' | 'denied';

function readStoredConsent(): ConsentState {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'granted' || v === 'denied') return v;
  } catch {
    // localStorage unavailable (privacy mode / blocked)
  }
  return 'unknown';
}

function writeStoredConsent(value: 'granted' | 'denied') {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore write failures; in-memory state still applies for this session
  }
}

/**
 * Product Decision item 2 / #2920 path (b):
 * Do not initialize GA until the visitor Accepts. Decline leaves GA off.
 * Preference persists in localStorage so the banner does not re-prompt.
 */
export default function AnalyticsConsent() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>('unknown');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent());
    setReady(true);
  }, []);

  const accept = useCallback(() => {
    writeStoredConsent('granted');
    setConsent('granted');
  }, []);

  const decline = useCallback(() => {
    writeStoredConsent('denied');
    setConsent('denied');
  }, []);

  if (isAnalyticsExcludedPath(pathname)) return null;

  const showBanner = ready && consent === 'unknown';

  return (
    <>
      {consent === 'granted' ? <GoogleAnalytics /> : null}

      {showBanner ? (
        <div
          role="dialog"
          aria-label="Analytics preference"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'var(--lgfc-bg-card)',
            borderTop: '1px solid rgba(0,0,0,0.12)',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              maxWidth: 900,
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              justifyContent: 'space-between',
            }}
          >
            <p style={{ margin: 0, flex: '1 1 280px', fontSize: 14, lineHeight: 1.5, color: 'var(--lgfc-text-main)' }}>
              This site uses Google Analytics to understand aggregate page usage. Analytics is off until you
              choose Accept.{' '}
              <Link href="/privacy" style={{ color: 'var(--lgfc-blue, #0033cc)', textDecoration: 'underline' }}>
                Privacy
              </Link>
            </p>
            <div style={{ display: 'flex', gap: 10, flex: '0 0 auto' }}>
              <button
                type="button"
                onClick={decline}
                style={{
                  background: 'var(--lgfc-bg-card)',
                  color: 'var(--lgfc-blue, #0033cc)',
                  border: '1px solid rgba(0, 51, 204, 0.3)',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Decline
              </button>
              <button
                type="button"
                onClick={accept}
                style={{
                  background: 'var(--lgfc-blue, #0033cc)',
                  color: 'var(--lgfc-bg-card)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
