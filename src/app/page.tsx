'use client';

import styles from './page.module.css';

import FloatingLogo from '@/components/FloatingLogo';
import WeeklyMatchup from '@/components/WeeklyMatchup';
import CampaignSpotlightSlot from '@/components/home/CampaignSpotlightSlot';
import FundraiserDailyDetailsTeaser from '@/components/home/FundraiserDailyDetailsTeaser';
import FAQSection from '@/components/FAQSection';
import MilestonesSection from '@/components/MilestonesSection';
import FriendsOfFanClub from '@/components/FriendsOfFanClub';
import CalendarSection from '@/components/CalendarSection';
import JoinCTA from '@/components/JoinCTA';
import RecentDiscussionsTeaser from '@/components/RecentDiscussionsTeaser';
import SocialWall from '@/components/SocialWall';

export default function HomePage() {
  return (
    <>
      <FloatingLogo />
      {/* Section: Hero Banner */}
      <header id="banner" className={styles.hero}>
        <div className={styles.container}>
          <h1 className={styles.title}>Welcome to the Lou Gehrig Fan Club</h1>
          <p className={styles.subtitle}>
            Celebrating the Iron Horse — his record-setting career, his character, and the stories that keep his legacy alive.
            Explore public history, vote in the Weekly Photo Matchup, and join the Fan Club as we prepare for our 2027 public relaunch.
          </p>
        </div>
      </header>

      <FundraiserDailyDetailsTeaser />
      <CampaignSpotlightSlot />

      {/* Section: Weekly Photo Matchup */}
      <section id="weekly" className="section-gap">
        <div className="container"><WeeklyMatchup />
        </div>
      </section>

      {/* Section: Membership CTA */}
      <section id="join-cta" className="container section-gap">
        <JoinCTA />
      </section>


      {/* Section: ABOUT LOU GEHRIG */}
      <section id="about-lou-gehrig" className="container section-gap">
        <h2 className="section-title">ABOUT LOU GEHRIG</h2>
        <div className="card" style={{ padding: 22 }}>
          <p style={{ marginTop: 0 }}>
            Henry Louis “Lou” Gehrig (1903–1941) was one of baseball&apos;s greatest players and a symbol of courage in the face of adversity.
            His legacy extends far beyond the diamond, embodying dignity, perseverance, and the ongoing fight against ALS.
          </p>

          <h3 style={{ marginTop: 18 }}>Early Life and Baseball Career</h3>
          <p>
            Born June 19, 1903, in New York City to German immigrant parents, Lou Gehrig attended Columbia University before joining Major League Baseball.
            He played his entire 17-year career with the New York Yankees (1923–1939), earning the nickname “The Iron Horse” for playing in 2,130 consecutive games.
          </p>
          <p>
            Gehrig&apos;s career achievements include a .340 batting average, 493 home runs, and 1,995 runs batted in. He was a 7-time All-Star, 2-time American League MVP,
            and 6-time World Series champion, cementing his place among baseball&apos;s all-time greats.
          </p>

          <h3 style={{ marginTop: 18 }}>ALS Diagnosis and Legacy</h3>
          <p>
            In 1939, Gehrig experienced a rapid physical decline. On May 2, 1939, he voluntarily removed himself from the Yankees lineup.
            He was soon diagnosed with amyotrophic lateral sclerosis (ALS).
          </p>
          <p>
            On July 4, 1939, during Lou Gehrig Appreciation Day at Yankee Stadium, he delivered his famous farewell address, expressing gratitude rather than resentment.
            He died on June 2, 1941, at age 37. His name became synonymous with ALS, now commonly referred to as “Lou Gehrig&apos;s Disease.”
          </p>

          <h3 style={{ marginTop: 18 }}>Lou Gehrig Day</h3>
          <p>
            Major League Baseball now recognizes June 2 as Lou Gehrig Day to honor Gehrig&apos;s life and raise awareness for ALS research and advocacy.
          </p>
        </div>
      </section>

      {/* Section: Social Wall */}
      <SocialWall />

      <RecentDiscussionsTeaser />

      {/* Section: Friends of the Fan Club */}
      <section id="friends-of-the-club" className="container section-gap-moderate">
        <FriendsOfFanClub />
      </section>

      {/* Section: Milestones */}
      <section id="milestones" className="container section-gap-tight">
        <MilestonesSection />
      </section>

      {/* Section: Calendar */}
      <section id="calendar" className="container section-gap-tight">
        <CalendarSection />
      </section>

      {/* Section: FAQ */}
      <section id="faq" className="section-gap-tight">
        <div className="container">
          <FAQSection />
        </div>
      </section>
    </>
  );
}
