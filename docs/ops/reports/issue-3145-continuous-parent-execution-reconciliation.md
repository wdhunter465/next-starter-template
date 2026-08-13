---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Evidence / Reconciliation
Owns: Current-versus-target reconciliation and CI bookkeeping opportunities for Issue #3145
Does Not Own: Normative queue policy (see WORK-QUEUES-AND-COLLABORATION.md) or closeout mutation ownership
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #3145, #3055, #3134, #3113
Last Reviewed: 2026-08-07
---

# Issue #3145 — Continuous parent-level execution reconciliation

## Purpose

Record the reconciliation from mandatory per-task WORK release/dispatch semantics to continuous parent-level agent execution under standing Project/Program ACTIVE authority, including Team vs agent label separation, Cursor/Claude Team eligibility, and CI bookkeeping opportunities that preserve the single post-merge closeout owner.

## Scope

In scope: documentation/governance reconciliation for #3145 and identification of deterministic CI bookkeeping opportunities.

Out of scope: new closeout mutation owners; workflow implementation; absorbing #3134 HOLD taxonomy ownership; rewriting historical closed Issues solely for process alignment.

## Current known truth

Before this reconciliation, graduated-project docs still required WORK `ACCEPT` plus WORK/Administration “release” as the normal gate before a package-complete successor could proceed, which idled eligible executors even when deterministic predecessor completion already satisfied the prepared graph. `team:*` and `agent:*` were easy to conflate in practice. Claude precedence still listed Operations assignment ahead of normal Engineering self-claim.

## Intended final state

PMO prepares and activates a complete Project or Program, assigns eligible implementation agents at the parent, and those agents self-claim the next eligible child one task at a time under standing parent authority. Routine PMO redispatch / WORK “release” between already-authorized tasks is not required. WORK performs preparation, monitoring, assurance, substantive acceptance where judgment is required, exception handling, and portfolio reconciliation. Deterministic CI remains the single automatic source-Issue closeout owner.

## Decision summarized

Parent ACTIVE + prepared child graph = standing implementation authority. Eligible agents self-claim; WORK is not a routine per-task dispatcher.

## Canonical owners after this reconciliation

| Concept | Normative owner |
| --- | --- |
| Continuous parent authority / self-claim | `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` |
| Project/Program graduation as standing authority | `docs/governance/PMO-PORTFOLIO.md` |
| Cursor / Claude Team eligibility | `docs/governance/AGENT-TEAM.md` |
| WORK assurance vs dispatch | `docs/governance/AGENT-TEAM.md` + WORK-QUEUES |
| Operations interrupt | WORK-QUEUES / PMO-PORTFOLIO |
| Evidence-backed HOLD taxonomy | Preserve #3134 ownership; pointers only here |
| Automatic source-Issue closeout | `.github/workflows/post-merge-closeout.yml` (unchanged single owner) |

## Team topology note (#3152)

Issue #3145 originally preserved a three-Team topology. Product Authority later added `team:governance` via #3152. The continuous parent-level self-claim model remains unchanged; Governance is an additional stewardship queue, not a PMO graph executor and not an Operations interrupt. See `docs/ops/reports/issue-3152-governance-team-reconciliation.md`.

## Team vs agent labels

- `team:operations` | `team:pmo` | `team:engineering` = durable ownership
- `agent:*` = current execution claim only; do not add merely for visibility

## Agent eligibility

| Agent | Normal Teams | Operations |
| --- | --- | --- |
| Cursor | Operations + PMO | Normal self-claim |
| Claude Code | PMO + Engineering | Escalated join only; no fourth Team |

## CI-assisted PMO bookkeeping opportunities (identify only)

Safe to consider as extensions of the existing single closeout owner (no competing mutation owners):

1. Terminal/status label reconciliation after validated merge (already largely present).
2. Removal/reconciliation of completed `agent:*` claim while preserving `team:*`.
3. Deterministic parent checklist / progress comment updates when all mandatory children are closed complete.
4. Evidence-summary artifact for later WORK assurance review.
5. Deterministic upsert of bounded PMO remediation Issues when closeout validation finds a discrepancy (align with existing post-merge remediation).

Must remain human/WORK/Engineering judgment:

- disputed dependencies or risks;
- Product acceptance decisions;
- protected change approval;
- Production / privacy / rights / credential / destructive-data / cost exceptions;
- inferring that a material Project-level gate is unnecessary.

## Active Issue wording follow-ups (not rewritten here)

Existing Active parent/child Issues that still say “wait for WORK ACCEPT before successor claim” should be reconciled in bounded follow-on remediation when next touched. Do not rewrite historical closed records solely for process alignment.

## Validation scenarios (documentation check)

1. Single Project — parent ACTIVE + agent self-claims children serially: documented.
2. Program — stop at Project boundary only for substantive gate: documented.
3. No valid parent blocker — next Project eligible without new PMO release: documented.
4. Valid parent blocker — evidence-backed HOLD: preserved via #3134 pointers.
5. Operations interrupt — Cursor pauses PMO, clears Ops, resumes: documented.
6. Operations escalation — Claude joins without fourth Team: documented.
7. PMO exception interrupt — documented via WORK remediation ownership.
8. CI clean closeout — single owner preserved; bookkeeping opportunities listed.
9. CI discrepancy — remediation upsert opportunity listed; no silent advance.
10. Team ownership unchanged while `agent:*` claims executor: documented.
