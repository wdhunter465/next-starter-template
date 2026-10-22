import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Product Authority, 2026-10-16 (#4658): questions go to Admin; Support is for problems and
// broken features. The Ask page must not mail the retired Contact@ address.

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('Admin and Support wording (#4658)', () => {
  it('the Ask page mails the Admin address, not Contact@', () => {
    const ask = read('src/app/ask/page.tsx');
    expect(ask).toContain('mailto:admin@lougehrigfanclub.com');
    expect(ask).not.toMatch(/Contact@LouGehrigFanClub/i);
  });

  it('the Contact page defines Admin as questions and Support as problems and broken features', () => {
    const contact = read('src/app/contact/page.tsx');
    expect(contact).toMatch(/Email Admin with questions/);
    expect(contact).toMatch(/Email Support for help with a problem or to report a broken feature/);
    expect(contact).not.toMatch(/Use Support for general help/);
  });

  it('the specs match the code', () => {
    expect(read('docs/reference/design/faq-and-ask.md')).toContain('mailto:admin@lougehrigfanclub.com');
    expect(read('docs/reference/design/text-pages.md')).toMatch(/Support for help with a problem or to report a broken feature/);
  });
});
