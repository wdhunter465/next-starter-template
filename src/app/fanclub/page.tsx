'use client';

import FloatingLogo from '@/components/FloatingLogo';
import AdminLink from '@/components/fanclub/AdminLink';
import ArchivesTiles from '@/components/fanclub/ArchivesTiles';
import ClubHomeArchiveSpotlight from '@/components/fanclub/ClubHomeArchiveSpotlight';
import ClubHomeDeferredModule from '@/components/fanclub/ClubHomeDeferredModule';
import ClubHomeMasthead from '@/components/fanclub/ClubHomeMasthead';
import ClubHomeMediaFeature from '@/components/fanclub/ClubHomeMediaFeature';
import ClubHomeMemberPrompt from '@/components/fanclub/ClubHomeMemberPrompt';
import ClubHomeStaticStory from '@/components/fanclub/ClubHomeStaticStory';
import ClubHomeStoryRail from '@/components/fanclub/ClubHomeStoryRail';
import ClubHomeSubmissionCta from '@/components/fanclub/ClubHomeSubmissionCta';
import { useClubHomeContent } from '@/components/fanclub/useClubHomeContent';
import {
  clubHomePageLayoutCss,
  clubHomePageStackClassName,
  clubHomeZoneClassName,
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
        <div className={clubHomeZoneClassName.masthead}>
          <ClubHomeMasthead email={email || ''} />
        </div>

        <div className={clubHomeZoneClassName.leadStory}>
          <ClubHomeStaticStory
            ariaLabel="Lead story"
            title="Lead Story"
            headline={clubHome.leadHeadline}
            summary={clubHome.leadSummary}
            credit={clubHome.leadCredit}
            sourceName={clubHome.leadSourceName}
          />
        </div>

        <div className={clubHomeZoneClassName.storyRail}>
          <ClubHomeStoryRail stories={clubHome.railStories} />
        </div>
        <div className={clubHomeZoneClassName.featureLinks}>
          <ArchivesTiles />
        </div>
        <div className={clubHomeZoneClassName.mediaFeature}>
          <ClubHomeMediaFeature media={clubHome.mediaFeature} />
        </div>
        <div className={clubHomeZoneClassName.memberPrompt}>
          <ClubHomeMemberPrompt />
        </div>
        <div className={clubHomeZoneClassName.archiveSpotlight}>
          <ClubHomeArchiveSpotlight story={clubHome.archiveSpotlight} />
        </div>
        <div className={clubHomeZoneClassName.campaign}>
          <ClubHomeDeferredModule
            ariaLabel="Campaign module"
            title="Campaign & Fundraiser"
            reason="No active campaign module is configured. Fundraiser operations remain a separate program; this slot fails closed until explicitly scoped."
          />
        </div>
        <div className={clubHomeZoneClassName.events}>
          <ClubHomeDeferredModule
            ariaLabel="Events callout"
            title="Events & Calendar"
            reason="Upcoming Lou Gehrig Fan Club events will appear here when the calendar is connected."
          />
        </div>
        <div className={clubHomeZoneClassName.recognition}>
          <ClubHomeDeferredModule
            ariaLabel="Recognition tile"
            title="Recognition & Partners"
            reason="Partner and recognition highlights will appear here when new display features are enabled."
          />
        </div>
        <div className={clubHomeZoneClassName.submissionCta}>
          <ClubHomeSubmissionCta />
        </div>
        <div className={clubHomeZoneClassName.adminLink}>
          <AdminLink isAdmin={role === 'admin'} />
        </div>
      </div>
    </main>
  );
}
