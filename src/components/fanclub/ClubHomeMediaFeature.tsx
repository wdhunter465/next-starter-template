import Link from 'next/link';
import { clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';
import type { ClubHomeMediaFeature } from '@/lib/clubHomeApi';

type ClubHomeMediaFeatureProps = {
  media?: ClubHomeMediaFeature | null;
};

export default function ClubHomeMediaFeature({ media }: ClubHomeMediaFeatureProps) {
  // Fail-closed: only render <img> when a persisted rendition URL is present.
  // Never treat a missing thumbnail as a cue to show an origin full-resolution URL.
  const hasMedia = Boolean(media?.thumbnail_url);

  return (
    <section aria-label="Photo and memorabilia feature" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Featured Photo &amp; Memorabilia</h2>
      {hasMedia ? (
        <>
          <div style={{ marginBottom: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media?.thumbnail_url || ''}
              alt={media?.title || 'Featured club photo'}
              style={{ width: '100%', maxWidth: 420, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
            />
          </div>
          {media?.title ? <p style={{ margin: '0 0 6px 0', fontWeight: 600 }}>{media.title}</p> : null}
          {media?.description ? <p style={clubHomeMutedText}>{media.description}</p> : null}
          {(media?.credit_line || media?.source_name) && (
            <p style={{ ...clubHomeMutedText, marginTop: 8, fontSize: 13 }}>
              {media.credit_line ? `Credit: ${media.credit_line}` : null}
              {media.credit_line && media.source_name ? ' · ' : null}
              {media.source_name ? `Source: ${media.source_name}` : null}
            </p>
          )}
          <div style={{ marginTop: 12 }}>
            <Link href={media?.href || '/fanclub/photo'} style={{ fontWeight: 600 }}>
              {media?.is_memorabilia ? 'Browse memorabilia' : 'Browse gallery'}
            </Link>
          </div>
        </>
      ) : (
        <>
          <p style={{ ...clubHomeMutedText, marginBottom: 12 }}>
            A rotating approved photo or memorabilia highlight will appear here soon. Browse the archives below in the
            meantime.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/fanclub/photo" style={{ fontWeight: 600 }}>
              Gallery
            </Link>
            <Link href="/fanclub/memorabilia" style={{ fontWeight: 600 }}>
              Memorabilia
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
