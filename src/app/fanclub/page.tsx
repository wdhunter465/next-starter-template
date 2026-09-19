'use client';

import FloatingLogo from '@/components/FloatingLogo';
import AdminLink from '@/components/fanclub/AdminLink';
import ArchivesTiles from '@/components/fanclub/ArchivesTiles';
import ClubHomeArchiveSpotlight from '@/components/fanclub/ClubHomeArchiveSpotlight';
import ClubHomeDeferredModule from '@/components/fanclub/ClubHomeDeferredModule';
import ClubHomeEventsModule from '@/components/fanclub/ClubHomeEventsModule';
import ClubHomeMasthead from '@/components/fanclub/ClubHomeMasthead';
import ClubHomeMediaFeature from '@/components/fanclub/ClubHomeMediaFeature';
import ClubHomeMemberPrompt from '@/components/fanclub/ClubHomeMemberPrompt';
import ClubHomeRecognitionModule from '@/components/fanclub/ClubHomeRecognitionModule';
import ClubHomeStaticStory from '@/components/fanclub/ClubHomeStaticStory';
import ClubHomeStoryRail from '@/components/fanclub/ClubHomeStoryRail';
import ClubHomeSubmissionCta from '@/components/fanclub/ClubHomeSubmissionCta';
import { useClubHomeContent } from '@/components/fanclub/useClubHomeContent';
import {
  clubHomeColumnClassName,
  clubHomeColumnsClassName,
  clubHomeFooterRowClassName,
  clubHomeMastheadRowClassName,
  clubHomePageLayoutCss,
  clubHomePageStackClassName,
} from '@/components/fanclub/clubHomeStyles';
import { useMemberSession } from '@/hooks/useMemberSession';

export default function MemberHomePage() {
  const { isLoading, isAuthenticated, email, role } = useMemberSession({ redirectTo: '/' });
  const clubHome = useClubHomeContent();

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <main>
      <style dangerouslySetInnerHTML={{ __html: clubHomePageLayoutCss }} />
      <FloatingLogo />
      <div className={clubHomePageStackClassName} aria-label="FanClubHomeSections">
        <div className={clubHomeMastheadRowClassName}>
          <ClubHomeMasthead email={email || ''} />
        </div>

        <div className={clubHomeColumnsClassName}>
          <div className={clubHomeColumnClassName.center}>
            <ClubHomeStaticStory
              ariaLabel="Lead story"
              title="Lead Story"
              headline={clubHome.leadHeadline}
              summary={clubHome.leadSummary}
              credit={clubHome.leadCredit}
              sourceName={clubHome.leadSourceName}
              image={
                clubHome.mediaFeature?.thumbnail_url
                  ? { url: clubHome.mediaFeature.thumbnail_url, alt: clubHome.mediaFeature.title || clubHome.leadHeadline }
                  : null
              }
            />
            <ClubHomeMediaFeature media={clubHome.mediaFeature} />
          </div>

          <div className={clubHomeColumnClassName.left}>
            <ClubHomeEventsModule />
            <ClubHomeArchiveSpotlight story={clubHome.archiveSpotlight} />
            <ClubHomeRecognitionModule />
          </div>

          <div className={clubHomeColumnClassName.right}>
            <ClubHomeStoryRail stories={clubHome.railStories} />
            <ClubHomeMemberPrompt />
            <ClubHomeDeferredModule
              ariaLabel="Campaign module"
              title="Campaign & Fundraiser"
              reason="No active campaign module is configured. Fundraiser operations remain a separate program; this slot fails closed until explicitly scoped."
            />
          </div>
        </div>

        <div className={clubHomeFooterRowClassName}>
          <ArchivesTiles />
          <ClubHomeSubmissionCta />
          <AdminLink isAdmin={role === 'admin'} />
        </div>
      </div>
    </main>
  );
}
