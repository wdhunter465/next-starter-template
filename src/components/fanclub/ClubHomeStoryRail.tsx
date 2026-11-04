import ClubHomeStaticStory from './ClubHomeStaticStory';
import { clubHomeColors, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';
import type { ClubHomeStory } from '@/lib/clubHomeApi';

const STATIC_RAIL_ITEMS = [
  {
    headline: 'Lou Gehrig in the clubhouse',
    summary:
      'More clubhouse stories from the archive will appear here as new Club Home features roll out.',
  },
  {
    headline: 'Yankee Stadium memories',
    summary: 'Supporting stories from the Gehrig library will rotate through this section.',
  },
] as const;

type ClubHomeStoryRailProps = {
  stories?: ClubHomeStory[];
};

export default function ClubHomeStoryRail({ stories }: ClubHomeStoryRailProps) {
  const dynamicStories = (stories || []).filter((story) => story.headline || story.summary);
  const items =
    dynamicStories.length > 0
      ? dynamicStories.map((story) => ({
          headline: story.headline || story.title || 'Club story',
          summary: story.summary || '',
          credit: story.credit,
          sourceName: story.source_name,
          image: story.image,
        }))
      : STATIC_RAIL_ITEMS.map((item) => ({ ...item, credit: null, sourceName: null, image: null }));

  return (
    <section aria-label="Secondary story rail" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>More Stories</h2>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, index) => (
          <div
            key={item.headline}
            style={index > 0 ? { borderTop: `1px solid ${clubHomeColors.rule}`, marginTop: 16, paddingTop: 16 } : undefined}
          >
            <ClubHomeStaticStory
              ariaLabel={`Secondary story: ${item.headline}`}
              title="Story"
              headline={item.headline}
              summary={item.summary}
              credit={item.credit}
              sourceName={item.sourceName}
              image={item.image}
              compact
              bare
            />
          </div>
        ))}
      </div>
    </section>
  );
}
