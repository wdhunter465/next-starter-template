---
Doc Type: Operations Report
Audience: Bill, Governance, PMO operators
Authority Level: Evidence / Audit
Owns: PMO dashboard tracking reconciliation audit for issue #2299
Does Not Own: Final priority authorization or issue closeout
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #2299, #1719, #2313, #2610, #2611, #4776
Last Reviewed: 2026-10-26
---

# PMO Dashboard Tracking Audit — Issue #2299

## Historical status

**Historical evidence only — not live operational authority.**

This audit records the #2299 reconciliation snapshot. Portfolio membership, lifecycle, and priority in this file are frozen evidence from that repair window. Current PMO tracking, lifecycle, priority, stage, task relationships, and closeout state are owned exclusively by live GitHub Issues and the PMO July 2026 issue contract. Do not use this document or frozen `expectedLifecycle` / `expectedPriority` inventory fields to override current Issue metadata.

Canonical current docs:

- `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- `/docs/ops/pmo/PMO-JULY-2026-DASHBOARD-SPECIFICATION.md`
- `/docs/how-to/pmo/pmo-dashboard.md`
- `/docs/reference/pmo/pmo-dashboard-single-authority-implementation-plan.md`

## Purpose

Document PMO dashboard inventory reconciliation performed for issue #2299 so every tracked PMO program, project, idea, strategy, planning item, active item, pipeline item, and completed item is accounted for as active, pipeline, completed, or explicitly excluded with rationale.

## Generator change

Expanded dashboard title inclusion from `PROGRAM:` / `PROJECT:` only to also include:

- `PROGRAM CANDIDATE:`
- `STRATEGY:`
- `STRATEGY REVIEW:`

Machine-readable inventory used at the time of this audit: `scripts/pmo-dashboard/pmo-tracked-inventory.json`. At audit time that file also carried frozen `expectedLifecycle` / `expectedPriority` guardrails. Project #2610 retires those fields as live authority; residual inventory use is limited to explicit non-state exclusions and offline fixtures.

## Label-driven tracking update (#2313)

Issue #2313 supersedes title-prefix inclusion as the dashboard tracking gate:

- `PMO` / `pmo` label = PMO-tracked and eligible for dashboard rows.
- No PMO label = excluded even when a recognized title prefix is present.
- Title prefixes still identify row type for display.
- Child projects use `PROJECT: <parentProgramIssue>:<sequence> | <title>` and nest under active parent programs.

Canonical operator documentation: `docs/how-to/pmo/pmo-dashboard.md`.

## Active programs (numeric priority)

| Priority # | Issue | Name | Owner / Agent | Notes |
| ---: | ---: | --- | --- | --- |
| 1 | #2286 | LGFC Content Pipeline Runtime Implementation | ChatGPT + Cursor | Current website build-out Priority #1 program |
| 2 | #1719 | PMO Governance / Workflow Automation Completion | ChatGPT | Launch-gated; blocked until explicit task assignment |
| 3 | #2299 | PMO Dashboard Tracking Reconciliation and Priority Repair | ChatGPT + Cursor | Current repair project; execution in progress |

## PMO pipeline (numeric priority)

| Priority # | Issue | Name | Dashboard status | Notes |
| ---: | ---: | --- | --- | --- |
| 1 | #2294 | Agent Issue Polling and Handoff Routing | PMO Intake | Next PMO workflow automation project |
| 2 | #2292 | AI-Assisted Tagging for LGFC Digital Content Assets | PMO Intake | Strategy capture only |
| 3 | #2291 | LGFC SEO Strategy and PMO Activation Control | PMO Intake | Strategy capture only |
| 4 | #2040 | Website Automatic Content Publication Capability | PMO Intake | Post-manual-workflow automation program |
| 5 | #2073 | Gehrig Content Collection Phase 2 / Advanced Research and Media Archive Acquisition | PMO Intake | Successor to Phase 1 |
| 6 | #2085 | Admin Page and Tools Design Readiness | PMO Intake | Program candidate |
| 7 | #2075 | LGFC Social Media Strategy | PMO Intake | Program candidate |
| 8 | #2074 | Member Communications and Newsletter Operations | PMO Intake | Program candidate |
| 9 | #2084 | Annual Lou Gehrig Day Operations Package | PMO Intake | Program candidate |
| 10 | #2093 | 2027 Launch Calendar and Go/No-Go Plan | PMO Intake | Program candidate |
| 11 | #2081 | LGFC Monetization Strategy | PMO Intake | Program candidate |
| 12 | #2082 | LGFC Store Strategy | PMO Intake | Program candidate |
| 13 | #2083 | Store and Merchandise Operations | PMO Intake | Program candidate |
| 14 | #2079 | Community Engagement Cadence | PMO Intake | Program candidate |
| 15 | #2078 | Adam Wilson Award and Recognition System | PMO Intake | Program candidate |
| 16 | #2077 | Partner and Friends of the Fan Club Operations | PMO Intake | Program candidate |
| 17 | #2076 | Cost Analysis and Growth Heat Map | PMO Intake | Program candidate |
| 18 | #2273 | LGFC Content Pipeline Reconciliation and Candidate Model | Planning complete | Successor #2286 is active |
| 19 | #2270 | LGFC Content Discovery, Review, Approval, and Publication Pipeline | Strategy review | Review-only strategy issue |
| 20 | #1738 | Lou Gehrig Content Collection / Research Pipeline Expansion | Paused (launch-gated) | Was showing active/failed due to status labels |
| 21 | #1700 | Fundraiser / Charity Campaign Operations Buildout | PMO Intake | Queued launch-gated program |

## Completed programs

| Issue | Name | Notes |
| ---: | --- | --- |
| #1685 | Website Completion / Fan Club Product Buildout | `status:complete` label; GitHub issue still OPEN |
| #2100 | PMO V4 Repository Authority Promotion | Closed project |
| #2039 | Website Public Launch / Relaunch Readiness | Closed program |

## Explicitly excluded issues

| Issue | Rationale |
| ---: | --- |
| #2101 | `DESIGN:` title prefix outside dashboard taxonomy; closed design/pre-build record. CI implementation evidence exists elsewhere. |
| #1847 | `OPS` title prefix; closed operations program, not PMO dashboard inventory row. |
| #2288 | `TASK:` child issue under #2286; not a standalone PMO dashboard row per #2299 scope boundary. |
| #1075 | Historical CI orchestration project; outside #2299 tracked inventory. |
| #1039 | Historical DIATAXIS governance project; outside tracked inventory. |
| #1076 | Historical DIATAXIS migration project; outside tracked inventory. |
| #1054 | Historical repository governance project; outside tracked inventory. |
| #1335 | Historical Phase 1 wrap-up program; PMO July 2026 archive evidence. |

## ChatGPT decisions (resolved)

1. **#1685** — Keep `Dashboard Lifecycle: completed`. Do not close GitHub issue in this PR.
2. **#1738** — Pipeline Priority #20, `Paused (launch-gated)`.
3. **#2273** — Pipeline, `Planning complete (successor #2286 active)`. Do not close or archive in this PR.
4. **#2286** — Active Priority #1 (core acceptance condition).
5. **Legacy rows (#1075, #1039, #1076, #1054, #1335)** — Explicitly excluded from dashboard output via tracked inventory.

## Priority rule applied

Priority reflects LGFC website/repository need per PMO July 2026, not implementation readiness. Pipeline items may rank highly while still launch-gated.

## Validation (historical procedure)

After issue metadata updates and dashboard regeneration for #2299:

```bash
node scripts/pmo-dashboard/build-dashboard.mjs
node scripts/pmo-dashboard/validate-dashboard.mjs site/pmo-dashboard
```

At that time, validation also compared generated rows to frozen inventory `expectedLifecycle` / `expectedPriority` values. That comparison is a documented authority defect under project #2610 and must not be treated as correct current operator guidance. Current validation authority is the live Issue-derived contract in the dashboard specification; residual inventory checks after runtime repair may only enforce explicit exclusions and offline fixtures.
