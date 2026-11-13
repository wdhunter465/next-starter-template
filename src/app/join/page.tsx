import AuthClient from '../auth/AuthClient';
import { buildPublicPageMetadata } from '@/lib/publicSiteMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Join',
  description: 'Join or log in to the Lou Gehrig Fan Club.',
  path: '/join/',
});

export default function JoinPage(){
  return <AuthClient defaultMode="join" />;
}
