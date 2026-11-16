// #5311: a Buffer error object must be readable in the run report and the evidence record, not "[object Object]".
import { describe, expect, it } from 'vitest';
import { describeBufferError } from '../scripts/ops/social-post-x.mjs';

describe('describeBufferError', () => {
  it('renders objects, strings, errors and empties as readable text', () => {
    expect(describeBufferError({ message: 'Rejected by X', code: 187 })).toBe('Rejected by X');
    expect(describeBufferError({ message: 'Duplicate content', code: 'duplicate' })).toBe('Duplicate content / duplicate');
    expect(describeBufferError({ detail: 'x', n: 1 })).toBe('{"detail":"x","n":1}');
    expect(describeBufferError('plain text')).toBe('plain text');
    expect(describeBufferError(new Error('boom'))).toBe('boom');
    expect(describeBufferError(undefined)).toBe('unknown');
    expect(describeBufferError(null)).toBe('unknown');
    expect(describeBufferError(42)).toBe('42');
  });

  it('never prints [object Object] and caps the length', () => {
    expect(describeBufferError({})).not.toContain('[object Object]');
    expect(describeBufferError({ message: 'a'.repeat(1000) }).length).toBe(300);
    const circular = {};
    circular.self = circular;
    expect(describeBufferError(circular)).toBe('unreadable error object');
  });
});
