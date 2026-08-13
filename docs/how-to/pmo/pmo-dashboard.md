---
Doc Type: How-To
Audience: PMO operators and AI agents
Authority Level: Operational Guidance
Owns: PMO dashboard generation, refresh, validation procedure, operator remediation flow, and GitHub Pages limitations
Does Not Own: PMO lifecycle definitions, queue and priority policy, PMO issue contract, dashboard JSON specification, GitHub Issues source records, or Cloudflare production deployment
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-DASHBOARD-SPECIFICATION.md
Related Issues: #2101, #2299, #2313, #2471, #2516, #2610, #2611, #2699, #2702, #3116, #3136
Last Reviewed: 2026-08-07
---

# PMO Dashboard

## Purpose

The PMO dashboard is a generated static GitHub Pages reporting surface for PMO-managed program and project work. GitHub Issues remain the sole operational authority for PMO tracking, lifecycle, team ownership, priority, Pipeline stage, task relationships, and closeout state.

The dashboard normalizes public-safe Issue data into Active, Pipeline, Completed, and Incomplete views. Generated JSON is reporting-only and must not override live Issue metadata.

Queue, priority, Project Graduation, and collaboration semantics are owned by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`. The JSON and view contract is owned by `docs/ops/pmo/PMO-JULY-2026-DASHBOARD-SPECIFICATION.md`.

This operator guidance was reconciled directly by ChatGPT under #2699 from the PMO meeting decisions. It must not be delegated to an implementation agent to reinterpret the meeting record.

## Scope

This how-to covers operator procedure for dashboard source fields, local generation, deterministic feature-branch validation, live operational CI validation, GitHub Pages readiness preflight, deployment, and remediation.

It does not authorize:

- priority or Project Graduation decisions;
- live label creation or migration;
- generator or validator code changes;
- routing/controller changes;
- repository settings changes other than the documented human GitHub Pages setup.

## Current authoritative model

- GitHub Issues are the live source and sole operational authority.
- The dashboard is reporting-only.
- `pmo` identifies PMO-tracked portfolio parents and project tasks.
- Active parents use `team:pmo` and one `pmo:priority:1` through `pmo:priority:4`.
- Pipeline parents use `team:engineering`, one `eng:priority:1` through `eng:priority:4` or `eng:priority:idea`, and one Pipeline stage.
- Pipeline priority reports preparation order; Pipeline stage reports maturity. They are independent.
- Project child tasks use `pmo:task`, a valid parent reference, and lifecycle state. Child tasks do not carry any team label or team-priority label.
- Standalone Operations Issues and peer Engineering preparation Issues are not PMO portfolio rows and do not count toward project completion.
- Generated output that does not meet this contract belongs in Incomplete rather than receiving an invented default.
- The target runtime transition is tracked in #2702. Until it merges, legacy generated output may lag the canonical documentation; operators must use live GitHub Issues and the canonical policies when they conflict.

## Public access URLs

Canonical HTML:

```text
https://wdhunter465.github.io/next-starter-template/pmo-dashboard/
```

Canonical JSON:

```text
https://wdhunter465.github.io/next-starter-template/pmo-dashboard/dashboard-data.json
```

The former owner URL (`https://wdhunter645.github.io/next-starter-template/pmo-dashboard/`) returns 404 after the repository rename to `wdhunter465/next-starter-template`. Use only the `wdhunter465.github.io` URLs above.

At PMO meeting startup, fetch the JSON first, parse it, validate the expected reporting fields and views, and disclose `generatedAt` freshness. If fetch, parse, validation, or freshness is unacceptable, use GitHub Issues directly. GitHub Issues always override the generated snapshot.

The JSON field `source` is expected to equal `github-issues`. Any different value requires direct GitHub verification before reporting.

## Source data and classification

### PMO tracking

```text
pmo label -> PMO-tracked record
no pmo label -> excluded from PMO portfolio reporting
```

A standalone portfolio row also requires a supported parent title classification and must not carry `pmo:task`.

Supported parent prefixes:

- `PROGRAM:`
- `PROJECT:`
- `PROGRAM CANDIDATE:`
- `STRATEGY:`
- `STRATEGY REVIEW:`

A project child task requires:

- `pmo:task`;
- a valid parent reference;
- lifecycle state;
- no `team:*` label;
- no `ops:*`, `eng:priority:*`, or `pmo:priority:*` label.

Child projects inside an active parent program may use:

```text
PROJECT: <parentProgramIssue>:<sequence> | <child project title>
```

The parent issue number, sequence, and display title are parsed from that syntax. Child projects remain nested under the parent and do not duplicate as standalone Pipeline rows.

Static `scripts/pmo-dashboard/pmo-tracked-inventory.json` may contain explicit non-state exclusions or offline fixture data. It must not prescribe live lifecycle, team, priority, stage, or closeout state.

## Dashboard grouping

Validation runs before placement.

```text
invalid required metadata -> Incomplete
pmo:active + team:pmo + pmo:priority:1..4 -> Active
pmo:pipeline + team:engineering + eng:priority:* + one pmo:stage:* -> Pipeline
pmo:closed + terminal GitHub state -> Completed
pmo:task + valid parent -> nested task accounting, not a standalone row
standalone Operations or Engineering preparation Issue -> excluded from PMO portfolio rows
```

Ready for Launch is still Pipeline. It reports prepared maturity and does not authorize implementation.

### Sorting

- Active parents sort by PMO priority, then update time.
- Pipeline parents sort by Engineering priority, then Pipeline stage, then update time.
- `eng:priority:idea` displays as `Idea` and sorts after numbered Engineering priorities unless an agenda view explicitly filters it.
- Completed parents sort by close time, then update time.
- Incomplete rows sort by error severity, then update time.

### Task accounting

- `taskCount` equals linked valid `pmo:task` Issues.
- `tasksCompleted` counts linked tasks with `pmo:closed`.
- `% Complete = round(tasksCompleted / taskCount * 100)` when `taskCount > 0`.
- A peer Operations or Engineering preparation Issue never contributes to task count or percentage.
- A child carrying team priority is a contract defect and belongs in Incomplete until corrected through authorized reconciliation.

## Incomplete remediation

Incomplete is the operator worklist for PMO metadata defects. Each row should show Issue identity, current labels, data-quality errors, required remediation, and update time.

Typical defects include:

- missing or conflicting lifecycle;
- Active parent missing or conflicting `team:pmo` or PMO priority;
- Pipeline parent missing or conflicting `team:engineering`, Engineering priority, or stage;
- cross-namespace team or priority labels;
- PMO priority on Pipeline;
- Engineering priority on Active;
- any team priority on a child task;
- invalid parent reference or task math;
- Operations or Engineering peer work misclassified as a child;
- terminal GitHub state not reconciled to `pmo:closed`.

Remediation procedure:

1. Open the live Issue.
2. Determine whether it is an Active parent, Pipeline parent, project child, standalone Operations Issue, peer Engineering preparation Issue, or excluded record.
3. Compare its metadata with the operating model and dashboard specification.
4. Correct metadata only through authorized PMO reconciliation or the reviewed #2702 migration process.
5. Regenerate and validate output.
6. Confirm movement into the correct view only after the contract violation is gone.

Do not invent missing team, priority, stage, parent, or graduation decisions merely to make the dashboard green.

## Procedure

1. Read the current GitHub Issue and the canonical queue policy before changing metadata.
2. Confirm parent records use lifecycle-matching team and priority:
   - Active: `team:pmo` plus one `pmo:priority:1..4`;
   - Pipeline: `team:engineering` plus one `eng:priority:1..4` or `eng:priority:idea`, plus one stage.
3. Confirm child tasks have `pmo:task`, a valid parent, and no team-level priority.
4. When Incomplete is flooded with `pmo:task` rows and parent `taskCount` values are zero, dry-run then apply `node scripts/pmo-dashboard/reconcile-task-child-labels.mjs` (add `--apply` only after reviewing the plan). The script strips prohibited child queue/stage labels and reconciles lifecycle labels; it does not invent parent references.
5. Confirm Operations and Engineering preparation peer Issues are not included in parent task accounting.
6. On a feature branch, confirm **Validate PMO dashboard branch changes** runs the deterministic fixture successfully.
7. On `main`, scheduled (every 30 minutes), or manual **Build PMO dashboard** runs, confirm generation/validation of `site/pmo-dashboard/dashboard-data.json` and artifact upload.
8. Treat feature-branch fixture success as code-path evidence only. Use a live `main`, scheduled, or manual build for current-inventory evidence.
9. Confirm **PMO dashboard CI deploy** consumes the build artifact (preferred) or, for emergency manual/push paths, regenerates via `run-dashboard-build.mjs`, then reports GitHub Pages readiness.
10. When Pages is unavailable or not configured for GitHub Actions, complete the one-time operator procedure below.
11. Prefer manually dispatching **PMO dashboard CI build** (deploy follows via `workflow_run`). Dispatch deploy directly only when an emergency publish is required without a preceding build.
12. Verify the published HTML and JSON URLs and record evidence on the controlling Issue.
13. Treat the dashboard as a reporting aid, never as authority to create or change priority.

## Refresh and validation

### Freshness contract

- GitHub Issues remain the live source of truth and always override the dashboard snapshot.
- GitHub Pages is a reporting snapshot. Expect lag of at most about 30 minutes under the scheduled build (plus deploy time), unless an operator manually dispatches **Build PMO dashboard**.
- Dashboard CI does **not** run on issue open/edit/label/assign events. That fan-out starved required PR gates and is intentionally removed (Phase 1 redesign under #3136 / #3116).
- At meeting startup, fetch the published JSON, check `generatedAt`, and fall back to Issues if freshness is unacceptable.

The checked-in `site/pmo-dashboard/dashboard-data.json` is a generated snapshot and may be stale. Use published Pages `generatedAt`, not the checked-in copy, for operator freshness.

The build workflow performs live generation and validation on `main`, scheduled, and manual runs, then uploads an artifact. Deploy publishes that artifact to Pages (single build→deploy path). Feature-branch pushes use deterministic fixtures so unrelated live PMO metadata or transient API conditions do not block a proposed code change.

Target validation must reject or quarantine:

- missing identity or URL;
- invalid lifecycle/team/priority combinations;
- Pipeline without exactly one stage;
- team priority on child tasks;
- cross-namespace ownership;
- peer work counted as child work;
- invalid task math;
- prohibited legacy priority such as `pmo:priority:none` or Pipeline `pmo:priority:idea` after migration;
- frozen inventory state overriding current GitHub metadata.

Until #2702 merges, existing runtime code and fixtures may still enforce the legacy single-PMO-priority model. That is a known implementation gap, not valid operator guidance. Do not modify live Issues to satisfy obsolete runtime assumptions without an approved migration transaction.

## GitHub Pages setup notes

GitHub Pages must be enabled with GitHub Actions as the source. This reporting target does not replace or modify the Cloudflare Pages production website.

One-time operator procedure:

1. Open repository **Settings**.
2. Open **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Manually dispatch **PMO dashboard CI build** (preferred; deploy follows automatically) or **PMO dashboard CI deploy**.
5. Confirm Configure Pages, Upload Pages artifact, and Deploy to GitHub Pages execute.
6. Verify the HTML and JSON URLs.
7. Record the workflow and URL evidence on the controlling operational Issue.

Do not add a PAT or privileged secret merely to enable Pages through automation.

## Display safety

Treat all Issue-derived values as untrusted display text. Escape titles, descriptions, owners, statuses, dates, labels, and links before rendering.

## Known limitations

- The target lifecycle-specific queue model is not fully implemented in runtime until #2702 merges.
- Feature-branch fixtures do not prove current live inventory state.
- The public reporting surface is unavailable until GitHub Pages is configured.
- Anticipated completion dates remain explicit Issue values or `TBD`; the dashboard does not forecast dates.
- The first queue-aware runtime version does not require charts, per-project pages, or private reporting.

## Related references

- Work Queues and Collaboration: `/docs/governance/WORK-QUEUES-AND-COLLABORATION.md`
- PMO Operating Model: `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- PMO Dashboard Specification: `/docs/ops/pmo/PMO-JULY-2026-DASHBOARD-SPECIFICATION.md`
- Weekly PMO review: `/docs/how-to/pmo/run-weekly-pmo-priority-and-graduation-review.md`
- Runtime transition: `#2702`

## Supersession

This how-to supersedes operator guidance that uses one PMO priority namespace for Active and Pipeline, requires priority on child tasks, treats Pipeline `pmo:priority:idea` as the target model, or counts peer Operations/Engineering work as project completion.