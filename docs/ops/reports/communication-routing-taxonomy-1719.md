---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Evidence / Status Index
Owns: Evidence that Follow-up 4/5 (#2565) published a separate communication and routing taxonomy
Does Not Own: Follow-up 5/5, label creation/deletion, issue mutation, or production promotion
Canonical Reference: /docs/ops/pmo/queue-watch-and-dispatch-protocol.md
Related Issues: #2565, #1719, #2528, #2564
Last Reviewed: 2026-08-18
---

# Communication and routing taxonomy — #2565

## Purpose

Publish one unambiguous taxonomy that separates PMO portfolio metadata, PR classification, ChatGPT review routing, Cursor execution wake signals, and operational status labels.

## Scope

This report owns evidence that Follow-up 4/5 (#2565) published the communication and routing taxonomy. It does not create or delete labels, mutate issues, or promote to Production.

## Current known truth

Five namespaces are separate: PMO portfolio metadata, PR classification, ChatGPT review routing, Cursor execution routing, and operational status. `agent:cursor` plus `handoff:ready` is the required wake pair; prose naming Cursor as next does not wake.

## Intended final state

Operators and automation consume each namespace for its stated action and do not substitute one family for another.

## Predecessor

#2564 / PR #2625 integrated at `6202cc79` on `component/pmo-governance-workflow-automation`.

## Operator matrix

| Namespace | Markers | Consumer | Causes |
| --- | --- | --- | --- |
| PMO portfolio metadata | `pmo`; exactly one `pmo:active` / `pmo:pipeline` / `pmo:closed`; exactly one `pmo:priority:*`; stage when pipeline; `pmo:task` for children | PMO dashboard / portfolio reports | Reporting and dashboard placement |
| PR classification | Exactly one PR intent label; PR class in PR body | PR hygiene / reviewers / CI intent | Verification depth and PR accounting |
| ChatGPT review routing | Label `agent:ChatGPT`; comment `CHATGPT HANDOFF` (then `CHATGPT RESPONSE` / `CHATGPT CLOSEOUT`) | Invoked dispatcher / scheduled watch / Bill | Review, decision, exception, closeout — requires an invoked watch |
| Cursor execution routing | `agent:cursor` **+** `handoff:ready` (required wake pair); claim → `handoff:in-progress` | Local Cursor poller / authorized dispatcher | Wake eligibility only; prose naming Cursor as next does not wake |
| Operational status | `status:*` | Operators / closeout automation | Execution/verification bookkeeping — not PMO lifecycle |

## Non-substitution rules

1. PR intent/class ≠ PMO lifecycle.
2. `pmo:active` ≠ Cursor wake.
3. `agent:ChatGPT` without an invoked dispatcher/watch ≠ completed review.
4. `agent:cursor` alone or narrative “Cursor next” ≠ pickup authority.
5. `status:*` ≠ `pmo:*` dashboard lifecycle.

## Changed paths (allowlist)

| Path | Change |
| --- | --- |
| `docs/ops/pmo/queue-watch-and-dispatch-protocol.md` | Added Communication and routing taxonomy section |
| `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` | Added taxonomy; clarified wake pair and ChatGPT review markers |
| `docs/reference/pmo/lgfc-cursor-execution-contract.md` | Minimal routing-taxonomy cross-reference |
| `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md` | Concise lifecycle vs routing cross-reference |
| `docs/ops/reports/communication-routing-taxonomy-1719.md` | This report |

## Acceptance mapping

| Criterion | Result |
| --- | --- |
| Five namespaces defined separately | PASS |
| Each marker states consumer and action vs reporting | PASS |
| `agent:cursor` + `handoff:ready` documented as required wake pair | PASS |
| `agent:ChatGPT` / `CHATGPT HANDOFF` documented as review markers needing invoked dispatcher/watch | PASS |
| No prose implies one family substitutes for another | PASS |
| Concise matrix available | PASS (this file + queue-watch table) |

## Boundaries honored

- No label create/delete
- No unrelated issue mutation
- No self-approve / self-merge / `main` promotion
- Allowlist only
