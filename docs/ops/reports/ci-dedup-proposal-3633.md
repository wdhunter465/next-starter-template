---
Doc Type: Report
Audience: Human + AI
Authority Level: Operational Evidence
Owns: Task #3633-006 proposal for CI and test deduplication and consolidation, with a keep, consolidate or retire verdict per candidate
Does Not Own: Any deletion or change of a check (nothing is changed by this task), gap dispositions (task #3633-007), or Product date changes
Canonical Reference: /docs/ops/implementation-plans/issue-3633-002-ordered-plan.md
Related Issues: #3633, #4464, #4463, #4465, #4444, #4407
Last Reviewed: 2026-10-07
---

# CI deduplication and consolidation proposal for #3633

## Status

`_DRAFT` — documentation only. Nothing is deleted, merged or edited by this task. Every verdict below is a proposal for the gap assessment (#4465) and for Product Authority. The parent's rule applies: no check is removed because another check has a similar name; functional duplication has to be shown first.

## Method

Each candidate pair from the inventory (`docs/ops/reports/ci-test-inventory-3633.md`) was read in full for triggers, permissions, target environment, steps and the scripts it calls. Verdicts use four words:

- **Keep separate:** the failure domain, environment or permissions differ.
- **Consolidate:** the same function runs twice; one version should serve both.
- **Retire candidate:** a one-off or superseded check; an owner confirms before any removal.
- **Fix, not merge:** the overlap is a defect to correct in place.

## Verdicts

| Candidate | What the files show | Verdict |
| --- | --- | --- |
| `diataxis-folder-authority.yml` and `diataxis-folder-authority-check.yml` | Both run `diataxis_folder_audit.mjs` and write the same advisory comment (marker `diataxis-folder-advisory`). The first also runs the migration ratchet and covers all of `docs/` plus `Agent.md`. The second covers only the four DIATAXIS folders. The narrower trigger is a subset of the wider one. | **Consolidate** into the broader workflow. Both writing one comment is why the advisory is edited twice per run. Separately, the audit flags `docs/governance/**` files as outside the folders although governance and ops are approved folders (see the migration map); that is a classification defect to fix in `diataxis_folder_audit.mjs`, not a reason to keep two workflows. |
| `d1-migrations.yml` and `lgfc-d1-migrate.yml` | `d1-migrations` applies the migration set to Production and Development on push to `migrations/**`, after a fail-closed identity check. `lgfc-d1-migrate` is manual only, executes one SQL file chosen by the operator against Production with no identity check and no environment approval, and its default input and verification step are for migration `0041` only. | **Retire candidate, and a risk.** Different function from the first, so not a duplicate. It is a legacy one-off with an unguarded Production write path. Owner (Operations) confirms it is unused, then it is removed or given the identity check. |
| `library-books-search-eligibility-3455.yml` and `-3456.yml` | Same operation, Development (`#3455`) and Production (`#3456`). The workflow files differ only in target and the Production recovery citation; the two scripts share a structure but are separate files (453 and 357 lines). | **Keep separate** while either is still needed: different environment and permissions. Both are one-time data operations. **Retire candidate** once the Issues' work is recorded complete. |
| `preview-invariants.yml` and `production-audit.yml` | Same Playwright suite and setup. Preview targets the deployed Pages preview and is manual only. Production audit targets Production on a schedule and on push. | **Keep separate** (different target and cadence). **Consolidate the setup** into one reusable workflow taking a base URL, so the install, browser setup and report upload cannot drift. Not a gap fix: the preview run is not a required PR check today; that is for #4465. |
| `post-merge-closeout.yml`, `post-merge-intent-verification.yml`, `post-merge-pr-body-closeout.yml` | Three different triggers and jobs: detection on PR close, intent verification on PR close and push, and manifest-driven body closeout on a pushed list of targets. They share the closeout domain but not one function. | **Keep separate for now.** Consolidation here is a larger redesign (the closeout pipeline is the subject of #4445), not a safe merge. Record in #4465. |
| `bridge-optional-closeout.yml`, `bridge-1314-verification-closeout.yml` | Both are one-shot closeouts (the first closes superseded issue #1288; the second records verification for #1314). Each re-runs only when its own file or the bridge workflow changes. | **Retire candidates.** One-offs whose purpose was a single Issue closeout. Owner (Engineering) confirms the Issues are closed, then both are removed. |
| `ai-execution-bridge.yml` and `ai-execution-bridge-smoke.yml` | The first executes on issue events. The second is a weekly and push-triggered smoke test of the same scripts. | **Keep separate** (executor and its test). |
| `ops-chatterbox-reconciliation-sweep.yml` and `chatterbox-dev-integration-check.yml` | The sweep runs every 30 minutes against Development. The check is a push-triggered end-to-end proof. | **Keep separate.** Noted for cost: a 30-minute schedule runs about 48 times a day; #4465 decides whether the cadence is needed. |
| `lgfc-cursor-runner-health.yml` and `repository-runner-health.yml` | The first runs on a GitHub-hosted runner, by design so that a dead self-hosted machine cannot hide its own alarm. The second runs on the self-hosted runner. | **Keep separate.** Different failure domains; this separation is the point of the first workflow. |

## Other findings that belong in the same review

1. **26 tests run nowhere.** The 22 `post-merge-*` and 4 `reviewer-*` test files are excluded by the test config and no workflow runs them; 4 tests in them fail on unmodified `main`. This is not duplication but an uncovered area; it goes to #4465 as a hardening row, and the four failures need an owner.
2. **14 scripts under `scripts/ci/` have no reference outside their own tests** (listed in the inventory). Treat as **retire candidates only after** an owner confirms no manual use.
3. **`scripts/ci/post-merge-closeout/` holds 198 files**, mostly archived pull request body files and one-time target manifests. They look like historical artifacts and are the reason `post-merge-pr-body-closeout` has a long path list. A separate cleanup proposal; not changed here.
4. **Shared helpers to consider:** a reusable Playwright setup (above) and one reusable "Node plus install plus delivery-profile" prelude for the D1 backup family (five workflows repeat the same setup).

## Not proposed

- No removal of any required check (`quality`, `gitleaks`, `reviewer-response-completion`) or of any scheduled monitor.
- No merge of failure domains into one large workflow.
- No change to the post-merge pipeline design (#4445).

## Decisions needed

- Operations: confirm `lgfc-d1-migrate.yml` is unused, then remove it or add the identity check.
- Engineering: confirm the two bridge closeouts and the 14 unreferenced scripts can go.
- Governance: confirm the DIATAXIS audit should not flag approved governance and ops folders.

## Rollback

One documentation file. Rollback is reverting the merge commit.
