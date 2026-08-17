import { describe, expect, it } from 'vitest';

import {
  ALLOWED_INGEST_CONTENT_TYPES,
  MAX_INGEST_BYTES,
  sha256Hex,
  validateIngestContentType,
  validateIngestMagicBytes,
  validateIngestSize,
  validateIngestSourceUrl,
} from '../functions/_lib/b2-ingest-validation';

const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const NOT_AN_IMAGE = new TextEncoder().encode('<html><body>not an image</body></html>');

const APPROVED_DOMAINS = new Set(['loc.gov', 'commons.wikimedia.org', 'openverse.org']);

describe('validateIngestContentType (#3552)', () => {
  it('accepts every content type in the allowlist', () => {
    for (const type of ALLOWED_INGEST_CONTENT_TYPES) {
      expect(validateIngestContentType(type).ok).toBe(true);
    }
  });

  it('accepts a content-type header with a charset suffix', () => {
    expect(validateIngestContentType('image/jpeg; charset=binary').ok).toBe(true);
  });

  it('rejects an unsupported content type', () => {
    const result = validateIngestContentType('application/pdf');
    expect(result.ok).toBe(false);
  });

  it('rejects a missing content type', () => {
    const result = validateIngestContentType(null);
    expect(result.ok).toBe(false);
  });
});

describe('validateIngestSize (#3552)', () => {
  it('rejects an empty body', () => {
    expect(validateIngestSize(0).ok).toBe(false);
  });

  it('accepts a body under the limit', () => {
    expect(validateIngestSize(1024).ok).toBe(true);
  });

  it('rejects a body over the limit', () => {
    expect(validateIngestSize(MAX_INGEST_BYTES + 1).ok).toBe(false);
  });

  it('accepts a body exactly at the limit', () => {
    expect(validateIngestSize(MAX_INGEST_BYTES).ok).toBe(true);
  });
});

describe('validateIngestMagicBytes (#3552)', () => {
  it('accepts bytes matching the declared JPEG content type', () => {
    expect(validateIngestMagicBytes('image/jpeg', JPEG_MAGIC).ok).toBe(true);
  });

  it('accepts bytes matching the declared PNG content type', () => {
    expect(validateIngestMagicBytes('image/png', PNG_MAGIC).ok).toBe(true);
  });

  it('rejects bytes that do not match the declared content type (HTML mislabeled as JPEG)', () => {
    const result = validateIngestMagicBytes('image/jpeg', NOT_AN_IMAGE);
    expect(result.ok).toBe(false);
  });

  it('rejects a mismatched declared type even when bytes are a valid image of another type', () => {
    const result = validateIngestMagicBytes('image/png', JPEG_MAGIC);
    expect(result.ok).toBe(false);
  });
});

describe('validateIngestSourceUrl (#3552)', () => {
  it('accepts an https URL on an exact allowlisted domain', () => {
    expect(validateIngestSourceUrl('https://loc.gov/item/example', APPROVED_DOMAINS).ok).toBe(true);
  });

  it('accepts an https URL on a subdomain of an allowlisted domain', () => {
    expect(validateIngestSourceUrl('https://www.loc.gov/item/example', APPROVED_DOMAINS).ok).toBe(true);
  });

  it('rejects http (non-https)', () => {
    expect(validateIngestSourceUrl('http://loc.gov/item/example', APPROVED_DOMAINS).ok).toBe(false);
  });

  it('rejects a domain not on the allowlist', () => {
    expect(validateIngestSourceUrl('https://random-image-host.example/x.jpg', APPROVED_DOMAINS).ok).toBe(false);
  });

  it('rejects a domain that merely contains an allowlisted domain as a substring', () => {
    // e.g. "notloc.gov.evil.example" must not pass just because it contains "loc.gov"
    expect(validateIngestSourceUrl('https://notloc.gov.evil.example/x.jpg', APPROVED_DOMAINS).ok).toBe(false);
  });

  it('rejects a malformed URL', () => {
    expect(validateIngestSourceUrl('not a url', APPROVED_DOMAINS).ok).toBe(false);
  });
});

describe('sha256Hex (#3552)', () => {
  it('produces a stable, correct hex digest', async () => {
    const bytes = new TextEncoder().encode('hello world');
    const hex = await sha256Hex(bytes);
    expect(hex).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(hex).toHaveLength(64);
  });

  it('produces different digests for different inputs', async () => {
    const a = await sha256Hex(new TextEncoder().encode('a'));
    const b = await sha256Hex(new TextEncoder().encode('b'));
    expect(a).not.toBe(b);
  });
});
