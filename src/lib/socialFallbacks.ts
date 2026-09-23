export type SocialFallbackPlatform = {
  id: 'facebook' | 'instagram' | 'x' | 'pinterest';
  label: string;
  href: string;
  reliabilityNote: string;
};

export const SOCIAL_WALL_WIDGET_ID = 'elfsight-app-805f3c5c-67cd-4edf-bde6-2d5978e386a8';

const SOCIAL_FALLBACK_PLATFORMS: readonly SocialFallbackPlatform[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/',
    reliabilityNote: 'Elfsight may omit Facebook posts when the widget feed is unavailable; use the official Facebook presence directly.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/',
    reliabilityNote: 'Instagram embeds depend on third-party widget availability and CSP allowances.',
  },
  {
    id: 'x',
    label: 'X (Twitter)',
    href: 'https://x.com/',
    reliabilityNote: 'X/Twitter cards in the widget may fail independently of the rest of the social wall.',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    href: 'https://www.pinterest.com/',
    reliabilityNote: 'Pinterest is optional in the Elfsight feed; the homepage must not break when it is omitted.',
  },
];

export const SOCIAL_FALLBACK_HEADLINE =
  'Follow the Lou Gehrig Fan Club on the platforms below while the embedded social wall loads or when the widget is unavailable.';

export function getSocialFallbackPlatforms(): SocialFallbackPlatform[] {
  return SOCIAL_FALLBACK_PLATFORMS.map((platform) => ({ ...platform }));
}

function elementLooksRendered(node: Element): boolean {
  if (node.tagName === 'IFRAME' || node.tagName === 'IMG' || node.tagName === 'A') return true;
  if (node.childElementCount > 0) return true;
  const shadow = (node as HTMLElement).shadowRoot;
  if (shadow) {
    if (shadow.childElementCount > 0) return true;
    for (const child of Array.from(shadow.children)) {
      if (elementLooksRendered(child)) return true;
    }
  }
  for (const child of Array.from(node.children)) {
    if (elementLooksRendered(child)) return true;
  }
  return false;
}

export function hasRenderedSocialWidget(root: ParentNode = document): boolean {
  const widget = root.querySelector(`.${SOCIAL_WALL_WIDGET_ID}`);
  if (!widget) return false;
  return elementLooksRendered(widget);
}
