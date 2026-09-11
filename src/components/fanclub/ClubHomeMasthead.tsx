import Link from 'next/link';
import {
  clubHomeMastheadDateline,
  clubHomeMastheadKicker,
  clubHomeMastheadNameplate,
  clubHomeMastheadRule,
  clubHomeMutedText,
} from './clubHomeStyles';

type ClubHomeMastheadProps = {
  email?: string | null;
};

export default function ClubHomeMasthead({ email }: ClubHomeMastheadProps) {
  const emailHint = typeof email === 'string' && email.includes('@') ? email.split('@')[0] : '';

  return (
    <header aria-label="Club Home masthead" style={{ paddingTop: 8 }}>
      <div style={clubHomeMastheadKicker}>
        <span>Club Home</span>
        <span>Member Edition</span>
        <span>Est. 2026</span>
      </div>
      <h1 style={clubHomeMastheadNameplate}>Lou Gehrig Fan Club</h1>
      <p style={clubHomeMastheadDateline}>&ldquo;I consider myself the luckiest man on the face of the earth.&rdquo;</p>
      <div style={clubHomeMastheadRule} />
      <p style={{ ...clubHomeMutedText, margin: '16px 0 8px 0' }}>
        Welcome back{emailHint ? `, ${emailHint}` : ''}. Your member home for Lou Gehrig stories, archives, and club activity as the Fan Club
        prepares for the 2027 public relaunch.
      </p>
      <Link href="/fanclub/myprofile" style={{ fontWeight: 600 }}>
        My Profile
      </Link>
    </header>
  );
}
