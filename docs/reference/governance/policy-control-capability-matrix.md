---
Doc Type: Reference
Audience: AI agents, maintainers, reviewers, orchestration operators
Authority Level: Reference
Owns: The policy-control capability matrix — which material governance controls exist, their canonical domain owner, and their real (not assumed) capability state
Does Not Own: The underlying policy text itself (owned by each domain's `docs/governance/*.md`), workflow implementation detail, or Production/credential/environment authority
Canonical Reference: docs/reference/governance/policy-control-capability-matrix.md
Related Issues: #2817, #2821
Last Reviewed: 2026-09-17
---

# Policy-Control Capability Matrix

## Purpose

Documented governance intent and live enforcement can diverge — labels, dashboards, validators, and automation are each separately implemented (`docs/governance/WORK-QUEUES-AND-COLLABORATION.md`). This matrix records, per material control, whether it is only **Defined** (written policy, no automation), **Implemented** (automation exists), **Enforced** (blocks merge/action on failure), **Monitored** (runs on a schedule with visible output), **Verified** (independently confirmed against live state, not just code review), or a **Transitional Exception** (a known, time-bounded gap with an accountable owner).

This is not an exhaustive claim of every possible control in the repository. Entries exist only where real evidence was checked — a control not listed here is not thereby claimed compliant; it is simply not yet inventoried. Add rows as controls are verified, not as they are assumed.

## How to read a row

- **State** is the actual, checked state as of **Last verified**, not the intended state.
- **Evidence** is a real repository path (script, workflow, or test) or a specific, dated observation (e.g., a live PR comment). A state of Enforced or Verified without a concrete evidence path is itself a defect in this table.
- **Owner** is the domain doc from `docs/governance/REPOSITORY-AUTHORITY.md`'s domain table, not a person.

## Matrix

| Control | Domain owner | State | Evidence | Last verified |
| --- | --- | --- | --- | --- |
| Quality gate (typecheck/lint/test/build per delivery profile) | CI and Verification | Enforced | `.github/workflows/gate-quality.yml`, `scripts/ci/delivery_profile.mjs`, `scripts/ci/pr_class_quality_plan.mjs` | 2026-09-17 |
| Gitleaks secret scan | CI and Verification | Enforced | `.github/workflows/gitleaks.yml` | 2026-09-17 |
| Reviewer lifecycle gate | CI and Verification | Enforced | `scripts/ci/reviewer_lifecycle_gate.mjs` | 2026-09-17 |
| PR hygiene (hard codes fail closed; soft codes advisory) | CI and Verification | Enforced (hard codes only) | `.github/workflows/gate-pr-hygiene.yml` | 2026-09-17 |
| Diff scope gate | CI and Verification | Transitional Exception — advisory only, not merge-blocking | Live PR bot comment: "advisory and non-blocking during the #2175 / #2208 PR-process rebuild" | 2026-09-17 |
| DIATAXIS folder hygiene | Documentation and Knowledge | Transitional Exception — advisory only, not merge-blocking | Live PR bot comment: "non-blocking during PR Hygiene Foundation rollout" | 2026-09-17 |
| Docs header field completeness | Documentation and Knowledge | Defined, not fully Enforced | `scripts/ci/docs_check_headers.sh` — 3 live failures found on `main` (`docs/ops/implementation-plans/issue-1075-ci-phase2-closeout-rollout.md`, `docs/ops/implementation-plans/issue-1075-ci-redesign-rollout.md`, `docs/ops/reports/pmo-dashboard-reconciliation-3100.md`); not confirmed wired as a required blocking check | 2026-09-17 |
| Docs canonical-hash drift detection | Documentation and Knowledge | Defined, not fully Enforced | `scripts/ci/docs_canonical_hashes_verify.sh` — live drift found under `docs/reference/design/**` on `main`, predating this matrix | 2026-09-17 |
| Model A/B/C delivery classification | Delivery and Release | Enforced | `scripts/ci/delivery_profile.mjs` | 2026-09-17 |
| Model A Development/Candidate state distinction | Delivery and Release | Enforced | `scripts/ci/delivery_profile.mjs` (`development` gate profile, #2822, merged) | 2026-09-17 |
| Agent bootstrap authority chain | Agent Team | Enforced | `.agents/checks/agent-governance-check.mjs`, `tests/agent-governance-bootstrap.test.mjs` | 2026-09-17 |
| Legacy `governance/ai` / `ops/ai` authority retirement | Agent Team | Enforced | `.agents/checks/agent-governance-check.mjs` (#2823, merged) | 2026-09-17 |
| Governance normative-duplication drift | multiple (per-signature owner) | Enforced | `.agents/checks/governance-duplication-check.mjs`, `tests/governance-duplication-check.test.mjs` (#2820) | 2026-09-17 |
| Admin route anonymous/member/admin auth matrix | Platform and Environment | Verified | `tests/admin-auth-matrix.test.ts` (#3633, merged) — direct matrix test plus structural coverage of all 61 `/api/admin/**` route files | 2026-09-17 |
| D1 backup export/restore | Operations and Recovery | Implemented, partially Verified | `.github/workflows/ops-d1-backup-*` (#3268) — one completed, checksummed export/restore drill on record; recurring scheduled cadence exists but ongoing execution history not independently confirmed here | 2026-09-17 |
| PR-body "stable facts only" rule | PR Process / multiple | Documented but contradicted by live enforcement | `docs/governance/PR_PROCESS.md` states the PR body must not become a dynamic lifecycle ledger; `scripts/ci/run_pr_body_auto_repair.mjs` / `scripts/ci/reviewer_preparer_handback.mjs` require exactly that. Flagged on #2822; not yet resolved. | 2026-09-17 |

## Transitional exceptions detail

Per acceptance criteria, each exception below states scope, risk, expiry/review condition, and accountable authority.

### Diff scope gate (advisory only)

- **Scope:** file-allowlist drift detection on every PR.
- **Risk:** a PR could touch files outside its declared scope without being blocked; currently caught only by human/bot review, not enforcement.
- **Expiry/review condition:** tied to the #2175 / #2208 PR-process rebuild; review when that rebuild lands.
- **Accountable authority:** PMO / Engineering (owner of the PR-process rebuild).

### DIATAXIS folder hygiene (advisory only)

- **Scope:** flags governance/constitutional-tier docs (e.g., `docs/governance/**`, `Agent.md`) as outside the four DIATAXIS knowledge folders.
- **Risk:** low — this reflects an intentional architectural tier above DIATAXIS (Constitutional/Domain Policy), not a real misplacement, but the advisory doesn't yet encode that distinction.
- **Expiry/review condition:** tied to "PR Hygiene Foundation rollout"; review when that rollout completes, and consider updating the advisory's own logic to recognize the Constitutional/Domain-Policy tier as an approved non-DIATAXIS class (it already recognizes `docs/ops/**` as one).
- **Accountable authority:** Documentation and Knowledge domain owner.

## Automated validation

`.agents/checks/policy_control_matrix_check.mjs` (wired via `tests/policy-control-matrix-check.test.mjs`) parses this file's table and fails if:

- an `Enforced` or `Verified` row's Evidence column does not name a path that exists in the repository;
- a required column is empty;
- the table is malformed (missing header, wrong column count).

This is a structural non-hallucination check — it confirms cited evidence paths are real, not that the underlying control still behaves as described. Deeper semantic verification remains a human/reviewer responsibility on each update.

## Ownership

Updating this matrix is owned by whichever role/PR touches a control's implementation — the matrix update rides the same PR that changes the control, the same pattern already used for `docs/reference/ci/delivery-profile-contract.md` alongside `scripts/ci/delivery_profile.mjs`. There is no separate reconciliation process; a stale row is a defect to fix in the next PR that discovers it, not a recurring audit obligation.

## Non-goals

- This is not a live dashboard. `scripts/pmo-dashboard/**` already exists for GitHub-issue-driven PMO reporting; integrating this matrix's data into it is a reasonable future follow-on but is not built here, to avoid a second competing reporting surface.
- This is not an exhaustive inventory of every possible governance control. It grows by evidence, not by target count.
