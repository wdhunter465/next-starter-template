<!--
LGFC PR Template — stable facts only

Canonical PR-process authority: docs/governance/PR_PROCESS.md
Delivery metadata authority: docs/reference/ci/delivery-profile-contract.md

Design principle: this body holds only facts that are stable at PR-open time
and concise human-readable implementation evidence. It does not hold dynamic
GitHub lifecycle state such as review comment IDs, review-thread status, check
state, merge-readiness status, or post-merge closeout status.

Dynamic state lives in GitHub reviews, review threads, labels, required checks,
and post-merge closeout records. Merge authority remains GitHub branch
protection and required checks. The ready-for-merge label is a derived
operator-visibility signal only.

Profile examples (stable fields only — replace placeholders before opening):

Model A child:
  Size: small | Delivery model: A | Change mode: routine-ops
  Target environment: production | Approval profile: work-bill-production
  Gate profile: production-candidate | Rollback profile: one-step
  Component branch: not-applicable | Component master: not-applicable
  Promotion PR: not-applicable

Model B child:
  Size: medium | Delivery model: B-child | Change mode: project
  Target environment: component | Approval profile: component-auto-integration
  Gate profile: component-child | Rollback profile: multi-step
  Component branch: component/<release-unit> | Component master: #<program-issue>
  Promotion PR: not-applicable

Model B promotion:
  Size: large | Delivery model: B-promotion | Change mode: planned-migration
  Target environment: production | Approval profile: work-bill-production
  Gate profile: component-promotion | Rollback profile: multi-step
  Component branch: component/<release-unit> | Component master: #<program-issue>
  Promotion PR: #<this-pr-number>

Emergency recovery:
  Size: medium | Delivery model: emergency-recovery | Change mode: emergency
  Target environment: recovery | Approval profile: emergency-approval
  Gate profile: emergency-recovery | Rollback profile: emergency-stabilization
  Component branch: not-applicable | Component master: not-applicable
  Promotion PR: not-applicable
-->

# PR Summary

- **Issue:** #____  <!-- REQUIRED: open same-repo governing Issue that PREDATES this branch/PR (issue-first hard gate; #3117). No PR-first exceptions. -->
- Intent label: <!-- intent:docs / intent:feature / intent:fix / intent:chore / intent:config / intent:ci / intent:ops -->
- PR class: <!-- docs-governance / docs-content / code / config / ci / release / ops / mixed-approved -->
- Size: <!-- medium-provisional / small / medium / large -->
- Delivery model: <!-- A / B-child / B-promotion / emergency-recovery -->
- Change mode: <!-- project / routine-ops / planned-migration / emergency -->
- Target environment: <!-- component / preview / production / recovery -->
- Approval profile: <!-- component-auto-integration / work-bill-production / protected-change-review / emergency-approval -->
- Gate profile: <!-- component-child / production-candidate / component-promotion / emergency-recovery -->
- Rollback profile: <!-- one-step / multi-step / emergency-stabilization -->
- Implementation agent: <!-- required for Model B-child and B-promotion — e.g. Cursor Local -->
- Component branch: <!-- component/<release-unit> / not-applicable -->
- Component master: <!-- #<program-issue> / not-applicable -->
- Promotion PR: <!-- #<promotion-pr-number> / not-applicable -->

<!--
Delivery-model / Rollback-profile cross-check (enforced by GATE — Quality Checks / delivery_profile.mjs):
  Model A              -> Rollback profile: one-step
  Model B-child        -> Rollback profile: multi-step (+ Implementation agent required)
  Model B-promotion    -> Rollback profile: multi-step (+ Implementation agent required)
  emergency-recovery   -> Rollback profile: emergency-stabilization
Do not copy Rollback profile from a different profile example block than the Delivery model you selected.
-->

## Scope

Allowed paths:
- `path/to/file`
- `path/to/directory/**`

Out-of-scope changes present: NO
Exception issue/approval if YES: #____ / not-applicable

## Change Summary

<!-- 2-5 sentences. State what changed and why. Do not list dynamic check or review state here. -->

## Verification

Local verification:
- Command: ``
  Result: PASS / FAIL / NOT RUN

CI verification:
- Required checks expected to pass: YES / NO
- Known failing/advisory checks: none

## Acceptance Criteria

- [ ] Source issue acceptance criteria reviewed
- [ ] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: #____ / not-applicable

## Reviewer / Bot Review Attestation

- [ ] I have read all human review threads on this PR
- [ ] I have read all bot/advisory findings on this PR

<!--
Do not paste comment IDs, review-thread state, generated auto-repair blocks,
check status, or merge-readiness status here.

Resolve actionable threads directly in GitHub. Reviewer lifecycle automation must
read GitHub-native review state and review-thread state via API; it must not use
this PR body as a lifecycle database.
-->
