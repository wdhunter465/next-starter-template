/** Shared Club Home presentation tokens and responsive page composition (#3383 / P1-01). */

export const clubHomePageStack = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '0 20px 40px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 20,
};

export const clubHomeSectionCard = {
  padding: 16,
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 12,
  background: '#fff',
};

export const clubHomeSectionTitle = {
  margin: '0 0 8px 0',
  fontSize: 22,
  color: 'var(--lgfc-blue, #003366)',
};

export const clubHomeMutedText = {
  margin: 0,
  color: 'rgba(0,0,0,0.75)',
  lineHeight: 1.55,
};

/** Class names for zone grid placement (paired with clubHomePageLayoutCss). */
export const clubHomePageStackClassName = 'club-home-page-stack';

export const clubHomeZoneClassName = {
  masthead: 'club-home-zone club-home-zone--masthead',
  leadStory: 'club-home-zone club-home-zone--lead-story',
  storyRail: 'club-home-zone club-home-zone--story-rail',
  featureLinks: 'club-home-zone club-home-zone--feature-links',
  mediaFeature: 'club-home-zone club-home-zone--media-feature',
  memberPrompt: 'club-home-zone club-home-zone--member-prompt',
  archiveSpotlight: 'club-home-zone club-home-zone--archive-spotlight',
  campaign: 'club-home-zone club-home-zone--campaign',
  events: 'club-home-zone club-home-zone--events',
  recognition: 'club-home-zone club-home-zone--recognition',
  submissionCta: 'club-home-zone club-home-zone--submission-cta',
  adminLink: 'club-home-zone club-home-zone--admin-link',
} as const;

/**
 * Responsive composition CSS for Club Home.
 * Breakpoints match Header.module.css (mobile <768, tablet 768–919, desktop ≥920).
 * Uses named grid areas — not flex/grid `order` — so DOM/reading order stays zone-table order
 * while tablet/desktop visually place side-rail zones beside the primary column.
 * Kept as a string so media queries stay inside the P1-01 allowlisted `clubHomeStyles.ts`.
 */
export const clubHomePageLayoutCss = `
.club-home-page-stack {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.club-home-zone {
  min-width: 0;
}

/* Tablet + desktop: two-column composition (fanclub-home.md) */
@media (min-width: 768px) {
  .club-home-page-stack {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    grid-template-areas:
      "masthead rail"
      "lead rail"
      "lead media"
      "lead member"
      "links links"
      "archive archive"
      "campaign campaign"
      "events events"
      "recognition recognition"
      "cta cta"
      "admin admin";
    align-items: start;
  }

  .club-home-zone--masthead { grid-area: masthead; }
  .club-home-zone--lead-story { grid-area: lead; }
  .club-home-zone--story-rail { grid-area: rail; }
  .club-home-zone--feature-links { grid-area: links; }
  .club-home-zone--media-feature { grid-area: media; }
  .club-home-zone--member-prompt { grid-area: member; }
  .club-home-zone--archive-spotlight { grid-area: archive; }
  .club-home-zone--campaign { grid-area: campaign; }
  .club-home-zone--events { grid-area: events; }
  .club-home-zone--recognition { grid-area: recognition; }
  .club-home-zone--submission-cta { grid-area: cta; }
  .club-home-zone--admin-link { grid-area: admin; }
}

/* Desktop: same composition; stack already caps at 1100px for breathing room */
@media (min-width: 920px) {
  .club-home-page-stack {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.95fr);
  }
}
`;
