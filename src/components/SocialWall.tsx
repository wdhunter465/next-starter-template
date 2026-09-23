'use client';

import { useEffect, useState } from 'react';
import {
  getSocialFallbackPlatforms,
  hasRenderedSocialWidget,
  SOCIAL_FALLBACK_HEADLINE,
  SOCIAL_WALL_WIDGET_ID,
} from '@/lib/socialFallbacks';
import styles from './social-wall.module.css';

const PLATFORM_SRC = 'https://elfsightcdn.com/platform.js';
const FAIL_AFTER_MS = 15000;
const POLL_MS = 500;

declare global {
  interface Window {
    elfsight?: {
      reload?: () => void;
    };
  }
}

export default function SocialWall() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const fallbackPlatforms = getSocialFallbackPlatforms();

  useEffect(() => {
    let cancelled = false;
    let pollId: ReturnType<typeof setTimeout> | null = null;
    let failId: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (pollId) clearTimeout(pollId);
      if (failId) clearTimeout(failId);
      pollId = null;
      failId = null;
    };

    const markReady = () => {
      if (cancelled) return;
      clearTimers();
      setStatus('ready');
    };

    const markError = () => {
      if (cancelled) return;
      if (hasRenderedSocialWidget()) {
        markReady();
        return;
      }
      setStatus('error');
    };

    const pollForRender = () => {
      if (cancelled) return;
      if (hasRenderedSocialWidget()) {
        markReady();
        return;
      }
      pollId = setTimeout(pollForRender, POLL_MS);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${PLATFORM_SRC}"]`,
    );

    const init = () => {
      if (cancelled) return;
      window.elfsight?.reload?.();
      pollForRender();
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = PLATFORM_SRC;
      script.async = true;
      script.onload = init;
      script.onerror = markError;
      document.body.appendChild(script);
    } else if (window.elfsight) {
      init();
    } else {
      existingScript.addEventListener('load', init, { once: true });
      existingScript.addEventListener('error', markError, { once: true });
    }

    failId = setTimeout(markError, FAIL_AFTER_MS);
    pollForRender();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, []);

  const showFallback = status === 'error' && !hasRenderedSocialWidget();

  return (
    <section id="social-wall" className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>Social Wall</h2>
        <p className={styles.subtitle}>Live fan posts from Facebook, Instagram, X, and Pinterest when available.</p>
        <div className={styles.embed}>
          {status === 'loading' ? (
            <p className={styles.fallback} aria-live="polite">
              Loading social wall content...
            </p>
          ) : null}
          {showFallback ? (
            <div className={styles.fallbackPanel} role="region" aria-labelledby="social-wall-fallback-heading">
              <p id="social-wall-fallback-heading" className={styles.fallback}>
                {SOCIAL_FALLBACK_HEADLINE}
              </p>
              <ul className={styles.fallbackList}>
                {fallbackPlatforms.map((platform) => (
                  <li key={platform.id}>
                    <a href={platform.href} target="_blank" rel="noopener noreferrer">
                      Visit Lou Gehrig Fan Club on {platform.label}
                    </a>
                    <span className={styles.fallbackNote}>{platform.reliabilityNote}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={SOCIAL_WALL_WIDGET_ID} data-elfsight-app-lazy />
        </div>
      </div>
    </section>
  );
}
