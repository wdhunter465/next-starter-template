import Link from 'next/link';
import { clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle, clubHomeStoryThumbImage } from './clubHomeStyles';
import type { ClubHomeStory } from '@/lib/clubHomeApi';

type ClubHomeArchiveSpotlightProps = {
  story?: ClubHomeStory | null;
};

export default function ClubHomeArchiveSpotlight({ story }: ClubHomeArchiveSpotlightProps) {
  const hasStory = Boolean(story?.headline || story?.summary);

  return (
    <section aria-label="Archive spotlight" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Archive Spotlight</h2>
      {hasStory ? (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            {story?.image ? (
              <img src={story.image.url} alt={story.image.alt} style={clubHomeStoryThumbImage()} />
            ) : null}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 18, lineHeight: 1.35 }}>
                {story?.headline || story?.title || 'Archive highlight'}
              </h3>
              {story?.summary ? <p style={clubHomeMutedText}>{story.summary}</p> : null}
            </div>
          </div>
          {(story?.credit || story?.source_name) && (
            <p style={{ ...clubHomeMutedText, marginTop: 8, fontSize: 13 }}>
              {story.credit ? `Credit: ${story.credit}` : null}
              {story.credit && story.source_name ? ' · ' : null}
              {story.source_name ? `Source: ${story.source_name}` : null}
            </p>
          )}
        </>
      ) : (
        <p style={{ ...clubHomeMutedText, marginBottom: 12 }}>
          Anniversary and tag-driven highlights from the Gehrig archive will appear here. Browse the library for current
          stories.
        </p>
      )}
      <Link href="/fanclub/library" style={{ fontWeight: 600 }}>
        Explore the Gehrig Library
      </Link>
    </section>
  );
}
