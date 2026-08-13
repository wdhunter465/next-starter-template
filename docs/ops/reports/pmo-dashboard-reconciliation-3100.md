# PMO dashboard reconciliation — Issue #3100

## Scope

This report records WORK-owned remediation for the PMO dashboard repository identity, owner precedence, canonical build path, and completed-child accounting contract.

## Current known truth

- PR #3079 added Issue-event deployment refresh.
- PR #3101 added Issue-event canonical build coverage and concurrency control.
- The legacy core generator still contains the former repository fallback and reads `Owner / Agent` body text before `owner:*` labels.
- Live PMO authority uses current GitHub repository identity and current owner labels; generated output must not preserve stale body metadata over those labels.

## Implemented remediation

- Added `scripts/pmo-dashboard/run-dashboard-build.mjs` as the canonical workflow entry point.
- The wrapper supplies `wdhunter465/next-starter-template` when GitHub repository environment values are absent.
- The wrapper reconciles generated `ownerAgent` values from `owner:*` labels, including nested project rows.
- Updated `.github/workflows/pmo-dashboard-ci-build.yml` to use the canonical wrapper.
- Added a focused fixture and test proving:
  - local/no-environment generation identifies `wdhunter465/next-starter-template`;
  - `owner:*` labels override stale `Owner / Agent` body text;
  - a closed direct child is counted as completed;
  - generated output passes the existing dashboard validator.

## Pre-gate remediation

The initial PR run failed before code-quality execution because the PR description did not use the repository's canonical stable template and delivery-profile enums. The description was corrected to declare the source Issue, exact file allowlist, valid delivery profile, stable verification and acceptance sections, and reviewer/bot attestation. This report update retriggers the full current-head gate set against that corrected metadata.

## Boundaries

- No generated PMO status, owner, percentage, or timestamp is hand-edited.
- No PMO Issue is closed or relabeled by this PR.
- No Production merge or deployment is authorized by this report.
- The checked-in `site/pmo-dashboard/dashboard-data.json` remains generated output and must be refreshed through the canonical build/deploy chain after approved merge.

## Required post-merge verification

1. Confirm the merged `main` SHA.
2. Confirm an Issue-event or manual PMO dashboard build runs the canonical wrapper.
3. Record the workflow run ID and uploaded artifact ID.
4. Validate repository identity, representative owner fields, and completed-child counts in the artifact.
5. Reconcile #3078 with a corrective historical comment linking the unfinished work to #3100.
6. Only after successful verification, normalize #3100 labels and close it as completed.
