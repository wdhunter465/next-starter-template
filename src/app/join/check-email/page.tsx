import type { Metadata } from 'next';
import CheckEmailClient from './CheckEmailClient';

export const metadata: Metadata = {
  title: 'Check your email | Lou Gehrig Fan Club',
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return <CheckEmailClient />;
}
