---
Doc Type: How-To
Audience: Operations, PMO, Product Authority, and editors
Authority Level: Operational Authority
Owns: Operator handoff steps and the annual Lou Gehrig Day evidence-report template
Does Not Own: Filling Product approvals; publication Go; automatic posting; Production mutation
Canonical Reference: /docs/reference/operations/annual-lou-gehrig-day-operating-contract.md
Related Issues: #2084, #3860
Last Reviewed: 2026-09-21
---

# Complete the annual Lou Gehrig Day operator handoff and evidence report

## Purpose

Hand the qualified package to Operations for the next year, and provide the evidence-report template every instance must complete.

## Scope

In scope: operator handoff steps and the annual evidence-report template.

Out of scope: filling Product approvals; publication Go; automatic posting; Production mutation. This how-to is a template and handoff procedure. It does not authorize execution.

## Current known truth

- Durable contract, content packet, run how-to, 2027 instance, and 2027 rehearsal now exist under #2084.
- 2027 publication Go is not recorded. Handoff is for the reusable package plus the gated 2027 instance, not a live campaign.

## Intended final state

A later operator can copy the template, fill planned/approved/executed/skipped/failed/rolled-back/follow-up rows, and archive the year without rewriting this how-to.

## Operator handoff

### Durable package (copy every year)

| Artifact | Path |
| --- | --- |
| Operating contract | `docs/reference/operations/annual-lou-gehrig-day-operating-contract.md` |
| Content/channel packet | `docs/reference/operations/annual-lou-gehrig-day-content-package.md` |
| Run procedure | `docs/how-to/ops/run-annual-lou-gehrig-day.md` |
| Evidence template | this document |

### 2027 instance (gated)

| Artifact | Path |
| --- | --- |
| Instance | `docs/ops/as-built/lou-gehrig-day-2027-instance.md` |
| Rehearsal | `docs/ops/as-built/lou-gehrig-day-2027-rehearsal.md` |

### Role handoff

- Bill owns public/fundraiser/partner/recognition decisions and publication Go.
- Operations owns schedule health, smoke tests, incident response, rollback, and evidence capture.
- PMO records readiness and closeout; it does not create Product Go.
- Implementers own only bounded package/tool remediation named on a source Issue.

## Steps

1. Confirm the rehearsal disposition is PASS or record REMEDIATE items on the parent Issue.
2. Copy the evidence template below into `docs/ops/as-built/lou-gehrig-day-YYYY-evidence.md` when a year actually executes.
3. After the window, mark every instance row planned, approved, executed, skipped, failed, rolled-back, or follow-up.
4. Store the evidence path on the instance `evidence_report_path` field.

## Evidence-report template

Copy from here. Replace bracketed values. Do not leave public dates or copy blank; use `not-authorized` when Product has not approved them.

```text
year: [YYYY]
lou_gehrig_day_date: [YYYY-06-02]
publication_go: recorded | not-authorized
report_owner: [Operations name]
completed_at: [ISO datetime or not-started]

items:
  - item_id: [slug]
    channel: [website-spotlight | club-home | social-export | newsletter-export | fundraiser-mention | partner-recognition]
    disposition: planned | approved | executed | skipped | failed | rolled-back | follow-up
    window: [YYYY-06-02 or Product-approved window or not-authorized]
    rights_status: [rights-review vocabulary]
    notes: [short fact]

follow_ups:
  - issue: [number or none]
    summary: [fact]
```

## 2027 evidence status

No 2027 execution evidence report is started because `publication_go` is `not-authorized`. That is expected.
