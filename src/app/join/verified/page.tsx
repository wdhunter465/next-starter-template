import type { Metadata } from 'next';
import VerifiedClient from './VerifiedClient';

export const metadata: Metadata = {
  title: 'Email verification | Lou Gehrig Fan Club',
  robots: { index: false, follow: false },
};

export default function VerifiedPage() {
  return <VerifiedClient />;
}
