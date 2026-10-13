// #4568: shared by the image and story collectors. Adds the origin-terms fields that migration
// 0084 stores on rights_evidence: the usage basis read from the captured statement, the fee
// flag, and a SHA-256 of the statement so a later change in wording is detected on re-find.
// The import recomputes usage_basis with the same function, so a registry file and D1 agree.

import { createHash } from 'node:crypto';
import { register } from 'node:module';

// Node strip-types cannot resolve extensionless relative imports inside .ts files (the same
// resolver as import-seed-candidates.mjs), and content-pipeline-usage-basis.ts imports
// ./content-permission-status without an extension so tsc (moduleResolution=bundler) accepts it.
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\\.(?:js|mjs|cjs|json|ts|tsx)$/i.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

const { usageBasisForDiscovery } = await import('../../functions/_lib/content-pipeline-usage-basis.ts');

export function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Returns a copy of a collector's rights_evidence object with usage_basis, fee flag and hash set. */
export function withOriginTerms(evidence) {
  if (!evidence) return undefined;
  const usageBasis = usageBasisForDiscovery(evidence);
  const result = { ...evidence, usage_basis: usageBasis };
  if (usageBasis === 'fee_required') {
    result.fee_required = true;
    delete result.conclusion;
  }
  if (evidence.evidence_text) {
    result.evidence_text_sha256 = sha256Hex(evidence.evidence_text);
  }
  return result;
}
