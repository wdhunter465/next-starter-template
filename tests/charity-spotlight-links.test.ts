import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// #4880: alscureproject.org is not a valid address for the ALS Cure Project.
// Product Authority confirmed https://www.ALSCure.org (2026-10-25), the address
// the friends list already uses. Keep both components on the same address.

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), 'src/components', file), 'utf8');

describe('charity spotlight links (#4880)', () => {
  it('links the ALS Cure Project to https://www.ALSCure.org', () => {
    expect(read('CharitySpotlight.tsx')).toContain('url: "https://www.ALSCure.org"');
  });

  it('does not link to the invalid alscureproject.org address', () => {
    expect(read('CharitySpotlight.tsx').toLowerCase()).not.toContain('alscureproject.org');
    expect(read('FriendsOfFanClub.tsx').toLowerCase()).not.toContain('alscureproject.org');
  });

  it('uses the same ALS Cure address in the friends list', () => {
    expect(read('FriendsOfFanClub.tsx')).toContain("https://www.ALSCure.org");
  });
});
