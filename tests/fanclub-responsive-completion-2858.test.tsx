import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HAMBURGER_MENU_ITEMS } from '@/components/HamburgerMenu';

describe('#2858 fanclub responsive completion', () => {
  it('exposes the full authenticated Fan Club drawer IA', () => {
    const labels = HAMBURGER_MENU_ITEMS.fanclub.map((item) => item.label);
    expect(labels).toEqual([
      'Club Home',
      'My Profile',
      'Photo',
      'Library',
      'Memorabilia',
      'Chat',
      'Submit',
      'Search',
      'Store',
      'Logout',
      'About',
      'Contact',
    ]);
  });

  it('hrefs each new drawer item to its route', () => {
    const items = HAMBURGER_MENU_ITEMS.fanclub;
    expect(items.find((i) => i.label === 'Photo')).toMatchObject({ href: '/fanclub/photo' });
    expect(items.find((i) => i.label === 'Library')).toMatchObject({ href: '/fanclub/library' });
    expect(items.find((i) => i.label === 'Memorabilia')).toMatchObject({ href: '/fanclub/memorabilia' });
    expect(items.find((i) => i.label === 'Chat')).toMatchObject({ href: '/fanclub/chat' });
    expect(items.find((i) => i.label === 'Submit')).toMatchObject({ href: '/fanclub/submit' });
  });

  it('adds a tablet (600px) breakpoint to the shared three-column gallery grid', () => {
    const css = readFileSync('src/components/fanclub/fanclubGridStyles.module.css', 'utf8');
    expect(css).toContain('@media (min-width: 600px)');
    expect(css).toContain('repeat(2, minmax(0, 1fr))');
    expect(css).toContain('@media (min-width: 900px)');
    expect(css).toContain('repeat(3, minmax(0, 1fr))');
  });

  it('ships fluid CSS modules with 44px tap targets for converted interactive pages', () => {
    for (const path of [
      'src/app/fanclub/library/page.module.css',
      'src/app/fanclub/memorabilia/page.module.css',
      'src/app/fanclub/myprofile/page.module.css',
      'src/app/fanclub/chat/page.module.css',
      'src/app/search/page.module.css',
    ]) {
      const css = readFileSync(path, 'utf8');
      expect(css).toContain('min-height: 44px');
      expect(css).toMatch(/max-width:\s*(100%|\d+px)/);
    }
  });

  it('keeps membership card figures fluid without requiring control tap targets', () => {
    const css = readFileSync('src/components/fanclub/MembershipCardSection.module.css', 'utf8');
    expect(css).toContain('max-width: min(190px, 100%)');
    expect(css).toContain('@media (max-width: 390px)');
  });

  it('keeps the converted pages free of hardcoded inline style objects', () => {
    for (const path of [
      'src/app/fanclub/library/page.tsx',
      'src/app/fanclub/memorabilia/page.tsx',
      'src/app/fanclub/myprofile/page.tsx',
      'src/app/fanclub/chat/page.tsx',
      'src/app/search/page.tsx',
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source).not.toMatch(/style=\{\{/);
    }
  });

  it('converts the membership-card figure images to the CSS module (outer Club Home theming untouched)', () => {
    const source = readFileSync('src/components/fanclub/MembershipCardSection.tsx', 'utf8');
    expect(source).toContain("import styles from './MembershipCardSection.module.css'");
    expect(source).toContain('className={styles.figures}');
    expect(source).toContain('className={styles.cardImage}');
  });
});
