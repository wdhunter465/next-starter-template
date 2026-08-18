---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Migration Plan
Owns: Bounded reconciliation plan for open Issues still carrying pre-#3597 PMO stage or 1–4 priority encodings
Does Not Own: Live bulk GitHub mutation, Product priority decisions, or Jules #3608 closeout
Canonical Reference: /docs/reference/pmo/pmo-lifecycle-and-priority-contract.md
Related Issues: #3597
Last Reviewed: 2026-08-18
---

# Issue #3597 PMO Lifecycle Migration Plan

## Purpose

Normalize open Engineering, Pipeline, Active, and closed PMO-tracked Issues to the canonical lifecycle without losing Issue history. This plan does not authorize a bulk relabel in the #3597 documentation PR.

GitHub Issue comments and prior labels remain historical evidence. New labels replace current routing state only.

## Mapping

| Current encoding | Canonical result |
| --- | --- |
| `team:engineering` without `pmo:pipeline` | Leave as Engineering qualification |
| `pmo:pipeline` + `team:engineering` + `eng:priority:idea` or missing numbered prep | After qualification check: `team:pmo` + `pmo:pipeline-priority:<n>` + `pmo:stage:initial-idea` |
| `pmo:stage:intake` | `pmo:stage:initial-idea` |
| `pmo:stage:discovery` | `pmo:stage:drafted-design` |
| `pmo:stage:definition` | `pmo:stage:drafted-design` |
| `pmo:stage:planning` | `pmo:stage:pending-launch-packet` |
| `pmo:stage:prep` | `pmo:stage:pending-launch-packet` |
| `pmo:stage:ready-for-launch` | `pmo:stage:graduation-candidate` |
| Pipeline `eng:priority:<n>` | New independent `pmo:pipeline-priority:<n>` only after PMO reorders that Pipeline queue; do not treat old Engineering P1 as Active P1 |
| Active `pmo:priority:1` through `pmo:priority:4` | Remain valid ordered positions; extend with `pmo:priority:5+` when the Active queue is longer than four |
| Active P1–P4 capacity-band comments | Historical only; replace with the current ordered list in the next PMO meeting closeout |
| Closed `pmo:closed` with historical `eng:priority:*` | Keep one historical namespace; do not add Active `pmo:priority:*` to invent a missing Active order |

## Open-record classes

1. **Engineering qualification** — `team:engineering`, no `pmo:pipeline`. No label change unless qualification is already satisfied; then enter Initial Idea.
2. **Legacy Pipeline parents** — `pmo:pipeline` still carrying `team:engineering` or retired stage labels. Fail closed on the dashboard (Incomplete) until PMO applies the mapping and assigns a Pipeline order integer.
3. **Canonical Pipeline parents** — already `team:pmo` with `pmo:pipeline-priority:<n>` and a canonical stage. No migration.
4. **Active parents** — keep `team:pmo` and existing `pmo:priority:<n>`. Remove any leftover Pipeline stage labels.
5. **Closed parents** — keep `pmo:closed`. Do not rewrite history to the new stage names.
6. **Children** — strip `team:*`, `pmo:priority:*`, `pmo:pipeline-priority:*`, `eng:priority:*`, and `pmo:stage:*` if present.

## Execution order

1. Snapshot open `pmo` Issues, labels, and bodies (Administration & Communications).
2. Create missing GitHub labels for canonical stages and any `pmo:pipeline-priority:<n>` / `pmo:priority:<n>` integers required by the snapshot. Do not apply them yet.
3. At the next PMO meeting, order current Pipeline parents 1...N and Active parents 1...M independently.
4. Apply unambiguous Pipeline remaps issue by issue. Quarantine mixed `eng:priority:*` plus `pmo:priority:*` parents until PMO chooses the surviving lifecycle.
5. Rebuild and validate the PMO dashboard. Incomplete rows are the remaining migration backlog.
6. Retire unused legacy stage labels only after zero open uses, by a separate recorded decision.

## History preservation

Do not delete Issue comments, review notes, or closed Issues to clean old stage names. Record the remap on the Issue when labels change:

```text
Lifecycle remap (#3597): <old labels> -> <new labels>. Prior comments remain historical.
```

## Out of scope for this plan

- Member-content / photo-rights documents from PR #3603
- Host poller eligibility work
- Automatic closeout of leftover `status:failed` on #3597 from the misattributed merge
