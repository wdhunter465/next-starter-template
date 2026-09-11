import Link from 'next/link';
import { clubHomeColors, clubHomeMutedText, clubHomePhotoPlaceholder, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';
import type { ClubHomeMediaFeature } from '@/lib/clubHomeApi';

type ClubHomeMediaFeatureProps = {
  media?: ClubHomeMediaFeature | null;
};

export default function ClubHomeMediaFeature({ media }: ClubHomeMediaFeatureProps) {
  const hasMedia = Boolean(media?.thumbnail_url);

  return (
    <section aria-label="Photo and memorabilia feature" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Featured Photo &amp; Memorabilia</h2>
      {hasMedia ? (
        <>
          <div style={{ marginBottom: 12, border: `2px solid ${clubHomeColors.navy}`, padding: 4, background: '#fff' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media?.thumbnail_url || ''}
              alt={media?.title || 'Featured club photo'}
              style={{ width: '100%', display: 'block' }}
            />
          </div>
          {media?.title ? (
            <p
              style={{
                margin: '0 0 6px 0',
                fontFamily: "'Fraunces', Georgia, serif",
                fontWeight: 700,
                fontSize: 20,
                color: clubHomeColors.navy,
              }}
            >
              {media.title}
            </p>
          ) : null}
          {media?.description ? <p style={clubHomeMutedText}>{media.description}</p> : null}
          {(media?.credit_line || media?.source_name) && (
            <p style={{ ...clubHomeMutedText, marginTop: 8, fontSize: 12, fontStyle: 'italic' }}>
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
          <div style={{ ...clubHomePhotoPlaceholder(220), marginBottom: 12 }}>
            [ Photo &amp; memorabilia feature — coming soon ]
          </div>
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
