---
Doc Type: AS-BUILT
Audience: Product Authority, PMO, Operations, editors, and implementation agents
Authority Level: Operational Implementation Record
Owns: Delivered #2093-001 / #3861 taxonomy evidence — identities, files, and current child-graph state
Does Not Own: Absolute calendar generation; source-program integration; Go/No-Go packet; tabletop rehearsal; freeze/reporting handoff; public launch; Production mutation
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #2093, #3861, #3862, #3863, #3864, #3865, #3866, #1700, #2039, #2084, #2782, #2089
Last Reviewed: 2026-09-23
---

# 2027 launch calendar (#2093) — AS-BUILT

## Purpose

Record what child [#3861](https://github.com/wdhunter465/next-starter-template/issues/3861) delivered after Product Graduation GO on 2026-09-23. This is documentation implementation. It is not website, fundraiser, or announcement Go.

## Scope

In scope: delivered milestone taxonomy, owners, evidence types, sequence, and freeze/exception rules for parent #2093.

Out of scope: new public dates; #3862–#3866 deliverables until those children land; Production mutation; paid tools; credentials.

## Current known truth

- Parent #2093 is OPEN, Active, `pmo:priority:1`, implementation owner Cursor Local.
- Starting target SHA for #3861: `02e093a781cd286131a570278ce54fe8959ed89a` (`origin/main` after PR #4347).
- Product-approved 2026-09-20 anchors remain on #2093. This child did not invent dates.
- Children #3862–#3866 remain OPEN. Their outputs are not claimed complete here.
- #2089 remains OPEN as an evidence-model gap for later Production Go.

## Intended final state

Operators classify every 2027 launch-window row against the taxonomy before treating it as a public date. Absolute calendar, integration, packet, rehearsal, and freeze handoff follow in #3862–#3866.

## Record identity

- Project Issue: #2093
- Child Issue: #3861 (task #2093-001)
- Successor: #3862
- Product Authority: Bill
- Implementer: Cursor Local
- Independent reviewer: not this implementer
- Production mutation: none

## Delivered outcome

| Child | Deliverable |
| --- | --- |
| #3861 | `docs/reference/operations/2027-launch-calendar-operating-contract.md` taxonomy, owners, evidence, sequence, freeze/exception rules |
| #3862 | not delivered |
| #3863 | not delivered |
| #3864 | not delivered |
| #3865 | not delivered |
| #3866 | not delivered |

## Taxonomy coverage

The operating contract includes owner and evidence for website, fundraiser, Lou Gehrig Day, freeze, rehearsal, deployment, rollback, announcement, and Day-2 classes. A row without owner or evidence is rejected.

## Final repository surfaces

| Surface | Result |
| --- | --- |
| Routes / APIs / workflows | Unchanged |
| D1 / B2 / credentials | Unchanged |
| Website copy | Unchanged |
| Public dates | Unchanged; still Product-owned on #2093 |

## Rollback

Revert the #3861 docs PR or restore the previous Issue revision. Do not change Production or public dates.

## Next recommended action

Independent review and merge of the #3861 PR, then execute #3862 (record Product anchors and generate the absolute calendar).
