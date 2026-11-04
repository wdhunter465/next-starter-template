// #5066, #5070, #5072: where each Club Home section sits, and that the box score and AL standings
// share a grid row so they start level with each other under the two side columns.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { clubHomePageLayoutCss } from '@/components/fanclub/clubHomeStyles';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/fanclub/page.tsx'), 'utf8');

type Column = 'center' | 'left' | 'right' | 'leftFoot' | 'rightFoot';
const ORDER: Column[] = ['center', 'left', 'right', 'leftFoot', 'rightFoot'];

function marker(name: Column): string {
  return `clubHomeColumnClassName.${name}}`;
}

/** The JSX source of one column wrapper, up to the next column wrapper (or the footer row). */
function columnBlock(name: Column): string {
  const start = source.indexOf(marker(name));
  expect(start).toBeGreaterThan(-1);
  const next = ORDER.map((other) => source.indexOf(marker(other)))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  const end = next ?? source.indexOf('clubHomeFooterRowClassName}');
  return source.slice(start, end);
}

describe('Club Home column placement (#5072)', () => {
  it('keeps the lead story, media feature and Gehrig timeline in the center, in that order', () => {
    const center = columnBlock('center');
    expect(center.indexOf('<ClubHomeStaticStory')).toBeLessThan(center.indexOf('<ClubHomeMediaFeature'));
    expect(center.indexOf('<ClubHomeMediaFeature')).toBeLessThan(center.indexOf('<GehrigTimeline />'));
  });

  it('puts Archive spotlight, More Stories, Join the Conversation and Campaign in the left column, in order', () => {
    const left = columnBlock('left');
    const order = ['<ClubHomeArchiveSpotlight', '<ClubHomeStoryRail', '<ClubHomeMemberPrompt', '<ClubHomeDeferredModule'].map((tag) =>
      left.indexOf(tag),
    );
    for (const index of order) expect(index).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('puts Events & Calendar first, then Recognition & Partners, in the right column', () => {
    const right = columnBlock('right');
    expect(right.indexOf('<ClubHomeEventsModule />')).toBeGreaterThan(-1);
    expect(right.indexOf('<ClubHomeEventsModule />')).toBeLessThan(right.indexOf('<ClubHomeRecognitionModule />'));
  });

  it('keeps the timeline, events and recognition out of the wrong columns', () => {
    expect(columnBlock('left')).not.toContain('<ClubHomeEventsModule');
    expect(columnBlock('left')).not.toContain('<ClubHomeRecognitionModule');
    expect(columnBlock('right')).not.toContain('<ClubHomeStoryRail');
    expect(columnBlock('right')).not.toContain('<GehrigTimeline');
    expect(columnBlock('left')).not.toContain('<GehrigTimeline');
  });

  it('puts the box score and AL standings in the two foot cells', () => {
    expect(columnBlock('leftFoot')).toContain('<ClubHomeGehrigBoxScore');
    expect(columnBlock('rightFoot')).toContain('<ClubHomeAlStandings');
  });
});

describe('Club Home grid rows (#5072)', () => {
  it('places both foot cells in the same second row, under the left and right columns', () => {
    expect(clubHomePageLayoutCss).toMatch(/\.club-home-col--left-foot\s*\{\s*grid-column:\s*1;\s*grid-row:\s*2;\s*\}/);
    expect(clubHomePageLayoutCss).toMatch(/\.club-home-col--right-foot\s*\{\s*grid-column:\s*3;\s*grid-row:\s*2;\s*\}/);
    expect(clubHomePageLayoutCss).toMatch(/\.club-home-col--left\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1;\s*\}/);
    expect(clubHomePageLayoutCss).toMatch(/\.club-home-col--right\s*\{\s*grid-column:\s*3;\s*grid-row:\s*1;\s*\}/);
  });

  it('spans the center column over both rows so the side columns do not stretch it', () => {
    expect(clubHomePageLayoutCss).toMatch(/\.club-home-col--center\s*\{\s*grid-column:\s*2;\s*grid-row:\s*1 \/ span 2;\s*\}/);
    expect(clubHomePageLayoutCss).toMatch(/grid-template-rows:\s*auto 1fr/);
  });

  it('only applies the explicit rows from the tablet breakpoint up, so mobile stays one column', () => {
    const mobileBlock = clubHomePageLayoutCss.slice(0, clubHomePageLayoutCss.indexOf('@media (min-width: 768px)'));
    expect(mobileBlock).not.toContain('grid-row');
  });
});
