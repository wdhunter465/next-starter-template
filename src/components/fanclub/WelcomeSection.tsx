import Link from 'next/link';

type WelcomeSectionProps = {
  email?: string | null;
};

export default function WelcomeSection({ email }: WelcomeSectionProps) {
  const emailHint = typeof email === 'string' && email.includes('@') ? email.split('@')[0] : '';

  return (
    <section
      aria-label="Welcome section"
      style={{
        padding: 16,
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <h2 style={{ margin: '0 0 8px 0' }}>Welcome back{emailHint ? `, ${emailHint}` : ''}.</h2>
      <p style={{ margin: '0 0 10px 0', color: 'rgba(0,0,0,0.75)', lineHeight: 1.55 }}>
        This is your FanClub home. Use the sections below to browse archives, join discussions, and explore club
        milestones.
      </p>
      <Link href="/fanclub/myprofile" style={{ fontWeight: 600 }}>
        Go to My Profile
      </Link>
    </section>
  );
}
