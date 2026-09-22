'use client';

import FloatingLogo from '@/components/FloatingLogo';
import AdminLink from '@/components/fanclub/AdminLink';
import ArchivesTiles from '@/components/fanclub/ArchivesTiles';
import ClubHomeAlStandings from '@/components/fanclub/ClubHomeAlStandings';
import ClubHomeArchiveSpotlight from '@/components/fanclub/ClubHomeArchiveSpotlight';
import ClubHomeDeferredModule from '@/components/fanclub/ClubHomeDeferredModule';
import ClubHomeEventsModule from '@/components/fanclub/ClubHomeEventsModule';
import ClubHomeGehrigBoxScore from '@/components/fanclub/ClubHomeGehrigBoxScore';
import ClubHomeMasthead from '@/components/fanclub/ClubHomeMasthead';
import ClubHomeMediaFeature from '@/components/fanclub/ClubHomeMediaFeature';
import ClubHomeMemberPrompt from '@/components/fanclub/ClubHomeMemberPrompt';
import ClubHomeRecognitionModule from '@/components/fanclub/ClubHomeRecognitionModule';
import ClubHomeStaticStory from '@/components/fanclub/ClubHomeStaticStory';
import ClubHomeStoryRail from '@/components/fanclub/ClubHomeStoryRail';
import ClubHomeSubmissionCta from '@/components/fanclub/ClubHomeSubmissionCta';
import { useClubHomeContent } from '@/components/fanclub/useClubHomeContent';
import { useGehrigRandomGame } from '@/components/fanclub/useGehrigRandomGame';
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
  const gehrigGame = useGehrigRandomGame();

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
              image={clubHome.lead?.image ? { url: clubHome.lead.image.url, alt: clubHome.lead.image.alt } : null}
            />
            <ClubHomeMediaFeature media={clubHome.mediaFeature} />
          </div>

          <div className={clubHomeColumnClassName.left}>
            <ClubHomeEventsModule />
            <ClubHomeArchiveSpotlight story={clubHome.archiveSpotlight} />
            <ClubHomeRecognitionModule />
            <ClubHomeGehrigBoxScore load={gehrigGame} />
          </div>

          <div className={clubHomeColumnClassName.right}>
            <ClubHomeStoryRail stories={clubHome.railStories} />
            <ClubHomeMemberPrompt />
            <ClubHomeDeferredModule
              ariaLabel="Campaign module"
              title="Campaign & Fundraiser"
              reason="No active campaign module is configured. Fundraiser operations remain a separate program; this slot fails closed until explicitly scoped."
            />
            <ClubHomeAlStandings load={gehrigGame} />
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
