---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Evidence Snapshot
Owns: Migration classification evidence (ACTIVE_CLAIM / EXPLICIT_RESERVATION / STALE_PREASSIGNMENT / AMBIGUOUS) for open `agent:*` Issues, produced for #3240
Does Not Own: The team-vs-agent claim-lifecycle policy itself (owned by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`); execution of any label removal, which remains a separate, evidence-backed operation per Rollback below
Source Issue: #3240
Canonical Reference: /docs/ops/reports/issue-3240-team-agent-claim-semantics-migration-audit.md
Related Issues: #3240
Last Reviewed: 2026-08-10
Executor: Grok (original), Claude Code (2026-08-10 evidence pass)
---

# Issue #3240 — team vs agent claim semantics migration audit

## Purpose

Classify open `agent:*` Issues against the claim lifecycle defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` so only proven `STALE_PREASSIGNMENT` labels are removed.

## Scope

Covers classification of every open GitHub Issue carrying an `agent:*` label at audit time, against the four classes defined in the Classification rules table below. It does not decide or change any `team:*` label (out of scope per Policy constraints), and it does not itself remove any label — classification is evidence collection; removal is a separate follow-up action gated on proven `STALE_PREASSIGNMENT` evidence.

## Current known truth

- `agent:claude` (15 open Issues, audited 2026-08-10): 0 `STALE_PREASSIGNMENT`; 9 `ACTIVE_CLAIM`, 6 `EXPLICIT_RESERVATION` — see the per-issue table below.
- `agent:grok` (4 open Issues, audited 2026-08-10): 1 `ACTIVE_CLAIM` (#3240 itself), 3 `AMBIGUOUS` (label/body ownership contradictions requiring Grok or Cursor confirmation).
- `agent:cursor` (19 open Issues at audit time): not yet classified by this pass — deferred as a follow-up requiring Cursor-side activity confirmation this pass could not obtain.
- No `agent:*` label has been removed by this document or its remediation pass.

## Intended final state

Once the deferred `agent:cursor` set is classified with real activity evidence (by #3240's primary executor or Cursor itself) and any `AMBIGUOUS` cases in the `agent:grok` set are resolved with Grok/Cursor confirmation, this doc's classification section is complete for the full open-Issue `agent:*` label surface. Any `STALE_PREASSIGNMENT` findings from that completed pass would be removed only via a separate, evidence-backed follow-up PR per the Policy constraints below — never bulk-deleted from this report alone.

## Classification rules

| Class | Meaning | Action |
| --- | --- | --- |
| ACTIVE_CLAIM | Agent is actively executing or has current handoff evidence | Keep `agent:*` |
| EXPLICIT_RESERVATION | Product Authority deliberately reserved the Issue for a named agent | Keep until released |
| STALE_PREASSIGNMENT | Historical pre-assignment with no recent activity or reservation evidence | Remove `agent:*` only after recorded evidence |
| AMBIGUOUS | Insufficient evidence to classify | Leave; do not bulk-delete |

## Policy constraints

- No bulk deletion of valid reservations.
- No removal of `ACTIVE_CLAIM` or `EXPLICIT_RESERVATION`.
- `team:*` remains durable queue ownership and is out of scope for this migration.

## Classification evidence — bounded pass (2026-08-10, Claude Code)

This section is a bounded, evidence-backed classification pass covering the `agent:claude` and `agent:grok` open-Issue sets, performed as post-merge remediation for a review finding on this doc (this doc previously described the methodology but recorded no actual classifications). It does not cover the `agent:cursor` queue (19 open Issues at audit time) — classifying those requires Cursor-side activity confirmation this bounded remediation cannot obtain, so that set remains an explicit follow-up owned by #3240's primary executor rather than a guess.

### `agent:claude` (15 open Issues, live GitHub search 2026-08-10)

| Issue | Class | Evidence |
| --- | --- | --- |
| #2780 | EXPLICIT_RESERVATION | 2026-08-08 PMO "Lane assignment — Claude Code" comment on #2860 names #2780 as part of Lane 1's owned chain (Library migration → #2857 → #3172 → #2780 → #2781 → #2782). |
| #2781 | EXPLICIT_RESERVATION | Same Lane 1 assignment; #2926/#2928/#2929 (its children) have merged PRs with Claude Code as implementation agent. |
| #2782 | EXPLICIT_RESERVATION | Same Lane 1 assignment; #2930/#2931/#2932/#2933 (its children) have merged PRs with Claude Code as implementation agent. |
| #2860 | EXPLICIT_RESERVATION | Named first in the same Lane 1 assignment comment; children #2910–#2913 all closed complete under `agent:claude`. |
| #2909 | ACTIVE_CLAIM | PR #3249 merged this session; two Copilot findings dispositioned and resolved; closeout evidence posted. |
| #2926 | ACTIVE_CLAIM | PR #3236 merged; both review threads resolved pre-merge. |
| #2928 | ACTIVE_CLAIM | PR #3225 merged; all 4 review threads resolved pre-merge. |
| #2929 | ACTIVE_CLAIM | PR #3226 merged; all 4 review threads resolved pre-merge. |
| #2930 | ACTIVE_CLAIM | Post-merge remediation PRs #3252/#3259 merged this session; Bill recorded an explicit NO-GO-for-Production/continue-scaffolding decision, actively tracked. |
| #2931 | ACTIVE_CLAIM | PR #3230 merged; both review threads resolved pre-merge. |
| #2932 | ACTIVE_CLAIM | PR #3231 merged; Bill's post-merge reconciliation comment confirms clean, no remediation required. |
| #2933 | ACTIVE_CLAIM | Post-merge remediation PRs #3255/#3259 merged this session; Bill recorded an explicit HOLD-on-acceptance decision, actively tracked. |
| #3124 | EXPLICIT_RESERVATION | Bill's 2026-08-06 routing comment names Claude Code's specific role (independent engineering review/verification, steps 2 and 5 of the bounded Codex/Claude/Bill sequence) for this Issue by name. |
| #3213 | EXPLICIT_RESERVATION | Issue body explicitly schedules a single future execution date ("Do not execute this research before 2026-09-08"); the `agent:claude` label is a deliberate future assignment, not a stale artifact. |
| #3215 | ACTIVE_CLAIM | Currently under active bounded remediation (#3222, #3224, this Issue's #3262/#3248-cleanup pass). |

Result: 0 `STALE_PREASSIGNMENT` found in the `agent:claude` set — every open Issue has direct, current evidence of either active execution or a deliberate Product Authority reservation. No label removals are indicated by this pass.

### `agent:grok` (4 open Issues, live GitHub search 2026-08-10)

| Issue | Class | Evidence |
| --- | --- | --- |
| #3240 | ACTIVE_CLAIM | This Issue's own subject; PR #3248 merged 2026-08-09 with Grok as implementation agent; this audit doc is itself part of that active work. |
| #3134 | AMBIGUOUS | Issue body's own "Implementation routing" section names "Proposed implementer: Cursor Local", not Grok — a label/body inconsistency this bounded pass cannot safely resolve without Grok or Cursor confirming current ownership. |
| #2679 | AMBIGUOUS | Issue body states "Owner: ChatGPT / Atlas" explicitly, contradicting the `agent:grok` label — same class of inconsistency; left unchanged per the AMBIGUOUS handling rule rather than guessed. |
| #1038 | AMBIGUOUS | Created 2026-05-14 with zero comments recorded; no activity evidence available to this bounded pass to distinguish a dormant-but-still-owned backlog item from `STALE_PREASSIGNMENT` without Grok's confirmation. |

Result: 1 `ACTIVE_CLAIM`, 3 `AMBIGUOUS` (correctly left unchanged and surfaced here for disposition, per the Classification rules table above — not bulk-removed).

### Deferred: `agent:cursor` (19 open Issues at audit time)

Not classified by this bounded pass. A full list of open `agent:cursor` Issue numbers/titles was captured for the record but omitted here since without Cursor-side activity confirmation, publishing a full table would either guess at classifications (violating the AMBIGUOUS handling rule) or require restating 19 rows of unclassified data with no evidentiary value. #3240's primary executor should complete this set in a follow-up pass with Cursor's own activity evidence.

## Rollback

Revert this report via reviewed PR. Label removals (if any) are separate, evidence-backed operations.
