import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PRIVACY_PAGE = join(process.cwd(), 'src/app/privacy/page.tsx');
const TERMS_PAGE = join(process.cwd(), 'src/app/terms/page.tsx');
const MIGRATION = join(process.cwd(), 'migrations/0045_privacy_join_ask_disclosure.sql');

describe('Privacy disclosure (#3149)', () => {
  const privacySource = readFileSync(PRIVACY_PAGE, 'utf8');
  const migrationSource = readFileSync(MIGRATION, 'utf8');
  const termsSource = readFileSync(TERMS_PAGE, 'utf8');

  it('fallback Privacy copy covers Join identity fields and optional screen name', () => {
    expect(privacySource).toMatch(/first name/i);
    expect(privacySource).toMatch(/last name/i);
    expect(privacySource).toMatch(/optional screen name/i);
    expect(privacySource).toMatch(/email/i);
  });

  it('fallback Privacy copy covers Ask question handling and member verification', () => {
    expect(privacySource).toMatch(/Ask a Question/i);
    expect(privacySource).toMatch(/question[\s\n]+text/i);
    expect(privacySource).toMatch(/member record/i);
    expect(privacySource).toMatch(/session cookie/i);
    expect(privacySource).toMatch(/welcome email/i);
  });

  it('includes a proportionate negative magic-link disclosure', () => {
    expect(privacySource).toMatch(/do not use magic-link authentication/i);
    expect(migrationSource).toMatch(/do not use magic-link authentication/i);
    expect(privacySource).not.toMatch(/magic-link authentication or verification emails/i);
    expect(privacySource).not.toMatch(/we use magic-link/i);
  });

  it('keeps migration body aligned with Join/Ask disclosure keywords', () => {
    expect(migrationSource).toContain("slug = '/privacy'");
    expect(migrationSource).toMatch(/Ask a Question/);
    expect(migrationSource).toMatch(/optional screen name/);
    expect(migrationSource).toMatch(/session cookie/);
    expect(migrationSource).toMatch(/welcome email/);
  });

  it('records Terms as reviewed without requiring a rewrite for Join/Ask facts', () => {
    expect(termsSource).toMatch(/User submissions/);
    expect(termsSource).toMatch(/admin@lougehrigfanclub\.com/);
    expect(termsSource).not.toMatch(/Join form: name and email only/i);
  });
});
