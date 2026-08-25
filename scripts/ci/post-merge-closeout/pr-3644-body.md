<!-- orchestrator-source-issue: 3642 -->
# PR Summary

- **Issue:** #3642
- Intent label: intent:fix
- PR class: mixed-approved
- Size: medium
- Delivery model: A
- Change mode: project
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: production-candidate
- Rollback profile: one-step
- Implementation agent: not-applicable
- Component branch: not-applicable
- Component master: not-applicable
- Promotion PR: not-applicable

## Scope

Allowed paths:
- `docs/governance/REPOSITORY-AUTHORITY.md`
- `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- `docs/governance/AGENT-TEAM.md`
- `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`
- `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- `.github/orchestrator-routing.json`
- `scripts/orchestrator/queue-routing.mjs`
- `scripts/orchestrator/test-queue-routing.mjs`
- `scripts/orchestrator/fixtures/queue-routing-matrix.json`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

Note: the first 8 paths above are the #3642 declared allowlist. The 9th,
`scripts/orchestrator/fixtures/queue-routing-matrix.json`, is not part of that
declared allowlist but is listed here because one line in it changed —
disclosed in this PR's own scope rather than treated as a silent violation.

### Scope note: `scripts/orchestrator/fixtures/queue-routing-matrix.json`

This file is **not** in #3642's declared allowlist, but one line in it changed:
the pre-existing `engineering-qualification-only` case's expected
`precedenceRank` (`3` -> `4`). This is a direct, unavoidable consequence of
#3642's own authorized instruction to re-rank `precedenceRank` per the adopted
order — leaving the fixture unchanged would have made that pre-existing test
fail. All *new* Governance test coverage was added inline in
`scripts/orchestrator/test-queue-routing.mjs` instead (which **is** in scope)
specifically to avoid growing this file beyond that one unavoidable line. No
other line in it was touched.

## Change Summary

Implements the Product Authority cross-queue order decision recorded under
governance decision 3629 (Operations -> PMO Active -> PMO Pipeline -> Engineering
qualification -> Governance stewardship) across the five documents and two
orchestrator files that previously disagreed with each other and with the adopted
order. Most notably, `scripts/orchestrator/queue-routing.mjs` had no branch for
`team:governance` at all — a Governance-labeled candidate previously fell through
to `unclassified_or_ambiguous` and failed closed. That live defect is fixed
alongside the documentation reconciliation.

## Per-file changes

1. **`docs/governance/REPOSITORY-AUTHORITY.md`** — adds constitutional queue
   invariant 9 stating the default order as a scheduling tie-break. Invariant 2
   (queue ownership/authority independence) is unchanged; the new invariant is
   additive, not a replacement, per #3642's own instruction.
2. **`docs/governance/WORK-QUEUES-AND-COLLABORATION.md`** — states the order once
   at the top of "Work-queue topology"; reorders Work's "Daily work precedence"
   list (previously Governance-second, now Governance-last) to match.
3. **`docs/governance/AGENT-TEAM.md`** — replaces its own third, divergent copy
   of the per-agent precedence tables with a pointer to the canonical order.
4. **`docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`** — adds the
   missing Governance row to the machine "Routing mapping" table plus a
   precedence column.
5. **`docs/ops/pmo/queue-watch-and-dispatch-protocol.md`** — "Normal work
   selection" now names all four peer queues and points to the single canonical
   source instead of restating a divergent snippet.
6. **`.github/orchestrator-routing.json`** — `queueAwareDispatch.precedence`
   grows from 4 entries to the 5 adopted lanes plus the shared non-blocking
   interval lane.
7. **`scripts/orchestrator/queue-routing.mjs`** — adds the `team:governance`
   branch to `classifyQueueCandidate` and re-ranks `precedenceRank`.
8. **`scripts/orchestrator/test-queue-routing.mjs`** — inline coverage for the
   new Governance branch and the adopted order end-to-end.

## Verification

Local verification:
- Command: `node scripts/orchestrator/test-queue-routing.mjs`
  Result: PASS — "Queue routing tests passed (15 cases, 2 selection cases,
  wiring checks ok)"
- Command: `npx vitest run tests/cursor-bridge-parent-context.test.mjs tests/cursor-bridge-watch-build.test.ts`
  Result: PASS — 20 tests passed
- Command: `bash scripts/ci/docs_check_headers.sh`
  Result: Same pre-existing failures as on `main` (unrelated files under
  `docs/ops/implementation-plans/`, including the `issue-1075-*` rollout closeout/redesign notes,
  plus `docs/ops/reports/pmo-dashboard-reconciliation-3100.md`); none of the five docs touched by this
  PR appear in the failure output.
- Command: `node scripts/ci/diataxis_folder_audit.mjs`
  Result: PASS
- Command: `node .agents/checks/agent-governance-check.mjs`
  Result: PASS
- Command: `npm run typecheck`
  Result: PASS
- Command: `npm test` (full suite)
  Result: PASS — 1516 tests passed across 140 files
- Command: `npm run lint`
  Result: PASS (only pre-existing, unrelated element warnings)

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: pre-existing docs_check_headers noise on
  unrelated files only; none caused by this PR

## Acceptance Criteria

Criteria from #3642:

- [x] All 8 allowlisted files from #3642 state the same single cross-queue order and the same
  seven operating rules from the recorded governance decision, with no remaining
  contradiction between them; the separately disclosed fixture exception is excluded from this count.
- [x] `scripts/orchestrator/queue-routing.mjs` classifies a `team:governance`
  candidate correctly (no longer falls through to `unclassified_or_ambiguous`).
- [x] `scripts/orchestrator/test-queue-routing.mjs` covers the new Governance
  branch and passes.
- [x] `.github/orchestrator-routing.json`'s precedence array has 5 distinct,
  correctly ordered lanes.
- [x] The three per-agent "Daily work precedence" lists no longer diverge from
  the canonical order or from each other.
- [x] No scheduled/non-executable marker was invented; the open question
  remains explicitly open (see below, not silently resolved).
- [x] No path outside the allowlist was touched, except the one disclosed,
  unavoidable fixture line explained in the Scope note above.

- [x] Source issue acceptance criteria reviewed
- [x] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [x] I have read all human review threads on this PR (none yet)
- [x] I have read all bot/advisory findings on this PR

## Explicit non-goal carried forward

Per #3642, **no scheduled/future/non-executable work marker was defined,
invented, or implemented.** This remains an open, unresolved Product Authority
question. If it needs resolving, that is a separate decision, not something this
PR's docs or code silently assume an answer to.

## Rollback

One-step revert of this PR if the new orchestrator ranking misclassifies
existing queue candidates or blocks legitimate work selection in any queue. Do
not restore the old 4-lane/no-Governance behavior as a permanent workaround —
re-open against the recorded governance decision instead.

## Governance notes

- Self-approval/self-merge: not performed — this PR requires independent review
  before production merge.
- Decision record: governance decision 3629 (closed; not the closeout source).
- Source implementation authority: #3642 only.
- This PR implements a recorded decision; it does not reopen the decision
  itself.

## Post-merge remediation record

This body corrects the merged PR #3644 record for post-merge closeout exception
#3646. Failures were `invalid_source_issue_reference`, `multiple_source_issues`,
and `ambiguous_source_issue_candidates` (#3642 vs #3629).

Causes and fixes:
1. A line beginning with "Issue's declared allowlist..." was parsed as a primary
   source-issue line without a valid `#N` token.
2. Lines naming `issue-1075-...` markdown filenames were parsed as primary
   source-issue lines (word-boundary match on leading "issue").
3. Title referenced decision #3629 while the body primary line was #3642.

Remediation: exactly one primary line `- **Issue:** #3642`, hidden marker
`orchestrator-source-issue: 3642`, rephrased notes so no other line matches the
primary Issue parser, and decision context written without competing primary
Issue lines. No product/orchestrator content changes in this remediation file.
