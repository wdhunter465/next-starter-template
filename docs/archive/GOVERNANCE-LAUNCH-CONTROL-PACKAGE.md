---
Doc Type: Operational Rules
Audience: Bill, ChatGPT, Cursor, Codex, LGFC maintainers, implementation agents, and governance reviewers
Authority Level: Operational Authority
Owns: Governance program launch-control package, program-prep workflow, master/child issue structure, Cursor pre-implementation checkpoint, authorization gates, stop points, verification and rollback doctrine for governance closeout continuation after Program #1500 Task 001
Does Not Own: Runtime implementation, workflow YAML, CI script execution, branch protection UI configuration, issue creation before Bill/ChatGPT authorization, merge authority, Program #1500 Task 001 gate code (already merged in PR #1552)
Canonical Reference: /docs/ops/trackers/PROGRAM-1500-CLOSEOUT-STABILIZATION-IMPLEMENTATION-QUEUE.md
Related Issues: #1755, #1500, #1544, #1545, #1546, #1547, #1548
Last Reviewed: 2026-06-17
---

# Governance Launch-Control Package

> This package is **launch-control ready for review only**. It does not authorize Cursor implementation, child issue creation, workflow edits, or branch protection changes until Bill/ChatGPT explicitly authorize the next phase.

## Purpose

This document finishes governance program preparation after Program #1500 Task 001 by packaging the remaining closeout-stabilization work in a launch-control-ready form for Cursor pre-implementation review.

The package defines:

- how closed PR #1552 and Issue #1544 relate to future governance work without treating the merged PR as active implementation;
- what **launch-control ready** means for governance program continuation;
- the program-prep workflow, master issue structure, and child issue queue for Program #1500 Tasks 002–005;
- Cursor review/comment checkpoints before any implementation agent starts;
- Bill/ChatGPT authorization gates and continuous execution stop points;
- verification, rollback, non-goals, risks, and closeout criteria.

Companion draft automation concepts live in `docs/reference/governance/governance-launch-control-reference-implementation.md`. That reference document is **not implemented** by this documentation package.

## Scope

This document owns governance launch-control doctrine for Program #1500 closeout continuation and the Cursor review checkpoint that must precede implementation.

This document does not authorize implementation, create GitHub issues, modify workflows, change CI scripts, update branch protection, or supersede Program #1500 queue authority in `docs/ops/trackers/PROGRAM-1500-CLOSEOUT-STABILIZATION-IMPLEMENTATION-QUEUE.md`.

## Current known truth

- Program #1500 Task 001 / Issue #1544 / PR #1552 merged on 2026-06-11 and added the pre-merge `post-merge-readiness` gate.
- Issue #1544 is closed with `status:complete`; PR #1552 is merged and must be treated as historical evidence only.
- Program #1500 Tasks 002–005 remain in the serial queue (`#1545`–`#1548`); Task 002 is ready after Task 001 closeout verification.
- Branch protection operator action for job id `post-merge-readiness` was documented in Task 001 but remains an operator responsibility outside this docs package.
- Issue #1755 authorizes only the two documentation files in this launch-control package.

## Intended final state

After Bill/ChatGPT accept this package and explicitly authorize launch:

1. Cursor reviews the package and reference implementation and posts a pre-implementation comment checkpoint on the authorized master issue.
2. Child implementation issues are created or assigned one at a time from the Program #1500 queue.
3. Each child task executes serially with exact file allowlists, stop gates, and verification commands defined in the queue tracker.
4. Optional future validators described in the reference implementation may be built in a separate authorized implementation issue.

---

## Relationship to closed PR #1552 and Issue #1544

| Artifact | Status | Role in this package |
| --- | --- | --- |
| Issue #1544 | Closed complete | Task 001 authority; predecessor satisfied for Task 002 |
| PR #1552 | Merged 2026-06-11 | Historical implementation record only — **not active work** |
| Parent #1500 | Closed complete (program) | Portfolio container; queue tracker remains authoritative for Tasks 002–005 |
| `gate-post-merge-readiness.yml` | Merged on `main` | Baseline pre-merge closeout-readiness enforcement |
| `post_merge_readiness_gate.mjs` | Merged on `main` | Trusted base-ref gate runner reused by post-merge validator exports |
| `merge-protection-surface.md` | Updated by #1552 | Documents required check `post-merge-readiness` |
| `post-merge-validation-surface.md` | Updated by #1552 | Documents trusted-code execution model and pre-merge overlap |

**What Task 001 completed**

Task 001 closed the gap where post-merge closeout metadata failures were discovered only after merge. The pre-merge gate now blocks PRs missing required body sections, allowlist evidence, forbidden placeholders, or trusted-reviewer dispositions before merge.

**What this package covers**

This package does **not** reopen, amend, or extend PR #1552. It packages the **remaining** Program #1500 governance closeout work (Tasks 002–005) and the launch-control process Cursor must follow before touching protected CI/governance surfaces.

**Predecessor rule**

No Task 002+ implementation may start until:

1. Task 001 merge and post-merge closeout are verified on `main`.
2. Bill/ChatGPT explicitly assign the next child issue.
3. Cursor completes the pre-implementation review checkpoint defined below.

---

## Launch-control-ready definition

A governance program package is **launch-control ready** when all of the following are true:

| Criterion | Evidence for this package |
| --- | --- |
| Parent program and queue position are documented | Program #1500; Tasks 002–005 serial queue in implementation queue tracker |
| Predecessor completion is recorded | Task 001 / #1544 / PR #1552 merged and closeout verified |
| Master issue structure is defined | See [Master issue structure](#master-issue-structure) |
| Child issue templates and allowlists exist | Queue tracker child issue specifications for Tasks 002–005 |
| Stop gates and authorization points are explicit | See [Bill/ChatGPT authorization gates](#billatlas-authorization-gates) and [Continuous execution stop points](#continuous-execution-stop-points) |
| Verification and rollback plans exist | See [Verification plan](#verification-plan) and [Rollback plan](#rollback-plan) |
| Cursor pre-implementation checkpoint is defined | See [Cursor pre-implementation review/comment checkpoint](#cursor-pre-implementation-reviewcomment-checkpoint) |
| Draft automation concepts are separated from implementation | Reference implementation doc marked draft/future only |
| Non-goals and risks are recorded | See [Non-goals](#non-goals) and [Risk register](#risk-register) |
| No mixed intent in the packaging PR | Issue #1755 docs-only allowlist satisfied |

**Launch-control ready ≠ executable.** Launch-control ready means Bill/ChatGPT may review the package, Cursor may comment on feasibility, and child issues may be authorized. It does **not** authorize implementation by itself.

---

## Governance program-prep workflow

```text
Phase 0 — Historical baseline (complete)
  Task 001 (#1544 / PR #1552) merged → pre-merge post-merge-readiness gate on main

Phase 1 — Package preparation (this issue #1755)
  Author launch-control package + reference implementation (docs only)
  → Bill review of package completeness

Phase 2 — Cursor pre-implementation review (required before code)
  Cursor reads package + reference + queue tracker
  → Cursor posts checkpoint comment on authorized issue
  → STOP until Bill/ChatGPT accept checkpoint

Phase 3 — Launch authorization (Bill/ChatGPT only)
  Explicit assignment on next child issue (#1545 first)
  → Optional child issue creation if not already present
  → One task → one issue → one PR

Phase 4 — Serial implementation (Tasks 002–005)
  Cursor or Codex per queue assignment
  → Exact allowlist only
  → Stop at READY FOR REVIEW per task
  → Post-merge closeout before next queue item

Phase 5 — Program closeout (Task 005 terminal)
  Docs reconciliation + deprecated workflow headers
  → Queue halt at terminal task
  → Bill/ChatGPT program sign-off
```

**Agent routing**

| Phase | Primary agent | Notes |
| --- | --- | --- |
| Package prep (#1755) | Cursor Cloud Agent | Docs only |
| Pre-implementation review | Cursor | Comment checkpoint only; no code |
| Tasks 002–004 | Codex per queue default | Protected CI surfaces; trusted review expected |
| Task 005 | Either per queue | Docs reconciliation after behavior stable |

---

## Master issue structure

### Program container

| Field | Value |
| --- | --- |
| Program | `#1500` — CI Post-Merge Closeout Reliability |
| Program status | Closed complete (portfolio); implementation queue remains active for Tasks 002–005 |
| Queue authority | `docs/ops/trackers/PROGRAM-1500-CLOSEOUT-STABILIZATION-IMPLEMENTATION-QUEUE.md` |
| Serial rule | One task → one issue → one PR; no parallel Tasks 002–005 |

### Packaging issue (this deliverable)

| Field | Value |
| --- | --- |
| Issue | `#1755` — Program prep: Governance launch-control package after Program #1500 Task 001 |
| Type | Documentation packaging; not an implementation task |
| Closes after merge | Yes — one-off prep issue |
| Creates child issues | No — deferred to Bill/ChatGPT authorization |

### Required master-issue body sections (for future governance programs)

When Bill/ChatGPT authorize a new governance master issue, the body must include:

1. **Objective** — single program outcome.
2. **Background** — predecessor completion and problem statement.
3. **Parent program** — `#NNNN` link.
4. **Queue position** — Task N of M.
5. **Dependency table** — predecessor, successor, halt/resume conditions.
6. **In scope / Out of scope** — explicit boundaries.
7. **Exact file allowlist** — per-task hard boundary.
8. **Acceptance criteria** — verifiable checklist.
9. **Verification commands** — deterministic local checks.
10. **Serial execution instruction** — stop outside allowlist.
11. **Handoff notes** — evidence for successor task.

Program #1500 child issues `#1545`–`#1548` already follow this structure in the queue tracker.

---

## Child issue structure

### Active queue (post–Task 001)

| Seq | Child issue | Title summary | Predecessor | Agent | Queue status |
| --- | --- | --- | --- | --- | --- |
| 002 | `#1545` | Consolidate duplicate post-merge closeout workflows | `#1544` | Codex | Ready after Task 001 closeout |
| 003 | `#1546` | Fix failure-path label hygiene | `#1545` | Codex | Blocked |
| 004 | `#1547` | Automate remediation manifest cleanup | `#1546` | Codex | Blocked |
| 005 | `#1548` | Reconcile CI/orchestration docs and deprecated workflows | `#1544`–`#1547` | Either | Blocked |

### Required child-issue body fields

Each child issue authorized for implementation must contain:

| Section | Requirement |
| --- | --- |
| Parent program | `#1500` |
| Queue position | Task 00N of 005 |
| Dependency fields | Predecessor, successor, stage-before-merge, halt/resume |
| `lgfc-task-id` marker | `program-1500-closeout-stabilization:Task-00N` |
| Objective | One sentence |
| Background | Why this task exists; reference predecessor evidence |
| In scope | Enumerated deliverables |
| Out of scope | Explicit exclusions including successor tasks |
| Exact file allowlist | Bullet list; no globs |
| Acceptance criteria | Gate-testable outcomes |
| Verification commands | Copy-paste block |
| Risk notes | Operator or implementation risks |
| Serial execution instruction | Stop if allowlist exceeded |
| Handoff notes | Evidence for successor |

### Child issue creation policy

- Do **not** create new child issues from this package.
- Reuse existing `#1545`–`#1548` unless Bill/ChatGPT authorize replacement issues.
- One implementation PR per child issue only.
- Successor tasks remain **halted** until predecessor merge and post-merge closeout verify.

---

## Cursor pre-implementation review/comment checkpoint

Before any Cursor or Codex implementation on Tasks 002–005, Cursor must complete this checkpoint on the **authorized child issue** (not on closed #1544 or merged PR #1552).

### Required reading

1. This document (`GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md`).
2. `docs/reference/governance/governance-launch-control-reference-implementation.md`.
3. `docs/ops/trackers/PROGRAM-1500-CLOSEOUT-STABILIZATION-IMPLEMENTATION-QUEUE.md` — task-specific section only.
4. `docs/reference/ci/merge-protection-surface.md`.
5. `docs/reference/ci/post-merge-validation-surface.md`.
6. Applicable merged Task 001 files on `main` (read-only baseline).

### Required comment format

Cursor posts a single checkpoint comment on the authorized issue:

```text
## Cursor pre-implementation checkpoint

- Package read: GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md — YES/NO
- Reference implementation read: governance-launch-control-reference-implementation.md — YES/NO
- Queue task section read: Task 00N — YES/NO
- Proposed allowlist matches issue body: YES/NO
- Duplicate validation risk vs post_merge_validator.mjs: NONE / <describe>
- Protected surfaces touched: <list or none>
- Stop gates acknowledged: YES/NO
- Verification commands identified: <list>
- Blockers before implementation: NONE / <list>
- Recommendation: PROCEED / HALT — <one sentence>
```

### Checkpoint outcomes

| Outcome | Action |
| --- | --- |
| `PROCEED` + Bill/ChatGPT assignment | Implementation may start on that child issue only |
| `HALT` | Record blockers; no implementation until resolved |
| Missing checkpoint | Implementation agents must stop |

Cursor must **not** open implementation PRs during the checkpoint phase.

---

## Bill/ChatGPT authorization gates

| Gate | Owner | Trigger | Pass condition |
| --- | --- | --- | --- |
| G1 — Package merge | Bill/ChatGPT | PR for #1755 ready for review | Docs package complete; verification green |
| G2 — Launch-control acceptance | Bill/ChatGPT | After #1755 merge | Explicit comment that package is accepted for queue use |
| G3 — Task assignment | Bill/ChatGPT | Before Task 002+ implementation | Assignment comment on child issue `#1545` (or authorized successor) |
| G4 — Cursor checkpoint acceptance | Bill/ChatGPT | After Cursor checkpoint comment | Bill/ChatGPT acknowledge checkpoint; no blockers |
| G5 — Protected-surface merge | Bill/ChatGPT + trusted reviewers | PR touches `.github/workflows/**` or `scripts/ci/**` | Required gates green; reviewer dispositions complete |
| G6 — Branch protection update | Bill (operator) | After Task 001 merge if not already done | `post-merge-readiness` in required checks on `main` |
| G7 — Queue advance | Bill/ChatGPT | After each task post-merge closeout | Explicit or queue-default advance to next child |

No agent may bypass G3 or G4.

---

## Continuous execution stop points

Agents must **STOP** immediately when:

| Stop ID | Condition |
| --- | --- |
| S1 | No primary source issue or allowlist for the current task |
| S2 | Predecessor task not merged and closeout-verified |
| S3 | Cursor pre-implementation checkpoint missing or `HALT` |
| S4 | Bill/ChatGPT assignment missing on the child issue |
| S5 | Changed file outside task allowlist |
| S6 | Mixed intent in one PR |
| S7 | Attempt to modify closed #1544 or reopen PR #1552 as active work |
| S8 | Unauthorized child issue creation |
| S9 | Branch protection UI change attempted by agent |
| S10 | Implementation started from reference implementation pseudocode without authorized issue |
| S11 | Successor task started before predecessor post-merge closeout |
| S12 | Authority conflict between queue tracker and issue body — escalate to Bill/ChatGPT |

**Resume rule:** Only Bill/ChatGPT may authorize resume after S3, S4, or S12.

---

## Verification plan

### This documentation package (#1755)

| Check | Command / method | Pass criterion |
| --- | --- | --- |
| Whitespace | `git diff --check` | No conflict markers or trailing whitespace issues |
| Docs headers | `./scripts/ci/docs_check_headers.sh docs/ops/ai/GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md docs/reference/governance/governance-launch-control-reference-implementation.md` | Exit 0 |
| Docs-only diff | `git diff --name-only origin/main...HEAD` | Only allowlisted paths |
| No runtime drift | Manual inspect diff | No workflows, scripts, tests, or app files |
| ZIP safety | Repo root inspection | No ZIP in root |
| Canonical references | Path existence check | Referenced canonical paths exist on branch |

### Per-task implementation verification (Tasks 002–005)

Use verification commands in the queue tracker per task. Minimum set:

- Task 002: `npm test -- tests/post-merge-closeout-automatic.test.mjs tests/post-merge-validation-surface.test.mjs tests/orchestrator-queue.test.mjs`; `node scripts/ci/post_merge_validation_surface.mjs`
- Task 003: `npm test -- tests/orchestrator-queue.test.mjs tests/post-merge-source-issue-closeout.test.mjs`
- Task 004: `npm test -- tests/post-merge-closeout-all-manifests.test.mjs tests/batch-post-merge-closeout.test.mjs`
- Task 005: `node scripts/ci/post_merge_validation_surface.mjs`; `./scripts/ci/docs_check_headers.sh` on touched docs; `./scripts/ci/docs_canonical_hashes_verify.sh`

### Future validator verification (not in scope for #1755)

When authorized, implement tests described in `governance-launch-control-reference-implementation.md`.

---

## Rollback plan

### Documentation package rollback (#1755)

Revert the merge commit for the #1755 PR. No runtime behavior changes.

### Task-level implementation rollback (Tasks 002–005)

Follow per-task rollback rows in `PROGRAM-1500-CLOSEOUT-STABILIZATION-IMPLEMENTATION-QUEUE.md`:

| Task | Rollback action |
| --- | --- |
| 002 | Restore post-merge workflow files from predecessor commit; re-run surface validator |
| 003 | Revert `sync-pr-state.mjs` failure-path changes only |
| 004 | Revert manifest prune script/workflow; manual manifest edit if needed |
| 005 | Revert documentation-only diff |

### Task 001 rollback (historical reference only)

If pre-merge gate must be removed: revert `gate-post-merge-readiness.yml`, `post_merge_readiness_gate.mjs`, shared validator wiring, and reference docs per `post-merge-validation-surface.md` rollback section. This is **not** in scope for #1755.

---

## Non-goals

- Reopening, amending, or re-implementing PR #1552 or Task 001 deliverables.
- Implementing pseudocode from the reference implementation document.
- Creating child implementation issues without Bill/ChatGPT authorization.
- Launching Cursor or Codex on Tasks 002–005 from this documentation PR.
- Modifying branch protection, GitHub settings, or required check configuration.
- Expanding scope to Program #1255 website files, Priority #2 fundraiser program, or Priority #3 PMO governance program.
- Building new governance validators in this PR.
- Closing or relabeling `#1545`–`#1548` from this package.
- Treating merged PR #1552 as an active branch or open review surface.

---

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Agents treat PR #1552 as active work | Medium | Wrong baseline, duplicate gate work | Package states merged/closed status explicitly |
| R2 | Task 002 started before Task 001 closeout verified | Low | Serial queue violation | S2 stop point; queue halt language |
| R3 | Duplicate validation logic forked from `post_merge_validator.mjs` | Medium | Drift between pre-merge and post-merge gates | Task 002+ must import shared exports; checkpoint requires duplicate-risk review |
| R4 | Branch protection missing `post-merge-readiness` | Medium | Gate bypass on merge | G6 operator gate; document in merge-protection surface |
| R5 | Cursor skips pre-implementation checkpoint | Medium | Unreviewed protected-surface edits | S3 stop; G4 authorization |
| R6 | Mixed intent PR across queue tasks | Low | Closeout failure, remediation loop | One issue per PR; S6 stop |
| R7 | Reference implementation mistaken for shipped code | Medium | Unauthorized implementation | Reference doc marked draft/future; S10 stop |
| R8 | Post-merge closeout failure on workflow consolidation (Task 002) | Medium | High — queue blocked | High Codex risk noted in queue; trusted review at G5 |
| R9 | Manifest prune misfire (Task 004) | Low | High — data loss risk | Safe prune semantics in queue; no destructive wipe |
| R10 | Package drift from queue tracker | Low | Wrong allowlists | Canonical queue tracker reference; escalate conflicts |

---

## Closeout checklist

### Issue #1755 (this documentation package)

- [ ] Both allowlisted Markdown files exist with authority headers.
- [ ] PR body contains `- **Issue:** #1755` exactly once.
- [ ] PR body allowlist matches final diff exactly.
- [ ] Docs-only assertion and ZIP safety confirmed.
- [ ] `git diff --check` passed.
- [ ] Docs header validation passed on both files.
- [ ] Intent label `docs-only` applied.
- [ ] PR merged to `main`.
- [ ] Source issue #1755 closed after post-merge closeout (or per operator policy).

### Program #1500 queue (after package acceptance — not #1755 scope)

- [ ] Bill/ChatGPT accept launch-control package (G2).
- [ ] Operator confirms `post-merge-readiness` on branch protection (G6) if not already done.
- [ ] Cursor checkpoint completed on `#1545` before Task 002 implementation.
- [ ] Tasks 002–005 executed serially with per-task closeout.
- [ ] Task 005 terminal docs reconciliation merged.
- [ ] Bill/ChatGPT program sign-off recorded on `#1500` or successor tracking issue.

---

## Final

This package completes governance program preparation documentation after Program #1500 Task 001. Implementation remains blocked until Bill/ChatGPT authorize the next child issue and Cursor completes the pre-implementation checkpoint.
