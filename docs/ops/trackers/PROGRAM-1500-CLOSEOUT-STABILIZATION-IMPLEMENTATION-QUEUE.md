---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Program #1500 serial implementation queue, child-task specifications, continuous work process rules, and agent assignment guidance for CI/orchestration closeout stabilization
Does Not Own: Workflow implementation, merge authority, GitHub issue mutation during normal task execution, or Program #1255 website implementation scope
Canonical Reference: /docs/ops/pmo/program-registry.md
Related issues: #1500, #1255, #1058, #1075, #4776
Last Reviewed: 2026-10-26
---

# Program #1500 — CI Post-Merge Closeout Stabilization Implementation Queue

## Launch-state control

> This program is **BLOCKED from implementation** until Product Authority explicitly launches it after this buildout PR is reviewed. Planning, review, and documentation discussion may continue, but no agent may execute Program #1500 implementation tasks until Product Authority explicitly assigns the first ready child task.
>
> **This document is planning/buildout only.** No workflow, CI script, orchestration script, or `targets-ci-pending.json` runtime changes are authorized by this file alone.

## Program metadata

| Field | Value |
| --- | --- |
| **Program title** | CI Post-Merge Closeout Reliability (closeout stabilization) |
| **Source issue** | `#1500` |
| **Program purpose** | Restore deterministic post-merge closeout: shift-left PR-body contract enforcement, eliminate duplicate closeout races, reconcile failure-path labels, automate remediation manifest cleanup, and reconcile CI/orchestration documentation with as-built behavior |
| **Execution mode** | Launched-program queue — **serial only** |
| **project slug** | `program-1500-closeout-stabilization` |
| **Predecessor programs** | CI redesign Tasks 001–006 (`#1075`), post-merge hardening (`#1238` / PR `#1241`) |
| **PMO registry** | `docs/ops/pmo/program-registry.md` |
| **Orchestration model** | `docs/how-to/ci/lgfc-ci-orchestration-issue-model.md` |

## Current failure modes (repository evidence)

Evidence source: GitHub issue `#1500` (2026-06-09 post-merge review) and as-built workflows/scripts on `main`.

| # | Failure mode | Primary evidence |
| --- | --- | --- |
| F1 | Post-merge validation fails on PR-body metadata (sections, allowlist, placeholders, reviewer dispositions) that pre-merge gates do not enforce | `post_merge_validator.mjs` `metadataFailures` / `reviewerDispositionFailures`; merges #1478, #1489, #1472 |
| F2 | Issue closeout runs only on `post_merge_success`; failure paths log exceptions without label cleanup | `sync-pr-state.mjs` lines 204–211 |
| F3 | Duplicate post-merge workflows race on every merge to `main` | `post-merge-intent-verification.yml` + `post-merge-pr-body-closeout.yml` both on `pull_request_target: closed` |
| F4 | Body remediation requires `pr-{N}-body.md` on `main` before automatic closeout can succeed | `post_merge_closeout_trigger.mjs` automatic path |
| F5 | `targets-ci-pending.json` accumulates entries without automatic pruning | manifest at `scripts/ci/post-merge-closeout/targets-ci-pending.json` |
| F6 | Documentation drift — `CI_GUARDRAILS_MAP.md` lists `gate-close-work-issue.yml` as effective closeout; surface doc omits body-closeout workflow | `.github/CI_GUARDRAILS_MAP.md`; `docs/reference/ci/post-merge-validation-surface.md` |
| F7 | Umbrella issue policy not encoded — automation may target non-closeable program umbrellas (`#1411`) | `#1500` Finding 8 |

## Scope boundaries

**In scope (implementation tasks 001–005):**

- Pre-merge gate for post-merge closeout contract
- Post-merge workflow consolidation (single owner per merge event)
- Failure/remediation label hygiene in orchestrator sync
- Remediation manifest self-pruning and backlog sweep
- CI/orchestration reference documentation reconciliation

**Out of scope:**

- Production website behavior, Cloudflare runtime, D1 schema changes
- Program #1255 (`#1258`, `#1259`) website implementation
- Bulk closure of legacy tracker issues without Product Authority authorization
- Closing umbrella issue `#1500` or `#1411` from implementation tasks unless explicitly authorized in task scope
- Parallel Program #1500 implementation (multiple active child tasks)
- Batching tasks 001–005 into one PR

## Dependency order

```text
Task 001 (pre-merge gate)
  → Task 002 (workflow consolidation)
    → Task 003 (failure-path label hygiene)
      → Task 004 (manifest cleanup automation)
        → Task 005 (docs + deprecation reconciliation)
```

| Task | Predecessor | Successor | Stage-before-merge |
| --- | --- | --- | --- |
| 001 | none | 002 | no |
| 002 | 001 merged + closeout verified | 003 | yes — Task 001 gate should be stable on `main` |
| 003 | 002 merged + closeout verified | 004 | yes |
| 004 | 003 merged + closeout verified | 005 | yes |
| 005 | 004 merged + closeout verified | terminal | yes — docs reflect stable behavior |

## Serial execution rule

- Program #1500 implementation is **strictly serial**.
- **Only the current ready task** may be assigned to an implementation agent.
- The next task **must not begin** until the prior task has **merged** and **post-merge closeout is verified** for that task's source child issue.
- **Do not parallelize** Program #1500 work across agents or branches.
- **One child issue → one branch → one PR** per task.
- If implementation requires files outside the task allowlist, **stop** and report — do not expand scope.

## Continuous work process rules

### 1. Ready state

- Task dependencies are complete (predecessor merged; closeout verified).
- File allowlist does not conflict with active Program #1255 implementation files.
- Acceptance criteria and verification commands are explicit in the child issue.
- Child issue is linked to parent `#1500`.
- For Task 001 only: buildout PR merged and a Product Authority explicit assignment recorded.

### 2. Assignment state

- Exactly **one agent** owns the task at a time.
- Agent works from the **child issue only** (`#1500` is parent context, not task authority).
- Agent creates **one branch** and **one PR** for that task.
- Agent **must not** advance to the next task without explicit human/orchestrator assignment.
- Agent **must not** pull unrelated Program #1255 work into the task branch.

### 3. Implementation state

- Stay within the file allowlist.
- Keep the diff minimal.
- Update only task-relevant docs, tests, scripts, or workflows.
- Do not modify Program #1255 queue state, `active_tasklist.md`, or website implementation plans unless the child issue explicitly includes that path.
- **Stop** if required files fall outside the allowlist.

### 4. PR validation state

PR body must include (per `.github/pull_request_template.md` and `lgfc-pr-governance` skill):

- Summary
- Source issue (`- **Issue:** #<child>`)
- Scope / file-touch allowlist
- Acceptance criteria
- Verification commands run with results
- Risk notes
- Handoff notes (PR number, files changed, unresolved risks, next-task readiness)
- Queue / dependency-map status for launched-program tasks

Required checks must pass, or failures documented with exact cause and job logs.

### 5. Post-merge closeout state

- Reconcile the **child issue** (not `#1500` umbrella) per `docs/ops/pmo/github-issue-closeout-protocol.md`.
- Labels must reflect completion or explicit remediation state.
- Capture closeout exceptions; route to remediation path if validation fails.
- Mark the **next** child task ready only after predecessor merge **and** closeout verification.

### 6. Handoff state

Completed task handoff must state:

- PR number
- Source child issue number
- Files changed
- Verification commands run
- Unresolved risks
- Whether next task is **ready**, **blocked**, or **needs rebaseline**

## Agent assignment guidance

| Task | Recommended agent | Rationale |
| --- | --- | --- |
| 001 | Codex | Repository/CI primary routing per `CORE-RULES.md`; bounded workflow + gate script |
| 002 | Codex | Workflow consolidation; high coordination risk |
| 003 | Codex | Orchestrator script + label state machine |
| 004 | Codex | Manifest automation scripts |
| 005 | Either (Codex preferred) | Docs-heavy; minimal runtime change |

**Assignment trigger:** a Product Authority explicit comment or issue update on the child task after predecessor closeout.

Use `docs/templates/agent-assignment-template.md` when packaging assignments.

## Cursor / Codex division of labor

- **Cursor** continues Program #1255 implementation (`#1258` Phase 4 Task 005 and subsequent website tasks).
- **Codex** may execute Program #1500 **only after** this buildout is reviewed and the first child task is **explicitly assigned**.
- Codex receives **one Program #1500 task at a time** — never the whole program in one run.
- Codex **stops after each child task PR** and reports status; does not self-advance the queue.
- Cursor may review or repair this planning documentation but **must not** run Program #1500 implementation in parallel with Codex unless explicitly assigned to a specific child task.
- If Program #1500 file scope overlaps active Program #1255 file ownership, mark the Program #1500 task **blocked** until overlap is resolved.

## Codex usage-risk mitigation

- Size each child task to fit constrained Codex daily usage allotments.
- Prefer **minimal diffs** — import existing `post_merge_validator.mjs` exports rather than duplicating validation logic.
- **One issue, one branch, one PR** per task.
- Use **narrow verification commands** listed in each child issue (not full `npm test` unless task touches broad surfaces).
- Avoid broad repository rewrites and exploratory refactors.
- **Stop** when usage limit risk appears likely.
- **Preserve exact status** in the child issue or PR body before stopping (commands run, files touched, blockers).
- Do not leave untracked partial work undocumented.
- Codex should receive **at most one Program #1500 task per daily usage window**.

## Program #1255 conflict avoidance

| Program #1500 task | Program #1255 active overlap risk | Mitigation |
| --- | --- | --- |
| 001–005 | **Low** — CI/workflows/scripts/docs under `.github/workflows/*post-merge*`, `scripts/ci/**`, `scripts/orchestrator/sync-pr-state.mjs` | Program #1255 Task 005 owns `src/app/admin/**` — no path overlap |
| 005 | **Low** — may touch `docs/ops/implementation-plans/website-operations-admin.md` only if explicitly added | **Exclude** website implementation plans from Task 005 allowlist |
| Any | **Medium** if Program #1255 opens CI remediation PRs concurrently | Halt Program #1500 task if an open Program #1255 PR modifies the same workflow files; rebaseline after that PR merges |

**Rule:** Cursor on Program #1255 must not assign or implement Program #1500 tasks without explicit PMO routing.

## Required verification strategy

**Per implementation task (agent-run):**

- Task-specific `npm test -- <file>` commands in each child issue
- `node scripts/ci/post_merge_validation_surface.mjs` when post-merge workflows change (Tasks 002+)
- `./scripts/ci/docs_check_headers.sh` on touched docs (Tasks 001, 005)
- `./scripts/ci/docs_canonical_hashes_verify.sh` when canonical tracked docs change (Task 005)
- Live PR check panel inspection before merge-readiness claims

**Planning/buildout verification (this PR only):**

- `git diff --check`
- `./scripts/ci/docs_check_headers.sh` on changed tracker paths

## Completion definition (Program #1500)

Program #1500 is complete when **all** of the following are true:

- [ ] Tasks 001–005 merged with verified post-merge closeout per child issue
- [ ] New merges with compliant PR bodies pass post-merge closeout on first attempt (pre-merge gate green)
- [ ] Single post-merge workflow owns validation → sync → remediation chaining
- [ ] No source issues retain stale `status:post-merge-verify` after success or explicit failure disposition
- [ ] `targets-ci-pending.json` self-prunes on successful batch closeout
- [ ] `CI_GUARDRAILS_MAP.md` and `post-merge-validation-surface.md` match as-built workflows
- [ ] Open remediation exceptions cited in `#1500` are dispositioned or documented with owner
- [ ] Product Authority signs off on `#1500` program closeout (human authority)

## Rollback / recovery notes

| Task | Rollback |
| --- | --- |
| 001 | Revert `gate-post-merge-readiness.yml` and gate script; remove branch-protection check; restore prior merge-protection doc |
| 002 | Restore both post-merge workflow files from predecessor commit; re-run post-merge surface validator |
| 003 | Revert `sync-pr-state.mjs` failure-path changes only; restore label behavior documented in pre-task baseline |
| 004 | Revert manifest prune script/workflow; manual manifest edit if prune misfired |
| 005 | Revert documentation-only diff |

**Recovery:** If a task PR fails post-merge closeout, use existing remediation path (`pr-{N}-body.md` + manifest) for that task only; do not start the next queue item until the failing task is dispositioned.

**Usage-limit stop:** Preserve PR/issue state; next agent resumes from the same child issue.

---

## Implementation queue table

| Seq | Child issue | Parent | Dependency | Agent | Status | Handoff target | P2 conflict | Codex risk | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | `#1544` — Add pre-merge post-merge-readiness gate | `#1500` | none | Codex | Merged | `#1545` | Low | Medium | Bill sign-off 2026-06-11; PR #1552 merged + closeout verified |
| 002 | `#1545` — Consolidate duplicate post-merge closeout workflows | `#1500` | `#1544` | Codex | Ready | `#1546` | Low | High | PR #1567 open; assign on `#1545` before implementation |
| 003 | `#1546` — Fix failure-path label hygiene | `#1500` | `#1545` | Codex | Blocked | `#1547` | Low | Medium | Label state machine tests required |
| 004 | `#1547` — Automate remediation manifest cleanup | `#1500` | `#1546` | Codex | Blocked | `#1548` | Low | Medium | Safe prune semantics — no destructive manifest wipe |
| 005 | `#1548` — Reconcile CI/orchestration docs and deprecated workflows | `#1500` | `#1544`–`#1547` | Either | Blocked | terminal | Low | Low | Docs after behavior stable |

*Status values: Draft / Ready / Blocked / In Progress / Merged / Closed — update in GitHub issues as tasks progress; do not mark complete prematurely.*

### Queue table detail (allowlists and verification)

#### Task 001

| Field | Value |
| --- | --- |
| **Exact file allowlist** | `.github/workflows/gate-post-merge-readiness.yml`, `scripts/ci/post_merge_readiness_gate.mjs`, `scripts/ci/post_merge_validator.mjs` (shared export wiring only — confirm no duplicate checks), `tests/gate-post-merge-readiness.test.mjs`, `tests/post-merge-validator.test.mjs` (gate-related cases only), `.github/CI_GUARDRAILS_MAP.md`, `docs/reference/ci/post-merge-validation-surface.md`, `docs/reference/ci/merge-protection-surface.md`, `docs/how-to/cursor/open-task-pr.md` |
| **Verification commands** | `npm test -- tests/gate-post-merge-readiness.test.mjs tests/post-merge-validator.test.mjs`; `node -e "import('./scripts/ci/post_merge_readiness_gate.mjs')"`; `./scripts/ci/docs_check_headers.sh` on touched docs; `git diff --check` |
| **GitHub child issue** | See [Child issue 001](#child-issue-001--1500-task-001--add-pre-merge-post-merge-readiness-gate) |

#### Task 002

| Field | Value |
| --- | --- |
| **Exact file allowlist** | `.github/workflows/post-merge-intent-verification.yml`, `.github/workflows/post-merge-pr-body-closeout.yml`, `.github/workflows/post-merge-closeout.yml` (if new consolidated workflow), `scripts/ci/run_post_merge_closeout.mjs`, `scripts/ci/post_merge_closeout_trigger.mjs`, `scripts/ci/post_merge_validator.mjs` (sync wiring only), `tests/post-merge-closeout-automatic.test.mjs`, `tests/post-merge-validation-surface.test.mjs`, `tests/orchestrator-queue.test.mjs`, `docs/reference/ci/post-merge-validation-surface.md` |
| **Verification commands** | `npm test -- tests/post-merge-closeout-automatic.test.mjs tests/post-merge-validation-surface.test.mjs tests/orchestrator-queue.test.mjs`; `node scripts/ci/post_merge_validation_surface.mjs`; `git diff --check` |
| **GitHub child issue** | See [Child issue 002](#child-issue-002--1500-task-002--consolidate-duplicate-post-merge-closeout-workflows) |

#### Task 003

| Field | Value |
| --- | --- |
| **Exact file allowlist** | `scripts/orchestrator/sync-pr-state.mjs`, `scripts/ci/post_merge_source_issue_closeout.mjs`, `tests/orchestrator-queue.test.mjs`, `tests/post-merge-source-issue-closeout.test.mjs` |
| **Verification commands** | `npm test -- tests/orchestrator-queue.test.mjs tests/post-merge-source-issue-closeout.test.mjs`; `git diff --check` |
| **GitHub child issue** | See [Child issue 003](#child-issue-003--1500-task-003--fix-failure-path-label-hygiene) |

#### Task 004

| Field | Value |
| --- | --- |
| **Exact file allowlist** | `scripts/ci/run_batch_post_merge_closeout.mjs`, `scripts/ci/run_post_merge_closeout_all_manifests.mjs`, `scripts/ci/prune_closeout_manifest.mjs` (new), `.github/workflows/ops-post-merge-backlog-sweep.yml` (new, if scheduled sweep authorized), `scripts/ci/post-merge-closeout/targets-ci-pending.json`, `scripts/ci/post-merge-closeout/targets-ci-pending-rerun.json`, `scripts/ci/post-merge-closeout/targets-remediation-backlog.json`, `tests/post-merge-closeout-all-manifests.test.mjs`, `tests/batch-post-merge-closeout.test.mjs` |
| **Verification commands** | `npm test -- tests/post-merge-closeout-all-manifests.test.mjs tests/batch-post-merge-closeout.test.mjs`; `git diff --check` |
| **GitHub child issue** | See [Child issue 004](#child-issue-004--1500-task-004--automate-remediation-manifest-cleanup) |

#### Task 005

| Field | Value |
| --- | --- |
| **Exact file allowlist** | `.github/CI_GUARDRAILS_MAP.md`, `docs/reference/ci/post-merge-validation-surface.md`, `docs/reference/ci/workflow-inventory.md`, `docs/reference/ci/lgfc-ci-as-built-reconciliation.md`, `.github/workflows/gate-close-work-issue.yml` (deprecation header/comment only), `docs/ops/pmo/github-issue-closeout-protocol.md` (umbrella exclusion policy section) |
| **Verification commands** | `node scripts/ci/post_merge_validation_surface.mjs`; `./scripts/ci/docs_check_headers.sh` on touched docs; `./scripts/ci/docs_canonical_hashes_verify.sh`; `git diff --check` |
| **GitHub child issue** | See [Child issue 005](#child-issue-005--1500-task-005--reconcile-ciorchestration-docs-and-deprecated-workflows) |

---

## Child issue specifications

The bodies below are authoritative. GitHub issues created from this buildout reference the same content.

---

### Child issue 001 — `#1544` — Add pre-merge post-merge-readiness gate

<!-- lgfc-task-id:program-1500-closeout-stabilization:Task-001 -->

**Title:** `#1500 Task 001 — Add pre-merge post-merge-readiness gate`

**Parent:** `#1500`

**Objective:** Add a blocking pre-merge gate that runs the same post-merge closeout metadata and reviewer-disposition checks against the PR head body **before merge**, preventing merges that would fail post-merge closeout.

**Background / problem statement:** Pre-merge gates (`gate-quality`, `ops-pr-issue-accounting`, `gate-drift`) do not enforce required PR body sections, file-touch allowlist, forbidden placeholders, or reviewer comment dispositions. `post_merge_validator.mjs` enforces these **after merge** via `post-merge-intent-verification.yml`, causing `post_merge_failure` and manual remediation loops (Finding F1 in `#1500`).

**In scope:**

- New workflow `.github/workflows/gate-post-merge-readiness.yml` triggered on `pull_request` (opened, synchronize, reopened, ready_for_review)
- New gate runner `scripts/ci/post_merge_readiness_gate.mjs` that imports `metadataFailures`, `blockingMetadataFailures`, `reviewerDispositionFailures` from `post_merge_validator.mjs` adapted for **non-merged** PR head context (do not duplicate validation rules — confirm current exports suffice)
- Unit tests for gate pass/fail paths
- Update `CI_GUARDRAILS_MAP.md`, `merge-protection-surface.md`, `post-merge-validation-surface.md` with the new gate
- Cross-reference PR body contract in `docs/how-to/cursor/open-task-pr.md`

**Out of scope:**

- Consolidating post-merge workflows (Task 002)
- Changing `sync-pr-state.mjs` label behavior (Task 003)
- Manifest cleanup (Task 004)
- Branch protection UI changes in GitHub settings (document operator action item only)
- Program #1255 files

**Exact file allowlist:**

- `.github/workflows/gate-post-merge-readiness.yml`
- `scripts/ci/post_merge_readiness_gate.mjs`
- `scripts/ci/post_merge_validator.mjs` (minimal shared wiring only)
- `tests/gate-post-merge-readiness.test.mjs`
- `tests/post-merge-validator.test.mjs` (gate-related cases only)
- `.github/CI_GUARDRAILS_MAP.md`
- `docs/reference/ci/post-merge-validation-surface.md`
- `docs/reference/ci/merge-protection-surface.md`
- `docs/how-to/cursor/open-task-pr.md`

**Expected file changes:**

- New gate workflow + gate script (~150–300 LOC total)
- Tests covering missing sections, missing allowlist, placeholder tokens, undispositioned reviewer threads
- Docs listing new required check job id for operator branch-protection update

**Acceptance criteria:**

- [ ] Gate fails PRs missing required post-merge body sections (`## CHANGE SUMMARY`, `## BUILD / TEST / VERIFICATION`, `## ACCEPTANCE CRITERIA`, allowlist header)
- [ ] Gate fails PRs with forbidden placeholder tokens and undispositioned trusted reviewer findings (same rules as post-merge validator)
- [ ] Gate passes a compliant reference PR body fixture
- [ ] No duplicate validation logic forked from `post_merge_validator.mjs` without justification in PR body
- [ ] Guardrails map and merge-protection surface document the new gate
- [ ] Implementation is serial; one PR only

**Verification commands:**

```bash
npm test -- tests/gate-post-merge-readiness.test.mjs tests/post-merge-validator.test.mjs
node -e "import('./scripts/ci/post_merge_readiness_gate.mjs')"
./scripts/ci/docs_check_headers.sh .github/CI_GUARDRAILS_MAP.md docs/reference/ci/post-merge-validation-surface.md docs/reference/ci/merge-protection-surface.md docs/how-to/cursor/open-task-pr.md
git diff --check
```

**Required PR body sections:** Summary; `- **Issue:** #<this-child>`; scope/allowlist; acceptance criteria; verification results; risk notes; handoff notes; queue status (next: Task 002, halt until merged).

**Risk notes:** Branch protection must add the new check job id manually by operator; document job id in merge-protection surface. Gate must not require merged-only fields (`mergedAt`) — adapt validator inputs for open PR context.

**Dependency notes:** Predecessor: none. Successor: Task 002. Stage-before-merge: no.

**Program #1255 conflict notes:** No file overlap with active `#1258` admin implementation.

**Codex usage notes:** Single bounded task; stop after PR ready for review; do not start Task 002.

**Handoff notes for next task:** Record gate job id, export surface used from validator, and any open PR fixtures that still fail the gate.

**Serial instruction:** Implementation must be serial. Stop if scope exceeds allowlist.

---

### Child issue 002 — `#1545` — Consolidate duplicate post-merge closeout workflows

<!-- lgfc-task-id:program-1500-closeout-stabilization:Task-002 -->

**Title:** `#1500 Task 002 — Consolidate duplicate post-merge closeout workflows`

**Parent:** `#1500`

**Objective:** Eliminate duplicate/racing post-merge closeout paths by consolidating `post-merge-intent-verification.yml` and `post-merge-pr-body-closeout.yml` into a single sequential closeout owner per merge event while preserving body-apply, validate, sync, and remediation chaining.

**Background / problem statement:** Both workflows fire on `pull_request_target: closed` for merges to `main`. Each can invoke `post_merge_validator.mjs` and `sync-pr-state.mjs`, producing race conditions and inconsistent label state (Finding F3). `post-merge-validation-surface.md` documents only the intent-verification workflow.

**In scope:**

- Repository review of both workflows and `run_post_merge_closeout.mjs` before editing
- Single sequential closeout workflow (consolidate or demote one workflow to dispatch-only backfill)
- Preserve: body apply when `pr-{N}-body.md` exists, single validator run, single `sync-pr-state` call, remediation chain via `post-merge-remediation.yml`
- Update `post-merge-validation-surface.md` and surface tests

**Out of scope:**

- Pre-merge gate changes except fixes required by consolidation regressions
- Label hygiene in failure paths (Task 003)
- Manifest pruning (Task 004)
- Removing `post-merge-remediation.yml`

**Exact file allowlist:**

- `.github/workflows/post-merge-intent-verification.yml`
- `.github/workflows/post-merge-pr-body-closeout.yml`
- `.github/workflows/post-merge-closeout.yml` (if created as consolidated owner)
- `scripts/ci/run_post_merge_closeout.mjs`
- `scripts/ci/post_merge_closeout_trigger.mjs`
- `scripts/ci/post_merge_validator.mjs` (sync output wiring only)
- `tests/post-merge-closeout-automatic.test.mjs`
- `tests/post-merge-validation-surface.test.mjs`
- `tests/orchestrator-queue.test.mjs`
- `docs/reference/ci/post-merge-validation-surface.md`

**Expected file changes:**

- One workflow owns automatic merge closeout; the other reduced to manual/batch dispatch paths or removed with migration notes
- Tests prove single `sync-pr-state` invocation per merge event
- Surface doc lists authoritative workflow set

**Acceptance criteria:**

- [ ] Only one workflow performs automatic post-merge validate+sync per merged PR to `main`
- [ ] Body apply + batch manifest paths still work for manual/backfill dispatch
- [ ] `post-merge-remediation.yml` still triggers on validation failure
- [ ] `node scripts/ci/post_merge_validation_surface.mjs` passes
- [ ] No duplicate `sync-pr-state` calls in automatic merge path (test or workflow inspection evidence in PR)

**Verification commands:**

```bash
npm test -- tests/post-merge-closeout-automatic.test.mjs tests/post-merge-validation-surface.test.mjs tests/orchestrator-queue.test.mjs
node scripts/ci/post_merge_validation_surface.mjs
git diff --check
```

**Required PR body sections:** Standard governance fields; document workflow overlap analysis; handoff to Task 003.

**Risk notes:** High-impact CI change — minimal diff; preserve `workflow_dispatch` and `push` manifest batch paths. Test with fixture PR numbers from existing closeout tests.

**Dependency notes:** Predecessor: Task 001 merged and closeout verified. Successor: Task 003. Stage-before-merge: yes.

**Program #1255 conflict notes:** Low overlap risk.

**Codex usage notes:** Highest complexity task — stop after one PR; preserve status if usage limited mid-edit.

**Handoff notes for next task:** Document final workflow ownership diagram and which workflow files are dispatch-only.

**Serial instruction:** Implementation must be serial. Stop if scope exceeds allowlist.

---

### Child issue 003 — `#1546` — Fix failure-path label hygiene

<!-- lgfc-task-id:program-1500-closeout-stabilization:Task-003 -->

**Title:** `#1500 Task 003 — Fix failure-path label hygiene`

**Parent:** `#1500`

**Objective:** Ensure `post_merge_failure` and `post_merge_remediation` paths deterministically reconcile labels (remove stale `status:post-merge-verify`, apply failure disposition labels) without closing the source issue.

**Background / problem statement:** `sync-pr-state.mjs` only reconciles terminal labels on `post_merge_success`. Failure paths log exceptions and leave `status:post-merge-verify` on open issues (Finding F2). Live drift documented in `#1500` (#1488, #1411, #1404).

**In scope:**

- Update `sync-pr-state.mjs` for `post_merge_failure` and `post_merge_remediation` actions
- Align with `docs/ops/pmo/github-issue-closeout-protocol.md` terminal label policy
- Update `post_merge_source_issue_closeout.mjs` helpers if closeout decision logic requires coordination
- Tests for all three sync actions

**Out of scope:**

- Closing source issues on failure paths (safety model preserved)
- Workflow YAML structural changes (Task 002)
- Umbrella auto-close policy encoding (Task 005 docs)
- Manifest cleanup (Task 004)

**Exact file allowlist:**

- `scripts/orchestrator/sync-pr-state.mjs`
- `scripts/ci/post_merge_source_issue_closeout.mjs`
- `tests/orchestrator-queue.test.mjs`
- `tests/post-merge-source-issue-closeout.test.mjs`

**Expected file changes:**

- Failure paths remove `status:post-merge-verify` and apply `status:failed` (or documented equivalent) on source issue
- Success path behavior unchanged
- Tests cover `post_merge_success`, `post_merge_failure`, `post_merge_remediation`

**Acceptance criteria:**

- [ ] `post_merge_failure` removes `status:post-merge-verify` and does not close source issue
- [ ] `post_merge_remediation` same hygiene rules
- [ ] `post_merge_success` behavior regression-free per existing tests
- [ ] No closed issues retain `status:post-merge-verify` in test fixtures simulating success path

**Verification commands:**

```bash
npm test -- tests/orchestrator-queue.test.mjs tests/post-merge-source-issue-closeout.test.mjs
git diff --check
```

**Required PR body sections:** Standard governance fields; label state machine before/after table; handoff to Task 004.

**Risk notes:** Touches live orchestrator sync — minimal diff; do not relabel remediation issues incorrectly.

**Dependency notes:** Predecessor: Task 002 merged and closeout verified. Successor: Task 004. Stage-before-merge: yes.

**Program #1255 conflict notes:** None.

**Codex usage notes:** Medium scope — ideal single-session task.

**Handoff notes for next task:** Confirm label names exist in repo (`gh label list` evidence in PR).

**Serial instruction:** Implementation must be serial. Stop if scope exceeds allowlist.

---

### Child issue 004 — `#1547` — Automate remediation manifest cleanup

<!-- lgfc-task-id:program-1500-closeout-stabilization:Task-004 -->

**Title:** `#1500 Task 004 — Automate remediation manifest cleanup`

**Parent:** `#1500`

**Objective:** Prevent stale `targets-ci-pending.json` drift by automatically removing manifest entries after successful batch closeout and documenting safe stale-backlog handling.

**Background / problem statement:** `targets-ci-pending.json` accumulates entries for merged PRs (#1473, #1458, #1229, etc.) with no automatic pruning after success (Finding F5). Manual remediation PRs are required to align manifest tests.

**In scope:**

- Safe prune semantics: remove target only after successful closeout report marks `sync_action: post_merge_success` for that PR
- Update `run_batch_post_merge_closeout.mjs` and/or `run_post_merge_closeout_all_manifests.mjs`
- New helper `scripts/ci/prune_closeout_manifest.mjs` if needed
- Optional scheduled `ops-post-merge-backlog-sweep.yml` for stale entries (document trigger cadence)
- Tests for prune-on-success and no-prune-on-failure

**Out of scope:**

- Deleting historical `pr-{N}-body.md` remediation files
- Bulk manifest wipe without per-target success evidence
- Documentation reconciliation (Task 005)
- Changing post-merge validation rules

**Exact file allowlist:**

- `scripts/ci/run_batch_post_merge_closeout.mjs`
- `scripts/ci/run_post_merge_closeout_all_manifests.mjs`
- `scripts/ci/prune_closeout_manifest.mjs`
- `.github/workflows/ops-post-merge-backlog-sweep.yml`
- `scripts/ci/post-merge-closeout/targets-ci-pending.json`
- `scripts/ci/post-merge-closeout/targets-ci-pending-rerun.json`
- `scripts/ci/post-merge-closeout/targets-remediation-backlog.json`
- `tests/post-merge-closeout-all-manifests.test.mjs`
- `tests/batch-post-merge-closeout.test.mjs`

**Expected file changes:**

- Manifest entries removed deterministically after verified success
- Stale backlog validation strategy documented in PR body
- Tests lock prune behavior

**Acceptance criteria:**

- [ ] Successful batch closeout removes processed entries from pending manifest
- [ ] Failed closeout leaves entries intact
- [ ] Empty manifest state valid (`targets: []`)
- [ ] Stale entry handling documented with operator sweep workflow if added

**Verification commands:**

```bash
npm test -- tests/post-merge-closeout-all-manifests.test.mjs tests/batch-post-merge-closeout.test.mjs
git diff --check
```

**Required PR body sections:** Standard governance fields; prune semantics table; handoff to Task 005.

**Risk notes:** Incorrect prune could drop required remediation targets — fail closed (no prune on ambiguous result).

**Dependency notes:** Predecessor: Task 003 merged and closeout verified. Successor: Task 005. Stage-before-merge: yes.

**Program #1255 conflict notes:** None.

**Codex usage notes:** Keep script changes focused; avoid rewriting entire batch runner.

**Handoff notes for next task:** List manifest files affected and whether sweep workflow was added.

**Serial instruction:** Implementation must be serial. Stop if scope exceeds allowlist.

---

### Child issue 005 — `#1548` — Reconcile CI/orchestration docs and deprecated workflows

<!-- lgfc-task-id:program-1500-closeout-stabilization:Task-005 -->

**Title:** `#1500 Task 005 — Reconcile CI/orchestration docs and deprecated workflows`

**Parent:** `#1500`

**Objective:** Update authoritative CI/orchestration documentation after Tasks 001–004 behavior is stable; mark deprecated workflows; encode umbrella/source-issue exclusion policy where applicable.

**Background / problem statement:** `CI_GUARDRAILS_MAP.md` lists `gate-close-work-issue.yml` as effective closeout; workflow is a deprecated noop. `post-merge-validation-surface.md` omitted body-closeout workflow until Task 002. Umbrella issues like `#1411` need documented exclusion from auto-close (Finding F6, F7, F8).

**In scope:**

- Reconcile `CI_GUARDRAILS_MAP.md` with as-built workflows including Task 001 gate and Task 002 consolidated closeout
- Update `post-merge-validation-surface.md`, `workflow-inventory.md`, `lgfc-ci-as-built-reconciliation.md`
- Mark `gate-close-work-issue.yml` deprecated per repository policy (workflow comment + docs — no behavior change unless policy requires)
- Add umbrella issue closeout exclusion policy to `github-issue-closeout-protocol.md`

**Out of scope:**

- Runtime workflow logic changes (behavior should be stable from Tasks 001–004)
- Program #1255 website plans or `active_tasklist.md`
- Closing `#1500` umbrella issue
- Dispositioning open remediation PRs (#1491, #1492) — record operator action items only

**Exact file allowlist:**

- `.github/CI_GUARDRAILS_MAP.md`
- `docs/reference/ci/post-merge-validation-surface.md`
- `docs/reference/ci/workflow-inventory.md`
- `docs/reference/ci/lgfc-ci-as-built-reconciliation.md`
- `.github/workflows/gate-close-work-issue.yml` (deprecation comment/header only)
- `docs/ops/pmo/github-issue-closeout-protocol.md`

**Expected file changes:**

- Docs-only alignment with merged Tasks 001–004
- Deprecation markers for noop closeout gate
- Umbrella exclusion policy section with `#1411` example

**Acceptance criteria:**

- [ ] Guardrails map matches workflow inventory for post-merge and pre-merge closeout gates
- [ ] `node scripts/ci/post_merge_validation_surface.mjs` passes
- [ ] Umbrella issue exclusion policy documented
- [ ] No undocumented effective/ineffective workflow conflicts for closeout paths

**Verification commands:**

```bash
node scripts/ci/post_merge_validation_surface.mjs
./scripts/ci/docs_check_headers.sh .github/CI_GUARDRAILS_MAP.md docs/reference/ci/post-merge-validation-surface.md docs/reference/ci/workflow-inventory.md docs/reference/ci/lgfc-ci-as-built-reconciliation.md docs/ops/pmo/github-issue-closeout-protocol.md
./scripts/ci/docs_canonical_hashes_verify.sh
git diff --check
```

**Required PR body sections:** Standard governance fields; doc drift checklist; program completion handoff to Product Authority for `#1500` signoff.

**Risk notes:** Docs-only — do not change workflow runtime in this task.

**Dependency notes:** Predecessor: Tasks 001–004 merged and closeout verified. Successor: terminal. Stage-before-merge: yes.

**Program #1255 conflict notes:** Exclude website implementation plans from allowlist.

**Codex usage notes:** Low risk; suitable if Codex usage remains available after Tasks 001–004.

**Handoff notes:** Program implementation queue complete — recommend a Product Authority `#1500` program closeout review.

**Serial instruction:** Implementation must be serial. Stop if scope exceeds allowlist.

---

## Related references

- Program charter: GitHub `#1500`
- PMO queue mode: `docs/reference/pmo/lgfc-program-queue-and-dependency-map.md`
- CI orchestration issue model: `docs/how-to/ci/lgfc-ci-orchestration-issue-model.md`
- Closeout protocol: `docs/ops/pmo/github-issue-closeout-protocol.md`
- Agent assignment template: `docs/templates/agent-assignment-template.md`
- Post-merge validator: `scripts/ci/post_merge_validator.mjs`
- Orchestrator sync: `scripts/orchestrator/sync-pr-state.mjs`

## Buildout record

| Field | Value |
| --- | --- |
| Buildout type | Planning / queue specification only |
| Buildout branch | `codex/program-1500-buildout` |
| Implementation changes | **None** — no workflow, script, or manifest logic modified by this buildout |
| Child issues | `#1544`, `#1545`, `#1546`, `#1547`, `#1548` (created 2026-06-11) |
