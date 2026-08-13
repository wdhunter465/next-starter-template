'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const ASK_ROUTE = '/ask/';

function FaqLegacyRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    window.location.replace(query ? `${ASK_ROUTE}?${query}` : ASK_ROUTE);
  }, [searchParams]);

  const query = searchParams.toString();
  const target = query ? `${ASK_ROUTE}?${query}` : ASK_ROUTE;

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <p>
        Redirecting… <a href={target}>Continue to FAQ &amp; Ask</a>
      </p>
    </main>
  );
}

/** Legacy compatibility: Product Authority consolidated Ask/FAQ under `/ask` (#3074 / #3148). */
export default function FaqLegacyRedirectPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
          <p>
            Redirecting… <a href={ASK_ROUTE}>Continue to FAQ &amp; Ask</a>
          </p>
        </main>
      }
    >
      <FaqLegacyRedirect />
    </Suspense>
  );
}
