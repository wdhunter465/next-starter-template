'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Quote = { quote: string; source?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export default function Footer() {
  const [q, setQ] = useState<Quote | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuote() {
      try {
        const res = await fetch('/api/footer-quote', { cache: 'no-store' });
        const json: unknown = await res.json().catch(() => null);
        if (!isRecord(json)) return;

        const quoteObj = isRecord(json.quote) ? (json.quote as Record<string, unknown>) : null;
        if (!quoteObj) return;

        const quote = asString(quoteObj.quote);
        const source = asString(quoteObj.source) ?? asString(quoteObj.attribution);
        if (!quote) return;

        if (!cancelled) setQ({ quote, source });
      } catch {
        // ignore
      }
    }

    loadQuote();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: 48 }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '18px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: quote + legal (left aligned) */}
        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <div style={{ fontStyle: 'italic', marginBottom: 8, lineHeight: 1.35 }}>
            {q ? (
              <>
                “{q.quote}”
                {q.source ? <span style={{ fontStyle: 'normal', marginLeft: 8 }}>— {q.source}</span> : null}
              </>
            ) : (
              <span style={{ opacity: 0.7 }}> </span>
            )}
          </div>
          <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: 12 }}>
            © {new Date().getFullYear()} Lou Gehrig Fan Club
          </div>
        </div>

        {/* Center: small logo (uses available footer height) */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}>
            <img
              src="/logo.svg"
              alt="Lou Gehrig Fan Club"
              style={{ height: 44, width: 'auto', display: 'block' }}
            />
          </button>
        </div>

        {/* Right: Privacy + Terms + Accessibility; Contact on second row */}
        <nav
          aria-label="Footer links"
          style={{
            flex: '1 1 260px',
            minWidth: 220,
            display: 'grid',
            gridTemplateColumns: 'auto auto auto',
            justifyContent: 'end',
            alignItems: 'center',
            columnGap: 14,
            rowGap: 8,
            fontSize: 12,
          }}
        >
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/accessibility">Accessibility</Link>
          <Link href="/contact" style={{ gridColumn: '1 / -1', justifySelf: 'end' }}>
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
