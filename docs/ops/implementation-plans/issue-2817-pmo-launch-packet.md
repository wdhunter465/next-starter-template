---
Doc Type: Implementation Plan
Audience: Human + AI
Authority Level: Operational Plan
Owns: PMO launch packet for Project #2817 — sizing, Model B selection, authoritative child graph, validation, rollback
Does Not Own: Product priority, Graduation GO, Production promotion, or child file-touch allowlists
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2817, #2818, #2819, #2820, #2821, #2822, #2823, #2824, #2825, #2826, #2827, #2828, #2829, #2830, #2831, #2832, #3355
Last Reviewed: 2026-08-18
---

# Issue #2817 PMO launch packet

## Status

`_DRAFT` — Pipeline preparation. Graduation `GO` is a PMO meeting decision on #2817, not a claim of this packet.

## Purpose

Give PMO / Engineering a complete-enough launch package for Project #2817: work size, delivery model, ordered child graph, dependencies, validation, and rollback.

## Scope

- Parent #2817 and the 15 ordered children published on that Issue.
- Exact file-touch allowlists remain on each child Issue and are confirmed at child implementation Go.
- Front matter and named sections in this packet comply with `docs/governance/standards/document-status-and-naming_MASTER.md`.

### Out of scope

- Retargeting this documentation PR to `component/**`.
- Substituting a 14-task graph that starts at #2819 and omits #2818.
- Child implementation before Graduation `GO`.

## Current known truth

- #2817 is Pipeline / Planning and is ready for PMO Graduation Review. Product Authority: Bill. PMO Design Owner: ChatGPT / Atlas. Implementation / Operations owner for remaining children: Cursor Local (Product Authority assignment 2026-08-18).
- Authoritative order is the #2817 table. Issue numbers are not the task order (#2819 is Order 007, not Task 001).
- Order 001 #2818 is **CLOSED COMPLETE**, reconciled 2026-08-13 as satisfied/superseded by accepted D1 isolation project #3355. That close is not a #2817 serial implementation start.
- After Graduation `GO`, the first executable child is **#2822**. Remaining children stay graduation-prep (`PACKAGE-INCOMPLETE` for execution) until GO plus a child checkpoint with an exact allowlist.
- This PR targets `main` and is Model A documentation. The **project** remains Model B after graduation.

## Intended final state

- Packet, design draft, and PMO backlog cite the same 15-order graph.
- After Graduation `GO`, children execute serially on `component/**` under Model B unless PMO records a different model.

## Work sizing and delivery model

- **Size:** Medium
- **Delivery model (project):** B
- **Change mode (project):** project
- **Rationale:** Isolation, protected-path, and environment work need component Development plus Promotion Candidate qualification. That is not a reason for this packet PR to declare Model B-child against `main`.

### Promotion profile path

Canonical PMO planning path from `docs/governance/PMO-PORTFOLIO.md`:

```text
optional Sandbox -> Development -> Promotion Candidate -> Production
```

Day-2 Operations is post-promotion ownership. It is not appended to the promotion-profile path.

### Authority

| Role | Holder |
| --- | --- |
| Product Authority | Bill |
| PMO / Engineering | ChatGPT / Atlas |
| Implementation / Operations (after GO) | Cursor Local unless a child Issue names another holder |
| PR Approver / Engineering | Independent reviewer; Implementation does not self-merge |

## Authoritative ordered child graph

| Order | Issue | Workstream | Predecessor | Successor |
| ---: | ---: | --- | --- | --- |
| 001 | #2818 | Isolate Preview and Component resources from Production | Satisfied by #3355 ACCEPT (closed 2026-08-13) | #2822 |
| 002 | #2822 | Define the Model A Development-to-Candidate transition | #2818 ACCEPT via #3355; Graduation GO | #2823 |
| 003 | #2823 | Reconcile the repository entry-point authority chain | #2822 closeout | #2820 |
| 004 | #2820 | Reduce duplicated normative governance rules | #2823 closeout | #2821 |
| 005 | #2821 | Implement a policy-control capability matrix | #2820 closeout | #2825 |
| 006 | #2825 | Require actor-independent approval for protected changes | #2821 closeout | #2819 |
| 007 | #2819 | Trace exact candidate identity through Production | #2825 closeout | #2824 |
| 008 | #2824 | Make Operations interruption impact-aware | #2819 closeout | #2826 |
| 009 | #2826 | Replace equal-weight PMO completion with milestone progress | #2824 closeout | #2830 |
| 010 | #2830 | Add Engineering Pipeline aging and reaffirmation controls | #2826 closeout | #2831 |
| 011 | #2831 | Establish threat modeling and security requirements | #2830 closeout | #2827 |
| 012 | #2827 | Add supply-chain provenance, SBOM, and attestation | #2831 closeout | #2829 |
| 013 | #2829 | Define SLOs, recovery objectives, and exercises | #2827 closeout | #2828 |
| 014 | #2828 | Verify and document live GitHub enforcement | #2829 closeout | #2832 |
| 015 | #2832 | Measure governance control effectiveness | #2828 closeout | Parent closeout |

Halt condition for every row: predecessor not `ACCEPT`, missing child allowlist, mixed intent, or protected Product/Production decision without Bill.

## Validation

Positive:

- Child graph in this packet matches the #2817 “Authoritative child task graph” table (15 rows; Order 001 = #2818).
- Open children carry the same Order / predecessor / successor fields and `agent:cursor`.
- `npx vitest run tests/diataxis-folder-audit.test.mjs` on changed Markdown.
- PR hygiene allowlist covers only the three preparation paths.

Negative:

- Any packet that lists #2819–#2832 as Tasks 001–014 or omits #2818 fails this package.
- Model B-child metadata on a PR whose base is `main` fails GATE — Quality Checks.

## Rollback

- Revert the preparation PR on `main` if the packet is rejected.
- Child work after graduation uses the child Issue rollback plan; this packet does not authorize those edits.

## Readiness recommendation

PMO / Engineering can take this packet to Graduation Review. Recommendation is **ready for review**, not implementation Go and not self-merge.

Recorded for Graduation Review:

- Implementation owner after GO: Cursor Local
- First executable task after GO: #2822
- Remaining open children carry Order / predecessor / successor / halt fields and `agent:cursor`

- [x] Design draft cites the #2817 15-child graph
- [x] Launch packet cites the same graph and promotion path
- [x] Open children reconciled to that graph and assigned Cursor Local for post-GO execution
- [x] #2818 closed COMPLETE via #3355; not reopened
- [ ] PMO meeting records Graduation `GO` or `NO-GO` on #2817
