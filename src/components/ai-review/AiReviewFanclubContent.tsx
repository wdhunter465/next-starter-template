'use client';

import AdminLink from '@/components/fanclub/AdminLink';
import ArchivesTiles from '@/components/fanclub/ArchivesTiles';
import ClubHomeArchiveSpotlight from '@/components/fanclub/ClubHomeArchiveSpotlight';
import ClubHomeDeferredModule from '@/components/fanclub/ClubHomeDeferredModule';
import ClubHomeMasthead from '@/components/fanclub/ClubHomeMasthead';
import ClubHomeMediaFeature from '@/components/fanclub/ClubHomeMediaFeature';
import ClubHomeStaticStory from '@/components/fanclub/ClubHomeStaticStory';
import ClubHomeStoryRail from '@/components/fanclub/ClubHomeStoryRail';
import ClubHomeSubmissionCta from '@/components/fanclub/ClubHomeSubmissionCta';
import GehrigTimeline from '@/components/fanclub/GehrigTimeline';
import { clubHomePageStack } from '@/components/fanclub/clubHomeStyles';
import AiReviewBanner from '@/components/ai-review/AiReviewBanner';
import AiReviewDiscussionPreview from '@/components/ai-review/AiReviewDiscussionPreview';
import AiReviewPostCreationPreview from '@/components/ai-review/AiReviewPostCreationPreview';
import type { AiReviewSnapshot } from '@/components/ai-review/AiReviewGate';
import type { ClubHomeStory } from '@/lib/clubHomeApi';

const LEAD_FALLBACK = {
  headline: 'Lou Gehrig: The Iron Horse',
  summary:
    'Club historians are curating the lead story for this section. Check back soon for featured Lou Gehrig coverage from the archive.',
};

type Props = {
  snapshot: AiReviewSnapshot;
};

export default function AiReviewFanclubContent({ snapshot }: Props) {
  const clubHome = snapshot.clubHome;
  const lead = clubHome?.ok ? clubHome.lead_story ?? null : null;

  return (
    <main>
      <AiReviewBanner label="/fanclub" />
      <div style={clubHomePageStack} aria-label="FanClubHomeSections">
        <ClubHomeMasthead email="ai-review@readonly" />

        <ClubHomeStaticStory
          ariaLabel="Lead story"
          title="Lead Story"
          headline={lead?.headline || lead?.title || LEAD_FALLBACK.headline}
          summary={lead?.summary || LEAD_FALLBACK.summary}
          credit={lead?.credit ?? null}
          sourceName={lead?.source_name ?? null}
        />

        <ClubHomeStoryRail
          stories={(clubHome?.ok ? clubHome.rail_stories || [] : []) as ClubHomeStory[]}
        />
        <ArchivesTiles />
        <ClubHomeMediaFeature media={clubHome?.ok ? clubHome.media_feature || null : null} />
        <AiReviewPostCreationPreview />
        <AiReviewDiscussionPreview discussions={snapshot.discussions} />
        <ClubHomeArchiveSpotlight
          story={(clubHome?.ok ? clubHome.archive_spotlight || null : null) as ClubHomeStory | null}
        />
        <ClubHomeDeferredModule
          ariaLabel="Campaign module"
          title="Campaign & Fundraiser"
          reason="No active campaign module is configured. Fundraiser operations remain a separate program; this slot fails closed until explicitly scoped."
        />
        <ClubHomeDeferredModule
          ariaLabel="Events callout"
          title="Events & Calendar"
          reason="Upcoming Lou Gehrig Fan Club events will appear here when the calendar is connected."
        />
        <ClubHomeDeferredModule
          ariaLabel="Recognition tile"
          title="Recognition & Partners"
          reason="Partner and recognition highlights will appear here when new display features are enabled."
        />
        <ClubHomeSubmissionCta />
        <GehrigTimeline />
        <AdminLink isAdmin={false} />
      </div>
    </main>
  );
}
