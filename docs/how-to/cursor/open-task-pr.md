---
Doc Type: How-To
Audience: AI
Authority Level: Operational Authority
Owns: Cursor procedure for opening a task PR after review approval
Does Not Own: Merge authority or GitHub issue closeout
Canonical Reference: /docs/how-to/cursor/prepare-review-packet.md
Related Issues: #1449, #1351
Last Reviewed: 2026-06-11
---

# Open a Task PR

## Preconditions

- A live, open same-repository governing source Issue already exists and **predates** the
  branch and any commits (issue-first hard gate; see #3117 and `docs/ops/ai/CORE-RULES.md`).
  The only allowed action without a governing Issue is creating that Issue.
- ChatGPT or Bill approved PR creation, or Bill/ChatGPT provided an explicit PR-opening
  instruction or approved PR template.
- Local diff matches the reviewed packet (when a packet was required).
- Changed files are inside the source issue allowlist.
- Validation results are ready for PR body disclosure.
- Cursor will not merge, close issues, or mutate issue state when opening the PR.

## Steps

1. Confirm the source issue number and file-touch allowlist match the local diff.
2. Prepare the PR body from `/.github/pull_request_template.md`.
3. Include all mandatory governance fields listed under **PR Body Requirements**.
4. Allow the intent labeler to apply the repo-canonical intent for the changed
   paths (for example `docs-only` when all files are under `docs/**`).
5. Open the PR unassigned when authorized; do not merge.
6. Report PR number, branch, head SHA, changed files, validation, and disclosures.

## PR Body Requirements

The PR body must explicitly include:

- **Source issue line** — for example `- **Issue:** #NNNN`
- **Documentation source classification** — one of:
  - `DIATAXIS_FULL`
  - `DIATAXIS_ROUTED`
  - `LEGACY_FALLBACK`
- **Design source of truth** — canonical document path(s) used for the change
- **File-touch allowlist** — exact paths expected in the diff
- **Intent label** — the single intent label matching changed paths; for docs-only
  PRs under `docs/**`, use `docs-only` (do not force `change-ops` for PMO semantics)
- **Change summary** — what changed and why
- **Build/test/verification** — commands run and results
- **Documentation updates** — which docs changed and any tracker updates
- **Acceptance criteria** — checklist mapped to the source issue
- **Required pre-review self-check** — confirm allowlist, headers, and gates
- **Scope disclosures** — docs-only, no workflow/runtime changes, known out-of-scope
  validation failures, etc.
- **Post-merge issue disposition** — when applicable: comment-only, close after
  merge, or defer to ChatGPT; state that GitHub issue closeout occurs after merge
  unless specifically authorized
- **Queue / dependency-map status** (launched-program queue tasks) —
  dependency-map result (`pass` / `fail` / `not-applicable`), next queue item
  (issue number and title, `halt — <reason>`, or `not-applicable`), and
  continue/halt decision (`continue` / `halt` / `not-applicable`); use
  `not-applicable` for all three fields on one-off tasks or programs without an
  approved dependency map
- **Post-merge readiness contract** — before marking a PR ready for review, make
  sure the body contains the required post-merge closeout sections, exact
  file-touch allowlist, no `TODO`/`TBD`/`placeholder` tokens, and explicit
  trusted-reviewer dispositions in the `review-comment:<id>` format when the
  reviewer-response surface requires them

Keep exactly one primary source issue in the PR body before merge. A wrong primary
issue number is still a pre-merge defect to correct when noticed; post-merge
closeout may deterministically repair that clerical mismatch only when exactly one
issue clearly owns the delivered scope.

## Validation

Before opening the PR, run the validation commands named in the source issue. When
repo-wide checks fail only on known pre-existing out-of-scope files, disclose that
in the PR body without fixing unrelated paths. After the PR opens, the
`post-merge-readiness` job is expected to block merge until the PR body, changed
files, and trusted-reviewer disposition evidence satisfy the post-merge closeout
contract.

## Stop Conditions

Stop and report instead of opening a PR when:

- no primary source issue exists or more than one source issue is claimed;
- changed files fall outside the allowlist;
- mandatory governance fields cannot be completed honestly;
- validation fails on a touched file;
- issue closure or relabeling is required before merge;
- ChatGPT has not reviewed the packet and Bill/ChatGPT has not authorized direct PR
  creation.

## After Opening

Report:

```text
PR number:
Branch:
Head SHA:
Changed files:
Validation:
Known disclosures:
Intent label:
```
