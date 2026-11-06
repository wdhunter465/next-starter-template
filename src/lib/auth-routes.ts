export const JOIN_ROUTE = '/join';
export const LOGIN_LEGACY_ROUTE = '/login';
export const AUTH_LEGACY_ROUTE = '/auth';
export const POST_LOGIN_ROUTE = '/fanclub';
// #5112: joining sends the new member here to check their email; the emailed link opens the verified page.
export const CHECK_EMAIL_ROUTE = '/join/check-email/';
export const VERIFIED_ROUTE = '/join/verified/';
export const VERIFIED_PAGE_DELAY_MS = 3000;
export const PENDING_EMAIL_STORAGE_KEY = 'lgfc_pending_verification_email';
export const POST_LOGOUT_ROUTE = '/';
export const LOGIN_TAB_ROUTE = '/join?mode=login';
export const STORE_URL = 'https://www.bonfire.com/store/lou-gehrig-fan-club/';

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
