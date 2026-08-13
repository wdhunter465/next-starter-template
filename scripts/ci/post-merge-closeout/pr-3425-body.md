# PR Summary

- **Issue:** #3424
- Intent label: intent:docs
- PR class: docs-governance
- Size: medium
- Delivery model: A
- Change mode: routine-ops
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: production-candidate
- Rollback profile: one-step
- Implementation agent: Cursor Local
- Component branch: not-applicable
- Component master: not-applicable
- Promotion PR: not-applicable

DOC_SOURCE: DIATAXIS_FULL
DOC_SOURCE_FILES:
- docs/governance/standards/CURSOR-RUNTIME-ROUTING.md
- docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md
- docs/reference/ci/cursor-local-bridge-contract.md
DIATAXIS_GAP:
- NONE

## Scope

Allowed paths:
- `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`
- `AGENTS.md`
- `docs/ops/ai/CURSOR-RULES.md`
- `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`
- `docs/how-to/cursor/github-poll-wake-loop.md`
- `docs/how-to/cursor/agent-session-bootstrap.md`
- `docs/how-to/cursor/configure-cursor-local-bridge.md`
- `docs/reference/ci/cursor-local-bridge-contract.md`
- `docs/explanation/operations/cursor-local-auto-start-architecture.md`
- `docs/reference/ci/repository-runner-contract.md`
- `docs/how-to/ci/configure-lgfc-repository-runner.md`
- `docs/reference/ci/claude-code-wake-contract.md`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Documents Product Authority decision #3424 that Cursor Local Bridge is decommissioned as the primary local auto-start path. Canonical routing/bootstrap docs now point to `lgfc-cursor-dispatch`; Bridge and poll-wake materials are marked superseded/decommissioned historical reference. No workflow, script, runner, credential, or runtime code changes.

## Verification

Local verification:
- Command: `git diff --check`
  Result: PASS
- Command: allowlist diff-scope verification (12 files, all allowlisted)
  Result: PASS
- Command: repository search for current-form Bridge-as-primary claims in allowlisted set
  Result: PASS (claims only appear in decommission/superseded framing)
- Command: `bash scripts/ci/docs_check_paths.sh`
  Result: PASS
- Command: `bash scripts/ci/docs_check_headers.sh` (allowlisted docs)
  Result: PASS
  Note: repo-wide header-check findings on untouched files outside this allowlist were pre-existing and were not part of PR #3425. AGENTS.md is a bootstrap router without a docs header by design.

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: none expected from this docs-only diff

## Acceptance Criteria

- [x] No canonical/current documentation identifies Cursor Local Bridge as the active primary/default local auto-start route
- [x] Bridge setup and contract pages are clearly marked superseded/decommissioned where retained
- [x] Current Cursor routing/bootstrap documentation is internally consistent across the allowlisted files
- [x] GitHub poll/wake, repository-runner, and Claude wake documentation remains accurate and is changed only where necessary to remove Bridge dependency/cross-reference drift
- [x] No workflow/script/code/configuration file is changed
- [x] No new runtime architecture is introduced by documentation alone
- [x] Documentation links/references remain valid or are intentionally redirected to the supported path
- [x] Applicable documentation validation and `git diff --check` pass for allowlisted files; repo-wide header-check findings on untouched files remain out of scope
- [x] PR diff contains only the exact allowlisted files actually needed
- [x] Cursor posts an IMPLEMENTATION HANDOFF on #3424 (follows PR open)

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [x] I have read all human review threads on this PR
- [x] I have read all bot/advisory findings on this PR

Queue / dependency-map status:
- dependency-map result: not-applicable
- next queue item: not-applicable
- continue/halt decision: not-applicable

Post-merge issue disposition: comment-only; GitHub issue closeout after merge unless separately authorized. Self-approval/self-merge prohibited.

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3778176081 — accepted — Purpose now states automatic Bridge wake is retired/decommissioned and trusted diagnostic workflow_dispatch (CURSOR_WAKE_DIAGNOSTIC) remains optional; that is not Cursor launch — thread state: outdated
