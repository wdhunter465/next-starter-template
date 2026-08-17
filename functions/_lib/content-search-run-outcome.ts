// Pure mapping from a single-source discovery attempt's outcome to #3551's
// search-run terminal-state contract. No network or D1 access -- callers
// (the discovery script, and eventually a Worker) supply the outcome and
// record it through the content_search_runs admin API or repository.

import type { ContentSearchRunTerminalStatus } from './content-search-run-repository';

export type SourceCollectionOutcome = {
  resultCount: number;
  requestedLimit: number;
  error?: Error | string | null;
};

function errorMessage(error: Error | string | null | undefined): string {
  if (!error) return '';
  return (typeof error === 'string' ? error : error.message).toLowerCase();
}

export function determineSearchRunTerminalStatus(
  outcome: SourceCollectionOutcome,
): ContentSearchRunTerminalStatus {
  const message = errorMessage(outcome.error);
  if (message) {
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limited';
    }
    return 'source_error';
  }
  if (outcome.resultCount === 0) return 'no_results';
  if (outcome.resultCount >= outcome.requestedLimit) return 'completed_with_limit';
  return 'completed';
}
