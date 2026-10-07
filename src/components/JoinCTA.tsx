import Link from 'next/link';
import { LOGIN_TAB_ROUTE } from '@/lib/auth-routes';

export default function JoinCTA() {
  return (
    <div className="joinBanner section-gap">
      <h2 className="section-title">Join the Lou Gehrig Fan Club</h2>
      <div className="join-banner__free-wrap">
        <span className="join-banner__free">FREE</span>
      </div>
      <div className="join-banner__container">
        <p className="join-banner__text">
          Join the Fan Club for member archives, discussions, and club-only content. Public visitors can browse Lou Gehrig history,
          vote in the Weekly Photo Matchup, and read approved FAQs before the 2027 public relaunch.
        </p>
        <div className="join-banner__actions">
          <Link className="join-banner__btn" href="/join">Join</Link>
          <Link className="join-banner__btn" href={LOGIN_TAB_ROUTE}>Login</Link>
        </div>
      </div>
    </div>
  );
}
