/**
 * Shared Club Home presentation tokens and responsive page composition.
 * (#3383 / P1-01 baseline; restyled per #2461 / #4097 — approved "Heritage Navy & Cream"
 * newspaper direction.)
 */

export const clubHomeColors = {
  navy: '#0b2545',
  accent: '#8a3324',
  bg: '#f5efe0',
  ink: '#2a2620',
  muted: '#4a4238',
  rule: 'rgba(11, 37, 69, 0.35)',
} as const;

/**
 * System serif stacks, not a remote Google Fonts request — the production CSP's
 * `style-src` only allows 'self' plus the Elfsight widget domains, so a remote
 * fonts.googleapis.com @import is silently blocked (and spams CSP reports) in prod.
 */
const headlineFont = "Georgia, 'Times New Roman', Times, serif";
const bodyFont = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export const clubHomeHeadlineFontFamily = headlineFont;
export const clubHomeBodyFontFamily = bodyFont;

export const clubHomePageStack = {
  maxWidth: 1200,
  margin: '0 auto',
  padding: '24px 20px 40px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 24,
  background: clubHomeColors.bg,
  color: clubHomeColors.navy,
  fontFamily: bodyFont,
};

export const clubHomeSectionCard = {
  paddingTop: 14,
  paddingBottom: 4,
  borderTop: `3px solid ${clubHomeColors.accent}`,
  background: 'transparent',
  fontFamily: bodyFont,
};

export const clubHomeSectionTitle = {
  margin: '0 0 10px 0',
  fontSize: 13,
  fontFamily: headlineFont,
  fontWeight: 700 as const,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: clubHomeColors.navy,
  borderBottom: `2px solid ${clubHomeColors.accent}`,
  paddingBottom: 6,
};

export const clubHomeMutedText = {
  margin: 0,
  color: clubHomeColors.muted,
  lineHeight: 1.55,
  fontFamily: bodyFont,
  fontSize: 14,
};

/**
 * Real-photo framing for a large, center-column posting space (lead story,
 * featured photo). Matches the placeholder's navy-rule frame so a real image
 * drops into the same visual slot once one is available (#4180).
 */
export const clubHomeStoryHeroImage = {
  width: '100%',
  // Fixed (not max) height, matching clubHomePhotoPlaceholder(300)'s height exactly, with
  // objectFit: 'cover' to crop rather than letterbox -- any aspect ratio still renders at
  // this exact height, so swapping placeholder -> real image never shifts layout.
  height: 300,
  objectFit: 'cover' as const,
  display: 'block',
  border: `2px solid ${clubHomeColors.navy}`,
  boxSizing: 'border-box' as const,
};

/**
 * Small square thumbnail framing for a margin posting space (story rail,
 * archive spotlight) — deliberately smaller than the hero frame so picture
 * size communicates editorial prominence by placement (#4180).
 */
export const clubHomeStoryThumbImage = (size = 72) => ({
  width: size,
  height: size,
  objectFit: 'cover' as const,
  display: 'block',
  flexShrink: 0,
  border: `2px solid ${clubHomeColors.navy}`,
  boxSizing: 'border-box' as const,
});

/** Vintage halftone placeholder for a photo slot with no real image yet. */
export const clubHomePhotoPlaceholder = (height: number) => ({
  width: '100%',
  height,
  background: 'repeating-linear-gradient(45deg, #ded0b8, #ded0b8 10px, #d3c3a5 10px, #d3c3a5 20px)',
  border: `2px solid ${clubHomeColors.navy}`,
  boxSizing: 'border-box' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
  fontSize: 11,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  color: clubHomeColors.navy,
  padding: 8,
});

export const clubHomeMastheadKicker = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: clubHomeColors.accent,
  fontWeight: 700 as const,
  fontFamily: bodyFont,
  borderBottom: `2px solid ${clubHomeColors.navy}`,
  paddingBottom: 8,
};

export const clubHomeMastheadNameplate = {
  fontFamily: headlineFont,
  fontWeight: 900 as const,
  fontSize: 52,
  lineHeight: 1.05,
  letterSpacing: '-0.01em',
  margin: '16px 0 6px 0',
  color: clubHomeColors.navy,
  textAlign: 'center' as const,
};

export const clubHomeMastheadDateline = {
  fontFamily: headlineFont,
  fontStyle: 'italic' as const,
  fontWeight: 600 as const,
  fontSize: 15,
  margin: '0 0 14px 0',
  color: clubHomeColors.accent,
  textAlign: 'center' as const,
};

export const clubHomeMastheadRule = {
  height: 4,
  background: clubHomeColors.accent,
};

/** Class names for the newspaper composition (paired with clubHomePageLayoutCss). */
export const clubHomePageStackClassName = 'club-home-page-stack';
export const clubHomeMastheadRowClassName = 'club-home-masthead-row';
export const clubHomeColumnsClassName = 'club-home-columns';
export const clubHomeColumnClassName = {
  left: 'club-home-col club-home-col--left',
  center: 'club-home-col club-home-col--center',
  right: 'club-home-col club-home-col--right',
} as const;
export const clubHomeFooterRowClassName = 'club-home-footer-row';

/**
 * Responsive newspaper composition CSS for Club Home (#2461 / #4097 — Heritage Navy & Cream).
 * Breakpoints match Header.module.css (mobile <768, tablet 768–919, desktop ≥920).
 *
 * `.club-home-columns` places exactly three direct children — left rail, center, right rail —
 * into a single grid row. Each column is its own independent block of stacked zones, so one
 * column's content height can never force empty space into a shorter neighboring column: the
 * dead-space defect from the prior shared-row-track `grid-template-areas` layout (found during
 * #3382 end-to-end verification) cannot recur by construction, because there is only one row.
 * `order` reflows only those three wrapper elements for desktop left/center/right placement;
 * DOM order keeps the lead story first so mobile readers reach it before rail content, per the
 * "above-the-fold dominant lead story" requirement in #2461.
 */
export const clubHomePageLayoutCss = `
.club-home-page-stack {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  background: #f5efe0;
  color: #0b2545;
  font-family: ${bodyFont};
}

.club-home-page-stack a {
  color: #8a3324;
  text-decoration: none;
}

.club-home-page-stack a:hover {
  text-decoration: underline;
}

.club-home-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 28px;
}

.club-home-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.club-home-footer-row {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(11, 37, 69, 0.35);
}

@media (min-width: 768px) {
  .club-home-columns {
    grid-template-columns: 220px minmax(0, 1fr) 220px;
    column-gap: 32px;
    align-items: start;
  }

  .club-home-col--left { order: 1; }
  .club-home-col--center { order: 2; }
  .club-home-col--right { order: 3; }
}

@media (min-width: 920px) {
  .club-home-columns {
    grid-template-columns: 240px minmax(0, 1fr) 240px;
    column-gap: 40px;
  }
}
`;
