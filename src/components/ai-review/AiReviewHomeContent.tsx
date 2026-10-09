'use client';

import styles from '@/app/page.module.css';
import CampaignSpotlightSlot from '@/components/home/CampaignSpotlightSlot';
import FAQSection from '@/components/FAQSection';
import MilestonesSection from '@/components/MilestonesSection';
import FriendsOfFanClub from '@/components/FriendsOfFanClub';
import CalendarSection from '@/components/CalendarSection';
import JoinCTA from '@/components/JoinCTA';
import RecentDiscussionsTeaser from '@/components/RecentDiscussionsTeaser';
import SocialWall from '@/components/SocialWall';
import AiReviewBanner from '@/components/ai-review/AiReviewBanner';
import AiReviewWeeklyMatchupPreview from '@/components/ai-review/AiReviewWeeklyMatchupPreview';

export default function AiReviewHomeContent() {
  return (
    <>
      <AiReviewBanner label="/" />
      <header id="banner" className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Welcome to the Lou Gehrig Fan Club</h1>
          <p className={styles.subtitle}>
            Celebrating the Iron Horse — his record-setting career, his character, and the stories that keep his legacy alive.
          </p>
        </div>
      </header>

      <CampaignSpotlightSlot />
      <section id="weekly" className="section-gap" inert aria-label="Weekly photo matchup (read-only)">
        <div className="container">
          <AiReviewWeeklyMatchupPreview />
        </div>
      </section>
      <section id="join-cta" className="container section-gap" inert aria-label="Membership CTA (read-only)">
        <JoinCTA />
      </section>
      <section id="about-lou-gehrig" className="container section-gap">
        <h2 className="section-title">ABOUT LOU GEHRIG</h2>
        <div className="card" style={{ padding: 22 }}>
          <p style={{ marginTop: 0 }}>
            Henry Louis “Lou” Gehrig (1903–1941) was one of baseball&apos;s greatest players and a symbol of courage in the face of adversity.
          </p>
        </div>
      </section>
      <SocialWall />
      <RecentDiscussionsTeaser />
      <section id="friends-of-the-club" className="container section-gap-moderate">
        <FriendsOfFanClub />
      </section>
      <section id="milestones" className="container section-gap-tight">
        <MilestonesSection />
      </section>
      <section id="calendar" className="container section-gap-tight">
        <CalendarSection />
      </section>
      <section id="faq" className="section-gap-tight">
        <div className="container">
          <FAQSection />
        </div>
      </section>
    </>
  );
}
