import { describe, expect, it } from 'vitest';

import {
  buildReadableIntakeKey,
  NEW_INTAKE_KEY_PREFIX,
  sanitizeSourceFilenameForKey,
} from '../functions/_lib/content-pipeline-media-key';

describe('sanitizeSourceFilenameForKey (#3714 phase 2)', () => {
  it('strips a leading Wikimedia "File:" prefix', () => {
    expect(sanitizeSourceFilenameForKey('File:GehrigCU.jpg')).toBe('GehrigCU');
  });

  it('is case-insensitive on the File: prefix', () => {
    expect(sanitizeSourceFilenameForKey('file:GehrigCU.jpg')).toBe('GehrigCU');
  });

  it('drops an existing extension so the caller-supplied extension is not duplicated', () => {
    expect(sanitizeSourceFilenameForKey('GehrigCU.jpg')).toBe('GehrigCU');
  });

  it('replaces unsafe characters with underscores and collapses repeats', () => {
    expect(sanitizeSourceFilenameForKey('File:Lou Gehrig, congratulating Babe Ruth (1928).jpg')).toBe(
      'Lou_Gehrig_congratulating_Babe_Ruth_1928',
    );
  });

  it('trims leading/trailing separators after sanitizing', () => {
    expect(sanitizeSourceFilenameForKey('File:!!!weird-name!!!.png')).toBe('weird-name');
  });

  it('falls back to "file" for an empty or fully-unsafe name', () => {
    expect(sanitizeSourceFilenameForKey('')).toBe('file');
    expect(sanitizeSourceFilenameForKey('***')).toBe('file');
  });

  it('caps very long names to a bounded length', () => {
    const longName = `File:${'a'.repeat(200)}.jpg`;
    const result = sanitizeSourceFilenameForKey(longName);
    expect(result.length).toBeLessThanOrEqual(80);
  });
});

describe('buildReadableIntakeKey (#3714 phase 2)', () => {
  it('builds LGFC_<content_items.id>_<sanitized-filename>.<ext>', () => {
    expect(buildReadableIntakeKey(42, 'File:GehrigCU.jpg', 'jpg')).toBe(
      `${NEW_INTAKE_KEY_PREFIX}42_GehrigCU.jpg`,
    );
  });

  it('lowercases and normalizes the extension', () => {
    expect(buildReadableIntakeKey(1, 'File:Foo.JPG', '.JPG')).toBe(`${NEW_INTAKE_KEY_PREFIX}1_Foo.jpg`);
  });

  it('two different content_items.id values never collide even for identical filenames', () => {
    const a = buildReadableIntakeKey(5, 'File:Same.jpg', 'jpg');
    const b = buildReadableIntakeKey(6, 'File:Same.jpg', 'jpg');
    expect(a).not.toBe(b);
    expect(a).toBe(`${NEW_INTAKE_KEY_PREFIX}5_Same.jpg`);
    expect(b).toBe(`${NEW_INTAKE_KEY_PREFIX}6_Same.jpg`);
  });

  it('rejects a non-positive or non-finite contentItemId', () => {
    expect(() => buildReadableIntakeKey(0, 'File:Foo.jpg', 'jpg')).toThrow();
    expect(() => buildReadableIntakeKey(-1, 'File:Foo.jpg', 'jpg')).toThrow();
    expect(() => buildReadableIntakeKey(Number.NaN, 'File:Foo.jpg', 'jpg')).toThrow();
  });

  it('falls back to a bin extension when none is supplied', () => {
    expect(buildReadableIntakeKey(9, 'File:Foo', '')).toBe(`${NEW_INTAKE_KEY_PREFIX}9_Foo.bin`);
  });
});
