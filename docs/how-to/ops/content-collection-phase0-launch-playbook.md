---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: End-to-end launch sequence for Content Collection documentation-promotion Phase 0 (#2359 child chain)
Does Not Own: Feature implementation, CI workflow changes, merge authorization, or issue closure authority
Canonical Reference: /docs/ops/pmo/lou-gehrig-content-collection-expansion-readiness.md
Related Issues: #2359, #2360, #2366, #2389, #4776
Last Reviewed: 2026-10-26
---

# Content Collection Phase 0 Launch Playbook

## Purpose

Define the executable launch sequence for the Content Collection documentation-promotion program (#2359) Phase 0 work: audit, issue-thread collaboration, bounded PR, post-merge closeout, and downstream child authorization.

**Phase 0** in this program means documentation migration / enrichment / Diataxis placement planning only. It is not Program 2 website Phase 0 reconciliation.

## Procedure

### Step 1 — Confirm program context

Before starting any Phase 0 child issue:

1. Read parent program #2359 and the assigned child issue (#2360–#2366).
2. Read `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` (do not rely on duplicated handoff text in issue bodies).
3. Read `docs/ops/pmo/queue-watch-and-dispatch-protocol.md` for dispatcher obligations.
4. Confirm intake source location: `_incoming/drive-drafts/content-collection/` on branch `ChatGPT/drive-draft-intake-2367` (non-authoritative only).

### Step 2 — Execute the serial child chain

| Order | Issue | Deliverable | Blocks |
| ---: | --- | --- | --- |
| 1 | #2360 | Audit/dedup report | #2361, #2363, #2364 |
| 2 | #2361 | Foundation package docs | #2362 (partial) |
| 3 | #2363 | Control/operational docs | #2365 |
| 4 | #2364 | Support registers / assignment docs | #2365 |
| 5 | #2362 | Feature package docs | #2365 (after #2360 + #2361) |
| 6 | #2365 | Terminal promotion PR / closeout | — |
| parallel | #2366 | Lessons-learned register (living doc) | Does not block promotion |
| parallel | #2374 | ZIP history remediation (ops) | May block PR gates until dispositioned |

Do not start downstream enrichment (#2361+) until #2360 audit PR is merged and ChatGPT disposition decisions are recorded in the issue thread.

### Step 3 — Issue-first collaboration (before PR)

For each child issue:

1. Cursor posts findings, proposed paths, and blockers in the issue thread.
2. Use `CHATGPT HANDOFF` and request `agent:ChatGPT` at review points.
3. Product Authority records decisions into the issue before Cursor acts on them.
4. Open a PR only after issue-level direction is complete.

### Step 4 — Open a bounded docs PR

Each Phase 0 PR must:

- link exactly one source issue (`- **Issue:** #NNNN`);
- use an exact file allowlist matching the final diff;
- use intent label `docs-only` when applicable;
- include parser-safe sections: `ACCEPTANCE CRITERIA`, `Reviewer / Bot Review Attestation`, reviewer dispositions when bots reviewed;
- avoid `status:in-progress` on the source issue at merge time (blocks terminal closeout);
- record `DIATAXIS_FULL` or `DIATAXIS_ROUTED` classification in the PR body.

See `docs/how-to/ops/drive-draft-intake-and-promotion.md` for intake/ZIP constraints.

### Step 5 — Post-merge closeout

After merge:

1. Inspect Post-Merge Detection output on the merge commit.
2. If validation fails, follow `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md` and `docs/ops/pmo/github-issue-closeout-protocol.md`.
3. Apply atomic closeout: terminal labels, successor disposition, queue continuation/halt recorded in one pass.
4. For docs-only ops issues, accepted manual closeout is valid when automation fails on PR-body metadata if the deliverable is verified on `main`.

### Step 6 — Advance or halt the queue

Record on the parent #2359 or predecessor closeout comment:

- which successor issues are unblocked;
- which remain blocked and why;
- whether Cursor wake labels (`agent:cursor`, `handoff:ready`) were applied to the next active task.

## Stop rules

Stop and request a Product Authority decision when:

- repository authority conflicts with a Drive draft;
- target Diataxis path is ambiguous;
- merge would occur with unresolved required gate failures unless explicitly authorized;
- post-merge closeout cannot reconcile successor state.

## Related authorities

- Drive intake: `docs/how-to/ops/drive-draft-intake-and-promotion.md`
- Audit artifact: `docs/ops/reports/content-collection-docs-audit-dedup-2360.md`
- Lessons register: `docs/ops/pmo/pmo-lessons-learned-and-continuous-improvement.md`
- Failed pre-gate follow-up: `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md`
