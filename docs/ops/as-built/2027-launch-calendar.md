---
Doc Type: AS-BUILT
Audience: Product Authority, PMO, Operations, editors, and implementation agents
Authority Level: Operational Implementation Record
Owns: Delivered #2093-001 / #3861 taxonomy and #2093-002 / #3862 calendar-of-record evidence
Does Not Own: Source-program integration; Go/No-Go packet; tabletop rehearsal; freeze/reporting handoff; public events calendar rows; Production mutation
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #2093, #3861, #3862, #3863, #3864, #3865, #3866, #1700, #2039, #2084, #2782, #2089
Last Reviewed: 2026-09-23
---

# 2027 launch calendar (#2093) — AS-BUILT

## Purpose

Record what children [#3861](https://github.com/wdhunter465/next-starter-template/issues/3861) and [#3862](https://github.com/wdhunter465/next-starter-template/issues/3862) delivered after Product Graduation GO on 2026-09-23. This is PMO documentation. It is not website, fundraiser, or announcement Go.

## Scope

In scope: taxonomy plus the Product 2026-09-20 absolute calendar of record, including the 2026-09-23 rule that these dates stay PMO-administrative.

Out of scope: D1 `events` / public Fan Club Events Calendar; #3863–#3866 until those children land; Production mutation.

## Current known truth

- Parent #2093 is OPEN, Active, `pmo:priority:1`, implementation owner Cursor Local.
- #3861 merged on `main` as PR #4348 (`7752c3e1f6394ce865b36c8e468413a68e75955e`).
- Starting target SHA for #3862: `7752c3e1f6394ce865b36c8e468413a68e75955e`.
- Calendar rows match the Product 2026-09-20 anchors on #2093. No new public date was created.
- Product 2026-09-23: do not publish #2093 dates on the public calendar.
- #2089 remains OPEN as an evidence-model gap for later Production Go.

## Intended final state

PMO operators use the contract table as the calendar of record. Public website events remain a separate Product publication surface.

## Record identity

- Project Issue: #2093
- Children: #3861, #3862
- Successor: #3863
- Product Authority: Bill
- Implementer: Cursor Local
- Independent reviewer: not this implementer
- Production mutation: none

## Delivered outcome

| Child | Deliverable |
| --- | --- |
| #3861 | Taxonomy, owners, evidence, sequence, freeze/exception rules |
| #3862 | Absolute calendar of record; PMO-only publication rule |
| #3863 | remaining |
| #3864 | remaining |
| #3865 | remaining |
| #3866 | remaining |

## Final repository surfaces

| Surface | Result |
| --- | --- |
| Routes / APIs / workflows | Unchanged |
| D1 `events` | Unchanged (no #2093 seed) |
| Website copy | Unchanged |

## Rollback

Revert the #3862 docs PR. Restore the last Product-approved calendar revision on #2093. Do not roll back unrelated technical work.

## Next recommended action

Independent review of the #3862 PR, then #3863 (integrate source-program milestones onto this calendar).
