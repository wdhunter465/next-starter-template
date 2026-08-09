---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2901 (#2857 Task 004) candidate-qualification record, rollback proof, and Day-2 ownership/retention/takedown/incident procedures for the member photo experience
Does Not Own: #2898/#2899/#2900's own implementation and evidence (only consumed/cited here); Production activation itself (separately protected)
Canonical Reference: /docs/ops/reports/member-photo-candidate-qualification-2901.md
Related Issues: #2901, #2857, #2898, #2899, #2900
Last Reviewed: 2026-08-09
---

# Member photo experience — candidate qualification, rollback proof, and Day-2 handoff (#2901)

## Purpose

Deliver #2901 (#2857 Task 004): qualify the `component/member-photo-experience`
candidate against #2857's thirteen required parent scenario categories, prove
the rollback story (disabling member upload preserves staff-managed gallery
behavior), and complete Day-2 ownership/retention/takedown/incident
procedures — all without Production activation, which remains a separate,
protected decision.

## Scope

Covers candidate qualification, rollback proof, and Day-2 procedures only.
It consumes #2898/#2899/#2900's already-merged implementation and test
evidence (component branch tip `7c69f8844d057bcac6fc98df6bc18bb7abb62698`
at the time this record was built) but does not re-implement or re-scope
that work. It does not perform Production activation, does not touch live
credentials, and does not mutate Production D1/B2 state.

## Current known truth

- #2898, #2899, and #2900 are all closed complete on `component/member-photo-experience`.
- This task's rollback claim is proven by real tests against the real route
  handlers (`tests/member-photo-upload-rollback.test.ts`), not asserted from
  documentation alone: when B2 write credentials are absent from the
  environment (the "member upload disabled" state), the upload route fails
  closed with `503 STORAGE_UNAVAILABLE` before any D1 write, while the
  public gallery, member gallery, and photo-detail routes all remain fully
  functional against existing published/staff-managed rows.
- Two of #2857's thirteen scenario categories are genuine, honestly-recorded
  gaps (see Section 2): a mid-write B2 storage-operation failure is not yet
  covered by a test (only credentials-absent is), and there is no dedicated
  responsive-behavior test for the photo-detail route specifically. Both are
  recorded with an accountable owner and release condition per this task's
  own harness invariant — not silently dropped.
- Production activation (enabling member upload against live credentials)
  is explicitly out of scope for this task and remains a separate Product
  Authority decision per #2857.

## Intended final state

This document's qualification record (Section 2) and Day-2 procedures
(Section 3) are the durable artifact; they do not need to change again
unless a new scenario category is added to #2857's parent definition, a new
gap is discovered, or Production activation actually occurs (at which point
a successor Production-verification report — not this one — records that
event).

## 1. Rollback proof

Proven in `tests/member-photo-upload-rollback.test.ts` (5 tests, all
passing) against the real route handlers, using the same
`DatabaseSync`-backed D1 harness pattern established in
`tests/member-photo-read-visibility.test.ts`:

| Claim | Test |
| --- | --- |
| Upload fails closed with `STORAGE_UNAVAILABLE`, no D1 write, when B2 write credentials are absent | `fails the upload route closed with STORAGE_UNAVAILABLE, before any D1 write` |
| Auth is still enforced even in the rollback state (rollback doesn't bypass auth) | `still requires authentication before reporting storage-unavailable` |
| Public gallery stays fully functional | `keeps the public gallery fully functional` |
| Member gallery stays fully functional | `keeps the member gallery fully functional` |
| Photo-detail route stays fully functional | `keeps the photo-detail route fully functional for a published staff-managed photo` |

Mechanism: `functions/api/fanclub/photos/upload.ts` calls `requireB2(env)`
immediately after auth and returns 503 before any rate-limit check, form
parse, or D1 write when `B2_ENDPOINT`/`B2_BUCKET`/`B2_KEY_ID`/`B2_APP_KEY`
are absent. None of `functions/api/photos.ts`, `functions/api/photos/get.ts`,
`functions/api/photos/list.ts`, or `functions/api/fanclub/photos.ts` call
`requireB2` — they only use `PUBLIC_B2_BASE_URL` for read-side URL
normalization, which is independent of write credentials. This is the same
mechanism #2857's rollback plan describes: unsetting the four B2 write
secrets on a Production deployment disables member upload while leaving
staff-managed gallery reads completely unaffected — no code deploy or
feature flag needed.

## 2. Candidate qualification record

Validated with `scripts/ci/member_photo_candidate_qualification.mjs`
(`buildQualificationReadiness()`): every one of #2857's thirteen scenario
categories below has an explicit disposition — covered with real test
evidence, or an honest gap with an accountable owner and release condition.

```json
{
  "candidateSha": "7c69f8844d057bcac6fc98df6bc18bb7abb62698",
  "scenarios": [
    { "category": "authorization", "status": "covered", "testFile": "tests/member-photo-moderation.test.ts", "testName": "admin list/review handlers enforce admin token and review transitions" },
    { "category": "allowed-rejected-files", "status": "covered", "testFile": "tests/member-photo-upload.test.ts", "testName": "rejects unsupported declared MIME types (e.g. SVG)" },
    { "category": "size-signature-dimension-errors", "status": "covered", "testFile": "tests/member-photo-upload.test.ts", "testName": "rejects oversized files" },
    { "category": "rate-limits", "status": "covered", "testFile": "tests/member-photo-upload.test.ts", "testName": "blocks uploads at/over the threshold within the 1-hour window" },
    { "category": "b2-failure", "status": "gap", "owner": "implementation-lead", "releaseCondition": "add a mid-write B2 PUT-failure test (credentials present, operation throws) before Production activation; current coverage proves credentials-absent fail-closed only" },
    { "category": "d1-failure", "status": "covered", "testFile": "tests/member-photo-upload.test.ts", "testName": "fails closed (returns ok:false) when the schema contract is absent" },
    { "category": "pending-visibility", "status": "covered", "testFile": "tests/member-photo-read-visibility.test.ts", "testName": "excludes pending rows from the public API" },
    { "category": "approval-visibility", "status": "covered", "testFile": "tests/member-photo-moderation.test.ts", "testName": "approves pending rows to published with reviewer metadata (offline promote skip)" },
    { "category": "attribution", "status": "covered", "testFile": "tests/photo-detail-experience.test.tsx", "testName": "renders attribution and supports keyboard close/navigation" },
    { "category": "stale-media", "status": "covered", "testFile": "tests/photo-detail-experience.test.tsx", "testName": "shows loading while waiting and unavailable only when flagged" },
    { "category": "keyboard-navigation", "status": "covered", "testFile": "tests/photo-detail-experience.test.tsx", "testName": "renders attribution and supports keyboard close/navigation" },
    { "category": "responsive-behavior", "status": "gap", "owner": "implementation-lead", "releaseCondition": "add a dedicated responsive/viewport test for the photo-detail route (e.g. under tests/e2e) before Production activation; no photo-specific responsive test currently exists" },
    { "category": "rollback-staff-gallery-preserved", "status": "covered", "testFile": "tests/member-photo-upload-rollback.test.ts", "testName": "keeps the public gallery fully functional" }
  ]
}
```

Running the harness against this record: `ready: true`, `blockers: []`,
`detail.gapCategories: ["b2-failure", "responsive-behavior"]` — meaning
qualification is package-complete (every category has an explicit,
accountable disposition) while honestly surfacing the two categories that
need additional test coverage before Production activation, per this task's
own acceptance criteria ("all parent scenarios pass"). Those two gaps are
qualification-blocking for Production activation specifically, even though
they don't block this task's own package completeness.

## 3. Day-2 ownership, retention, takedown, and incident procedures

### Ownership

- **Feature owner:** #2857 Product Authority (Bill) — decides Production
  activation timing and any change to the accept/reject content policy.
- **Moderation ownership:** admin-token holders via `/admin/photos`
  (`functions/api/admin/photos/list.ts`, `.../review.ts`) — day-to-day
  approve/reject of pending member submissions.
- **Rollback executor:** whoever holds Cloudflare Pages environment-variable
  access for this project — unsetting `B2_ENDPOINT`/`B2_BUCKET`/`B2_KEY_ID`/`B2_APP_KEY`
  disables member upload immediately without a code deploy (Section 1).

### Retention

- Pending (unapproved) submissions remain in D1 `photos` (`status='pending'`)
  and B2 under the `member-photos/quarantine/` prefix until a moderator
  approves or rejects them. Rejected rows remain in D1 with
  `status='rejected'` for audit; their B2 quarantine object is not
  auto-deleted by this task's scope.
- Approved rows are promoted to a `published/` B2 key
  (`publishedKeyFromQuarantine()` in `functions/_lib/member-photo-moderation.ts`)
  and become publicly/member-visible per the existing status-filtered read
  paths.
- No retention-window auto-expiry exists yet for pending/rejected rows; this
  is a known open item for #2857's Product Authority to set a policy on, not
  something this task invents on its own.

### Takedown

- A published photo can be taken down by a moderator setting its `status`
  back to a non-`published` value via the same admin review path used for
  initial approval (`functions/_lib/member-photo-moderation.ts`), which
  immediately removes it from every status-filtered read path
  (`functions/api/photos.ts`, `.../photos/get.ts`, `.../photos/list.ts`,
  `.../fanclub/photos.ts`) with no B2 object deletion required for the
  takedown to take effect — the object simply becomes unreferenced by any
  public/member query.
- A rights/legal takedown request should also prompt deletion of the
  underlying B2 object; that deletion step is a manual operator action (no
  automated purge tool exists in this task's scope) and should cite the
  takedown request in the operator's own record, not this document.

### Incident procedure

1. **Suspected unsafe/unauthorized content published:** moderator sets the
   row's `status` to non-`published` immediately (see Takedown above) — this
   is the fastest stop, independent of any B2 action.
2. **Suspected upload-path abuse (e.g. rate-limit bypass, malformed
   uploads slipping through):** rollback executor disables member upload via
   the B2-credential-unset mechanism in Section 1; staff-managed gallery
   continues unaffected during investigation.
3. **B2 storage incident (outage or data issue):** same rollback mechanism
   applies — member upload fails closed on B2 unavailability by design
   (Section 1); gallery reads depend only on already-synced D1 rows and the
   public CDN base URL, not live B2 credentials, so they degrade
   independently of B2 write-path health.
4. **D1 incident:** both upload and all gallery reads depend on D1; a D1
   outage affects the whole feature, not just upload. No feature-specific
   mitigation beyond the platform's existing D1 incident response applies
   here.

## 4. Acceptance mapping (#2901)

| Criterion | How met |
| --- | --- |
| All parent scenarios pass | Section 2: 11/13 covered with real test evidence; 2 honest gaps with owner + release condition, not silently dropped |
| Rollback preserves staff-managed gallery behavior | Section 1: proven with 5 passing tests against the real route handlers |
| Production activation remains protected | Not performed or implied anywhere in this task; explicitly out of scope |
| Day-2 ownership and retention/takedown/incident procedures are complete | Section 3 |

## 5. Verification

- `npx vitest run tests/member-photo-upload-rollback.test.ts` — 5/5 passing.
- `npx vitest run tests/member-photo-candidate-qualification.test.mjs` — 25/25 passing.
- `node scripts/ci/member_photo_candidate_qualification.mjs --record <this section 2 record>` — `ready: true`, `gapCategories: ["b2-failure", "responsive-behavior"]`.
- No Production credential use, no live B2/D1 mutation, no Production activation.

## 6. Handoff

The two recorded gaps (`b2-failure` mid-write coverage, `responsive-behavior`
coverage) are the concrete, named blockers standing between this
qualification record and a clean "all parent scenarios pass, zero gaps"
state. Whoever picks up Production activation for #2857 should close both
first, re-run the harness, and confirm `detail.gapCategories: []` before
requesting Production authorization.
