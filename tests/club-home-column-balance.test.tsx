// #5066: the Gehrig Timeline (up to 100 narrative entries) belongs in the center column.
// In the 300px left rail it made the page a long left strip with little in the center or right.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'src/app/fanclub/page.tsx'), 'utf8');

function columnBlock(name: 'center' | 'left' | 'right'): string {
  const start = source.indexOf(`clubHomeColumnClassName.${name}`);
  expect(start).toBeGreaterThan(-1);
  const next = ['center', 'left', 'right']
    .filter((other) => other !== name)
    .map((other) => source.indexOf(`clubHomeColumnClassName.${other}`))
    .filter((index) => index > start)
    .sort((a, b) => a - b)[0];
  const footer = source.indexOf('clubHomeFooterRowClassName}');
  return source.slice(start, next ?? footer);
}

describe('Club Home column balance (#5066)', () => {
  it('puts the Gehrig timeline in the center column, after the lead story and media feature', () => {
    const center = columnBlock('center');
    expect(center).toContain('<GehrigTimeline />');
    expect(center.indexOf('<ClubHomeStaticStory')).toBeLessThan(center.indexOf('<ClubHomeMediaFeature'));
    expect(center.indexOf('<ClubHomeMediaFeature')).toBeLessThan(center.indexOf('<GehrigTimeline />'));
  });

  it('keeps the timeline out of the left and right rails', () => {
    expect(columnBlock('left')).not.toContain('<GehrigTimeline');
    expect(columnBlock('right')).not.toContain('<GehrigTimeline');
  });

  it('keeps the box score in the left margin and the AL standings in the right margin', () => {
    expect(columnBlock('left')).toContain('<ClubHomeGehrigBoxScore');
    expect(columnBlock('right')).toContain('<ClubHomeAlStandings');
  });

  it('puts Events & Calendar last in the right column and not in the left (#5070)', () => {
    const right = columnBlock('right');
    expect(right).toContain('<ClubHomeEventsModule />');
    expect(right.indexOf('<ClubHomeAlStandings')).toBeLessThan(right.indexOf('<ClubHomeEventsModule />'));
    expect(columnBlock('left')).not.toContain('<ClubHomeEventsModule');
  });
});
