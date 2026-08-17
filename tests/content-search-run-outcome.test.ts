import { describe, expect, it } from 'vitest';

import { determineSearchRunTerminalStatus } from '../functions/_lib/content-search-run-outcome';

describe('determineSearchRunTerminalStatus (#3551)', () => {
  it('maps a zero-result, error-free attempt to no_results', () => {
    expect(determineSearchRunTerminalStatus({ resultCount: 0, requestedLimit: 20 })).toBe('no_results');
  });

  it('maps results under the requested limit to completed', () => {
    expect(determineSearchRunTerminalStatus({ resultCount: 5, requestedLimit: 20 })).toBe('completed');
  });

  it('maps results at or over the requested limit to completed_with_limit', () => {
    expect(determineSearchRunTerminalStatus({ resultCount: 20, requestedLimit: 20 })).toBe('completed_with_limit');
    expect(determineSearchRunTerminalStatus({ resultCount: 25, requestedLimit: 20 })).toBe('completed_with_limit');
  });

  it('maps a rate-limit error to rate_limited, checked before the generic error case', () => {
    expect(
      determineSearchRunTerminalStatus({ resultCount: 0, requestedLimit: 20, error: new Error('HTTP 429') }),
    ).toBe('rate_limited');
    expect(
      determineSearchRunTerminalStatus({
        resultCount: 0,
        requestedLimit: 20,
        error: 'Too many requests, slow down',
      }),
    ).toBe('rate_limited');
  });

  it('maps any other error to source_error regardless of result count', () => {
    expect(
      determineSearchRunTerminalStatus({ resultCount: 3, requestedLimit: 20, error: new Error('HTTP 500') }),
    ).toBe('source_error');
  });
});
