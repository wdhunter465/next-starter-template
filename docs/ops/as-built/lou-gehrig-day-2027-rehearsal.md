---
Doc Type: Operations
Audience: Operations, PMO, Product Authority, and implementation agents
Authority Level: Operational Evidence
Owns: 2027 Lou Gehrig Day package rehearsal record with no public posting and no Production mutation
Does Not Own: Publication Go; live posting; D1/B2 writes; website route changes
Canonical Reference: /docs/how-to/ops/run-annual-lou-gehrig-day.md
Related Issues: #2084, #3859, #3858
Last Reviewed: 2026-09-21
---

# Lou Gehrig Day 2027 rehearsal record

## Purpose

Rehearse the #2084 package against the 2027 instance without posting, scheduling, or mutating Production. Findings stay in this record.

## Current known truth

- Instance: `docs/ops/as-built/lou-gehrig-day-2027-instance.md`
- Approved public date in that instance: 2027-06-02 only
- All public channels are `not-authorized`
- This rehearsal is a document and read-only procedure check, performed 2026-09-21 by Cursor Local under Product direction to implement #2084

## Intended final state

The operating candidate is qualified as unchanged: the durable contract, content packet, how-to, instance schema, and evidence template can be copied to a later year. Live publication remains a separate Product Go.

## Scope

In scope: schema completeness, freeze mark, readiness-gate logic, smoke-test design, rollback path citation, fallback behavior when channels are `not-authorized`.

Out of scope: calling `/api/scheduled-content/publish-due`, Zapier, wrangler, D1 execute, admin publish, or any social API. This record is not publication Go.

## Checklist results

| Gate | Result | Notes |
| --- | --- | --- |
| Instance schema populated | pass | Every field is set; unauthorized work is `not-authorized`, not blank |
| June 2 anchor only | pass | No extra public dates invented |
| Content-packet rows for planned public items | pass | Zero planned public items; empty register is required while Product has not approved copy |
| Rights blocking states | pass | No public item is in `unknown` while still planned |
| Smoke tests (read-only) | pass | Spotlight keys limited to existing placement vocabulary; fundraiser/partner omitted |
| Rollback path named | pass | Website path cites takedown/restore how-to; pre-publication rollback is cancel/replace instance |
| Scheduled-content / Zapier unused | pass | Not invoked |
| Production D1/B2 unused | pass | Not invoked |

## Findings

1. The package can be copied for a future year without rewriting policy.
2. 2027 cannot go live from this rehearsal: public copy, owners, and publication Go are still `not-authorized`. That is a protected stop, not a package defect.
3. No gap required a contract change. The operating candidate is unchanged.

## Disposition

**PASS — qualify the unchanged operating candidate.** Do not treat this rehearsal as website or social Go.
