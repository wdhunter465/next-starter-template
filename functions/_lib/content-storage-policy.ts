// Content-acquisition storage/free-tier risk-control contract (#2312).
//
// This module captures the storage policy decisions Bill/Atlas recorded on
// #2312 as one deterministic, machine-checkable contract: D1 stays the
// operational index (never the binary warehouse), B2 is the binary store,
// free-tier capacity must fail closed into a tracked exception rather than
// silently overflow, and rights/privacy/legal holds always block purge
// regardless of a deletion request.
//
// Pure policy logic only -- no D1/B2 I/O, no network calls, no credentials,
// no runtime storage mutation. #2312 explicitly does not authorize D1
// migrations, B2 bucket changes, or acquisition automation; this module is
// the reusable decision contract a future authorized implementation issue
// (Program #2273/#2278 successors) wires up to real D1/B2 state.

export type StorageCapacityStatus = 'ok' | 'warning' | 'blocked_exception';

export interface StorageCapacityResult {
  status: StorageCapacityStatus;
  used_bytes: number;
  capacity_bytes: number;
  used_ratio: number | null;
  reason: string | null;
}

const DEFAULT_WARNING_RATIO = 0.8;

/**
 * Free-tier / capacity decision rule from #2312: "Use free storage where it
 * does not compromise data integrity... If free-tier limits create risk,
 * stop and surface a Bill/Atlas decision before proceeding." A capacity at
 * or above the threshold fails closed into `blocked_exception`; it never
 * silently overflows. Unknown/zero/non-finite inputs (including NaN, which
 * would otherwise make every comparison false and fall through to `ok`)
 * fail closed the same way, and `used_ratio` stays JSON-safe (`null`
 * instead of `Infinity`) rather than a non-finite number.
 */
export function evaluateStorageCapacity(
  usedBytes: number,
  capacityBytes: number,
  warningRatio: number = DEFAULT_WARNING_RATIO,
): StorageCapacityResult {
  if (!Number.isFinite(usedBytes) || !Number.isFinite(capacityBytes) || capacityBytes <= 0) {
    return {
      status: 'blocked_exception',
      used_bytes: usedBytes,
      capacity_bytes: capacityBytes,
      used_ratio: null,
      reason: 'capacity_unknown_or_zero',
    };
  }
  const usedRatio = usedBytes / capacityBytes;
  if (usedBytes >= capacityBytes) {
    return { status: 'blocked_exception', used_bytes: usedBytes, capacity_bytes: capacityBytes, used_ratio: usedRatio, reason: 'free_tier_threshold_exceeded' };
  }
  if (usedRatio >= warningRatio) {
    return { status: 'warning', used_bytes: usedBytes, capacity_bytes: capacityBytes, used_ratio: usedRatio, reason: 'approaching_free_tier_threshold' };
  }
  return { status: 'ok', used_bytes: usedBytes, capacity_bytes: capacityBytes, used_ratio: usedRatio, reason: null };
}

export type DedupeDecision = 'new' | 'duplicate';

/** Hash/fingerprint dedupe rule from #2312's file-movement policy. */
export function classifyDedupe(candidateHash: string, existingHashes: readonly string[]): DedupeDecision {
  return existingHashes.includes(candidateHash) ? 'duplicate' : 'new';
}

export type ObjectAvailability = 'available' | 'missing_object_exception';

/**
 * A D1 row referencing a B2 key with no corresponding B2 object is an
 * orphan reference, not silently-available content -- it must raise a
 * tracked exception per #2312's storage-exception requirement.
 */
export function evaluateObjectAvailability(hasB2Reference: boolean, objectExistsInB2: boolean): ObjectAvailability {
  if (hasB2Reference && !objectExistsInB2) return 'missing_object_exception';
  return 'available';
}

const ORIGINAL_RETENTION_MEDIA_TYPES = ['pdf', 'image', 'video', 'audio', 'document'] as const;
export type OriginalRetentionMediaType = (typeof ORIGINAL_RETENTION_MEDIA_TYPES)[number];

/**
 * PDF/text policy from #2312: "Do not discard the original PDF
 * automatically after text extraction." Extended to every retained binary
 * media type this pipeline handles -- derived/extracted text is never a
 * substitute for the source object. Case/whitespace-insensitive so a caller
 * passing "PDF" or " Pdf " is not misclassified as an unrecognized type.
 */
export function mustRetainOriginal(mediaType: string): boolean {
  const normalized = mediaType.trim().toLowerCase();
  return (ORIGINAL_RETENTION_MEDIA_TYPES as readonly string[]).includes(normalized);
}

export interface PurgeEligibilityInput {
  legalHold: boolean;
  rightsHold: boolean;
  privacyRestricted: boolean;
  deletionApproved: boolean;
}

export type PurgeEligibility =
  | { eligible: true; reason: null }
  | { eligible: false; reason: 'legal_hold' | 'rights_hold' | 'privacy_restricted' | 'deletion_not_approved' };

/**
 * Retention/purge rule from #2312: rights/privacy/legal holds always block
 * purge, independent of an explicit deletion approval -- automation "must
 * not silently perform final human judgments for rights clearance [or]
 * privacy clearance."
 */
export function evaluatePurgeEligibility(input: PurgeEligibilityInput): PurgeEligibility {
  if (input.legalHold) return { eligible: false, reason: 'legal_hold' };
  if (input.rightsHold) return { eligible: false, reason: 'rights_hold' };
  if (input.privacyRestricted) return { eligible: false, reason: 'privacy_restricted' };
  if (!input.deletionApproved) return { eligible: false, reason: 'deletion_not_approved' };
  return { eligible: true, reason: null };
}

export type RecoveryOutcome = 'confirmed' | 'recovery_failure_exception';

/**
 * A restore that was attempted but not verified is treated the same as one
 * that failed outright -- #2312's storage-exception requirement covers
 * "unprovable restore behavior", not only a hard restore error.
 */
export function evaluateRecoveryOutcome(restored: boolean, verified: boolean): RecoveryOutcome {
  return restored && verified ? 'confirmed' : 'recovery_failure_exception';
}
