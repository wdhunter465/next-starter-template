---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Operator procedure for OPS — Post-Merge Self-Healing workflow dispatch, artifact review, and Cursor escalation handling
Does Not Own: Classifier contract, detector implementation, auto-fix execution code, escalation script implementation, merge approval
Canonical Reference: /docs/reference/ci/post-merge-self-healing-classification-contract.md
Related issues: #1847, #1853, #1906, #1914, #1921, #1963, #2308
Last Reviewed: 2026-10-26
---

# Post-Merge Self-Healing Operator Runbook

## Purpose

This runbook explains how operators and Cursor agents use the bounded
`OPS — Post-Merge Self-Healing` workflow to detect post-merge hygiene drift,
classify findings, plan or apply safe repo repairs, and escalate unsafe findings
to scoped remediation issues.

Self-healing CI is a post-merge hygiene and escalation layer. It does not replace
PR governance, reviewer-response accounting, source-issue accounting, or
Product Authority merge authorization.

## What the workflow does

The workflow orchestrates three repository scripts in order:

1. **Backlog / issue-event scan** —
   `scripts/ci/post_merge_self_heal_backlog.mjs`
2. **Detect** — `scripts/ci/post_merge_self_heal_detect.mjs`
3. **Apply** — `scripts/ci/post_merge_self_heal_apply.mjs`
4. **Escalate** — `scripts/ci/post_merge_self_heal_escalate.mjs`

Detection consumes closeout manifests, closeout reports, and optional issue
metadata fixtures. The classifier maps each finding to exactly one outcome:

- `safe_auto_fix`
- `cursor_remediation_required`
- `operator_authorization_required`
- `intentionally_deferred`
- `no_action`

## What the workflow never does

The workflow and its scripts must not:

- bypass PR governance or mark a PR ready for merge;
- merge PRs or push directly to `main` except for explicitly authorized manifest hygiene when `apply_safe_fixes=true`;
- edit runtime application code;
- fabricate reviewer dispositions or PR-body reviewer accounting;
- close, reopen, relabel, or advance issues outside the deterministic #1914
  safe-close rules and explicit repository authority;
- mutate secrets, production configuration, or active program-lane queue state;
- open duplicate escalation storms when deduplication keys match an existing open issue.

Cursor may continue remediation only inside the authorized source issue and PR
file-touch allowlist recorded in a generated escalation issue.

## Procedure

### Manual dispatch (recommended first step)

1. Open GitHub Actions → `OPS — Post-Merge Self-Healing`.
2. Choose **Run workflow**.
3. Leave `dry_run=true` unless Product Authority has authorized live repairs.
4. Set `apply_safe_fixes=false` for inspection-only runs.
5. Set `open_escalation_issues=false` until safe-fix output has been reviewed.
6. Run the workflow and download the `post-merge-self-healing-report` artifact.

Default manual dispatch is dry-run. The daily `schedule`, matching `issues`
events, and post-closeout `workflow_run` triggers apply bounded safe fixes
automatically. `Post-Merge Remediation` also runs self-healing before opening
exception issues.

### Trigger modes (do not conflate)

| Trigger | Purpose |
|---|---|
| Manual `workflow_dispatch` | Operator inspection; defaults to dry-run |
| Daily `schedule` | Repository-wide backlog burn-down and safe auto-fix apply |
| `issues` events | Classify one matching post-merge exception issue and apply bounded safe closes |
| `workflow_run` after **Post-Merge Detection** | Per-merge post-closeout self-healing using the uploaded `post-merge-validation-result` artifact |
| `workflow_run` after manual/batch closeout workflows | Backlog burn-down and manifest hygiene after operator replay |
| `push` to self-healing scripts on `main` | Regression guard; dry-run only |

Normal PR merges invoke self-healing automatically after the real post-merge
closeout cycle completes. Operators do not need manual dispatch for per-merge
residue when Post-Merge Detection finishes.

### Interpret artifacts

The workflow uploads three JSON files:

| Artifact file | Meaning |
|---|---|
| `post-merge-self-heal-backlog.json` | Backlog or issue-event classifications, issue-disposition actions, and before/after open exception counts |
| `post-merge-self-heal-detection.json` | Raw classified findings and summary counts |
| `post-merge-self-heal-apply.json` | Planned or applied safe auto-fix actions |
| `post-merge-self-heal-escalation.json` | Planned or executed escalation issue actions |

Review detection status first:

- `success` with only `no_action` findings → clean state; no mutation expected.
- `findings` → inspect each finding classification before enabling apply/escalate.
- `partial_failure` → report ingestion failed; fix missing report paths before retrying.

Apply artifact fields to inspect:

- `dry_run=true` → manifest changes are planned only.
- Backlog duplicate and stale-issue entries close only when the backlog scanner
  has deterministic safe-close evidence and the run is not dry-run.
- `applied` manifest prunes indicate repo files changed on the runner checkout only; commit via authorized PR if not auto-committed by workflow policy.

Every run reports:

- total open post-merge exceptions;
- skipped already escalated (`ops-pr-escalation`);
- total scanned;
- auto-closed;
- ops-pr-escalation labeled or planned;
- manifest fixes applied or planned;
- duplicate closures;
- preserved active-source issues;
- preserved ambiguous issues;
- unsafe/escalated issues;
- before and after open post-merge issue counts.

### Enable safe auto-fixes

Use live manifest repair only when:

- findings are classified `safe_auto_fix`;
- evidence is complete in the detection artifact;
- no operator-authorization finding is present for the same PR/source pair;
- Product Authority has authorized bounded repo-hygiene repair.

Dispatch with:

- `dry_run=false`
- `apply_safe_fixes=true`
- `open_escalation_issues=false`

Re-run in dry-run mode afterward to confirm the stale manifest finding cleared.

### Issue-created self-healing

The workflow also runs on `issues` events (`opened`, `reopened`, `edited`, and
`labeled`) when the issue matches post-merge exception evidence:

- title starts with `Post-merge closeout exception`;
- body contains the post-merge exception signature;
- labels include `post-merge-failure` or `post-merge-self-healing`;
- the issue does **not** already include `ops-pr-escalation`.

For matching issue events, the workflow classifies only that issue and applies
deterministic safe-close actions immediately. When CI cannot auto-close, it adds
a disposition comment and the `ops-pr-escalation` label on the **same** issue.
Any issues with the `ops-pr-escalation` label are excluded from repeat daily scans.

### Ops PR escalation queue (`ops-pr-escalation`)

When backlog classification cannot auto-close an exception issue, CI:

1. Posts one disposition comment (`<!-- post-merge-self-healing-backlog-disposition -->`).
2. Adds the `ops-pr-escalation` label.
3. Skips that issue on future backlog scans until an operator removes the label.

Ops research queue:

`is:issue is:open label:post-merge-failure label:ops-pr-escalation`

After remediation merges and closeout passes, either CI auto-closes the
exception on a later scan (if label was removed) or Ops closes it manually.

Initial historical backlog burn-down:

1. Dry-run manual dispatch → review `auto_close_planned` vs `ops_pr_escalation_planned`.
2. Apply manual dispatch → auto-close safe bucket; label the rest `ops-pr-escalation`.
3. Work the `ops-pr-escalation` queue via bounded remediation PRs.

### Enable escalation issues (manual dispatch only; not default)

Use separate escalation issue creation only when an operator explicitly accepts
additional issue noise:

Use escalation issue creation when:

- findings are classified `cursor_remediation_required` or
  `operator_authorization_required`;
- deduplication review shows no existing open canonical issue;
- the operator accepts potential issue creation load.

Dispatch with:

- `dry_run=false`
- `open_escalation_issues=true`

Escalation issues include:

- parent self-healing run context;
- failing PR and source issue numbers when known;
- failure class and evidence excerpt;
- Cursor constraints and acceptance criteria;
- whether Product Authority authorization is required.

If an open issue already matches PR + source issue + failure class, the
escalation script updates the issue body and adds a comment instead of opening
a duplicate.

### Cursor response to generated issues

When Cursor receives a generated self-healing escalation issue:

1. Read the linked detection and escalation artifacts from the workflow run.
2. Confirm the source issue and file-touch allowlist before editing.
3. Implement only the bounded remediation described in the issue body.
4. Record verification commands and gate evidence in the remediation PR body.
5. Do not close the escalation issue until post-merge self-healing dry-run reports
   no remaining finding for the same dedupe key.

Operator-authorization findings require Product Authority approval before Cursor
implements any issue or queue mutation.

### Remediate missing reviewer-disposition closeout failures

This failure means merged code may be valid, but governance closeout is blocked.
Post-Merge Detection opens a remediation issue (for example
`Post-merge closeout exception for PR #NNNN / source #MMMM /
undispositioned_reviewer_comment`) when trusted reviewer comments or outdated
review threads lack required PR-body dispositions. The repair is PR-body reviewer
accounting, not runtime code.

Procedure:

1. Inspect the remediation issue and the linked merged PR.
2. Read the listed comment IDs and failure codes in the issue body or
   `post-merge-validation-result` artifact.
3. Preserve the existing merged PR body; add or update a
   `## REVIEWER RESPONSE ACCOUNTING` section with explicit disposition lines for
   every required ID:

   ```text
   - review-comment:1234567890 — accepted — Cubic P1 finding was addressed by commit <sha> before merge; thread state: outdated
   ```

4. Use accepted disposition verbs only: `accepted`, `rejected`, `acknowledged`,
   `not applicable` / `not-applicable` / `n/a`.
5. For outdated review threads, include `thread state: outdated` in the
   disposition line.
6. Use `follow-up-issue:#<number>` only when a bounded follow-up issue was
   intentionally created and is linked in repository evidence.
7. Do not fabricate reviewer intent; record only dispositions supported by PR
   commits, resolved threads, or other repository evidence.
8. Update the merged PR body (`gh pr edit <number> --body-file …` or REST PATCH
   if `gh pr edit` fails).
9. Rerun the failed Post-Merge Detection workflow run linked from the remediation
   issue, or use the documented closeout replay path in
   `post-merge-pr-body-closeout.yml` when applicable.
10. Verify after rerun:

    - source issue remains closed with terminal `status:complete`;
    - stale labels such as `status:failed` and `status:post-merge-verify` are
      removed;
    - remediation issue is closed or has explicit resolved evidence;
    - parent program remains active unless separately complete;
    - queue advancement resumes only after clean closeout passes.

Example from #2306 / #2308 remediation:

```text
- review-comment:4637562625 — accepted — Cubic review submission was reviewed; all actionable findings were addressed by follow-up commits 6e00b831 and 024585719 before merge.
- review-comment:3530200178 — accepted — outdated Cubic thread was reviewed and addressed before merge; thread state: outdated
```

Self-healing cannot fabricate these dispositions. A docs-only PR that documents
this procedure does not by itself clear the remediation issue; the merged PR
body must carry the dispositions and closeout must rerun successfully.

## Manual single-PR Post-Merge PR Body Closeout (#2247)

Operators replaying closeout for one merged PR supply only the PR number (and
optional body-apply controls). The workflow resolves evidence from that PR's
`merge_commit_sha`.

| Operator input | Workflow behavior |
| --- | --- |
| `pr_number` | Required for single-PR mode |
| `skip_body_apply` | `true` re-validates and syncs without patching the PR body |
| `run_batch` / `run_all_pending` | Keep `false` for single-PR replay |

Rules:

1. The target PR must already be merged.
2. The target PR base must be `main` for this production closeout path.
3. Closeout evidence SHA is always the target PR `merge_commit_sha`.
4. The workflow checkout SHA / current `main` tip is never used as merged-PR evidence during manual replay (regression: PR #2542 vs later tip from PR #2543 / #2556).
5. Automatic `pull_request_target` closeout remains unchanged and continues to pass `merge_commit_sha` explicitly.

Example after a tooling repair lands on `main`:

```bash
gh workflow run "Post-Merge PR Body Closeout" \
  -f pr_number=2542 \
  -f skip_body_apply=true \
  -f run_batch=false \
  -f run_all_pending=false
```

Confirm the result records the target PR merge SHA (for #2542:
`a184c76bf1f8d821c77621ed1a91512f292eddca`), not the current `main` tip.

## Post-Merge PR Body Closeout batch workflow (Program #1963)

Program **#1963** hardened `Post-Merge PR Body Closeout`
(`.github/workflows/post-merge-pr-body-closeout.yml`) for operator replay,
push-triggered backfill, and manifest hygiene. Self-healing still runs after
closeout artifacts land; this section documents the closeout batch layer only.

### Path-scoped manifest replay on push

Push triggers are limited to `scripts/ci/post-merge-closeout/targets-active.json`
and active manifest paths listed in the workflow `paths` filter.

| Push change | Replay behavior |
|---|---|
| `targets-active.json` only | Full active manifest set from registry |
| One or more listed manifest files | Only manifests whose paths changed (`resolve_closeout_manifests_from_push.mjs`) |
| Registry plus manifest files | Full active set (registry change wins) |

Completed Program #1923 wave manifests remain in-repo for manual
`workflow_dispatch` but are excluded from automatic push replay.

### Active manifest registry

Automatic replay reads `scripts/ci/post-merge-closeout/targets-active.json`
through `run_post_merge_closeout_all_manifests.mjs`. Archived wave manifests
are documented in
`docs/ops/trackers/PROGRAM-POST-MERGE-CLOSEOUT-AUTOMATION-IMPLEMENTATION-QUEUE.md`.

### Rate-limit rerun queue

When batch closeout hits GitHub App installation rate limits, targets are
appended to `scripts/ci/post-merge-closeout/targets-ci-pending-rerun.json`.
The aggregate job persists the queue and may commit manifest updates with
`[skip ci]`. Resumable `partial_failure` (rate-limit only, rerun persisted)
exits workflow success so the next push or dispatch continues the tail.

### Per-target manifest prune on partial_failure

`prune_closeout_manifest.mjs` removes only targets that **passed** closeout.
Failed or queued targets remain on the manifest for rerun. Operators should
inspect `manifestPrune` in `post-merge-batch-closeout.json` after
`partial_failure` runs.

### Matrix sharding and aggregate partial_failure

Push and `run_all_pending` dispatch use matrix mode:

1. `resolve` — path-scoped or full active manifest list
2. `closeout-shard` — one manifest per shard (`fail-fast: false`)
3. `aggregate-closeout` — merge shard reports, persist rerun queue, upload batch artifact

Manual `workflow_dispatch` with `run_batch` or single-PR inputs uses `closeout-legacy`
(`mode != matrix`) instead of the shard/aggregate path.

Aggregate status uses report-level `partial_failure` and
`resolveCloseoutWorkflowExitCode` so rate-limit tails do not require manual
workflow failure when the rerun queue is durable.

### Backlog metrics and failure taxonomy

After aggregate or single-manifest batch closeout, the workflow runs
`scripts/ci/emit_closeout_backlog_metrics.mjs`. It writes GitHub Actions step
summary with authoritative open/closed `ops-pr-escalation` counts (GraphQL
`totalCount`) and rolls up `summary.by_code` from
`post-merge-batch-closeout.json`.

Use step summary counts instead of paginated `gh issue list` when auditing
ops escalation backlog size.

### Operator inspection checklist

1. Download `post-merge-batch-closeout-report` when batch closeout runs.
2. Read `status`, `summary.by_code`, and per-target `results`.
3. Confirm `targets-ci-pending-rerun.json` only changed when rate limits queued reruns.
4. Read workflow step summary for GraphQL `ops-pr-escalation` counts.
5. Re-dispatch `run_all_pending` or wait for the next push if `partial_failure`
   is resumable and targets remain queued.

Remediation PRs that fix closeout accounting must still carry full PR-body
reviewer dispositions (`review-comment:<id>`) or closeout will open nested
exception issues.

## Dry-run mode

Dry-run is the default for:

- manual dispatch unless explicitly disabled;
- `push` triggers on `main` that touch self-healing scripts.

Authorized apply mode runs for:

- daily `schedule` (repository-wide backlog burn-down and safe auto-fix);
- post-closeout `workflow_run` triggers;
- matching post-merge `issues` events.

`Post-Merge Remediation` also runs backlog scan + detect/apply before opening or
updating remediation issues so deterministic repairs happen before new exception
noise is created.

Post-closeout `workflow_run` triggers keep escalation issue creation disabled by
default. When Post-Merge Detection uploads `post-merge-result.json`, self-healing
detect ingests that artifact to repair deterministic terminal-label residue or
route ambiguous merge-SHA / label integrity failures into remediation without
opening duplicate issues when `self_healing_safe` is recorded.

Dry-run guarantees:

- no manifest files are written;
- no GitHub issues are created or updated;
- artifacts still record the actions that would have been taken.

Use dry-run to validate clean repo state before enabling live repairs.

## Deduplication behavior

Escalation dedupe keys use:

- failing PR number;
- source issue number;
- failure class / finding code.

Duplicate remediation issue handling in the apply layer remains dry-run for
manifest-action planning. Live duplicate exception closure is handled by the
backlog scanner when a newer canonical post-merge issue or explicit canonical
evidence makes the duplicate deterministic.

## Product Authority authorization required

Stop and request operator authorization when classification is
`operator_authorization_required` or when findings involve:

- auth, secrets, or configuration failures;
- active alternate program lane decisions;
- source issue linkage or queue advancement;
- runtime app-code repair;
- ambiguous or conflicting repository evidence.

## Related references

- Architecture: `docs/explanation/ci/post-merge-self-healing-architecture.md`
- Classification contract: `docs/reference/ci/post-merge-self-healing-classification-contract.md`
- Post-merge validation surface: `docs/reference/ci/post-merge-validation-surface.md`
- Workflow file: `.github/workflows/ops-post-merge-self-healing.yml`
- Remediation workflow: `.github/workflows/post-merge-remediation.yml`

## Execution

Operators should keep manual dispatch in dry-run until a clean-state run produces
green no-op artifacts and any safe-fix plans have been reviewed. Only then enable
`apply_safe_fixes` and/or `open_escalation_issues` in separate authorized runs.
