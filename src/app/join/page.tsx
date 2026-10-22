import AuthClient from '../auth/AuthClient';
import { buildCanonicalMetadata } from '@/lib/publicSiteMetadata';

export const metadata = buildCanonicalMetadata('/join/');

export default function JoinPage(){
  return <AuthClient defaultMode="join" />;
}
