import { describe, expect, it } from 'vitest';

import {
  MEMBER_UPLOAD_KEY_PREFIX,
  NEW_INTAKE_KEY_PREFIX,
  buildMemberUploadKey,
  isMemberUploadKey,
  isNewIntakeKey,
} from '../functions/_lib/content-pipeline-media-key';

describe('member-upload B2 key convention (#3552/#3553 Path C)', () => {
  it('MEMBER_UPLOAD_KEY_PREFIX nests under the shared new-intake namespace', () => {
    expect(MEMBER_UPLOAD_KEY_PREFIX.startsWith(NEW_INTAKE_KEY_PREFIX)).toBe(true);
  });

  it('buildMemberUploadKey prefixes a bare suffix', () => {
    expect(buildMemberUploadKey('sha256_abc.jpg')).toBe(`${MEMBER_UPLOAD_KEY_PREFIX}sha256_abc.jpg`);
  });

  it('buildMemberUploadKey does not double-prefix an already-prefixed key', () => {
    const key = buildMemberUploadKey('sha256_abc.jpg');
    expect(buildMemberUploadKey(key)).toBe(key);
  });

  it('buildMemberUploadKey strips leading slashes and throws on an empty suffix', () => {
    expect(buildMemberUploadKey('/sha256_abc.jpg')).toBe(`${MEMBER_UPLOAD_KEY_PREFIX}sha256_abc.jpg`);
    expect(() => buildMemberUploadKey('   ')).toThrow();
  });

  it('isMemberUploadKey / isNewIntakeKey distinguish a member upload from a Path B curated key', () => {
    const memberKey = buildMemberUploadKey('sha256_abc.jpg');
    const curatedKey = `${NEW_INTAKE_KEY_PREFIX}sha256_def.jpg`;

    expect(isMemberUploadKey(memberKey)).toBe(true);
    expect(isNewIntakeKey(memberKey)).toBe(true); // member keys still live under the shared namespace

    expect(isMemberUploadKey(curatedKey)).toBe(false);
    expect(isNewIntakeKey(curatedKey)).toBe(true);
  });
});
