---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: PMO lessons learned, continuous-improvement controls, and reusable launch checkpoints for LGFC programs
Does Not Own: Program scope, merge authorization, workflow implementation, or issue closure authority
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #2366, #2359, #2376, #2380, #2389, #4776
Last Reviewed: 2026-10-26
---

# PMO Lessons Learned and Continuous Improvement Register

## Purpose

Capture prior LGFC program lessons in repository documentation so no single agent, operator, or chat session is the sole memory for process friction, launch failures, or controls that worked.

This register is a **living document**. Issue #2366 remains open while the Content Collection documentation-promotion launch (#2359) continues to produce lessons. Do not close #2366 until Product Authority authorizes terminal closeout for the register maintenance tranche.

## Team operating principle

LGFC is a team. Lessons must be written into GitHub Issues and repository docs before agents are expected to act on them. Chat-only decisions, Drive drafts, and agent memory are planning inputs — not operational authority.

Each major program should leave at least one reusable control for the next program.

## Prior-program lessons table

| Lesson | Source | Control adopted |
| --- | --- | --- |
| Repo docs and GitHub Issues are operational authority | Prior programs; #2359 protocol | Issue-first collaboration; `CHATGPT HANDOFF` workflow doc |
| Drive drafts are not production-ready authority | #2359 readiness assessment | Audit before promotion (#2360); intake folder non-authoritative |
| Duplicate workflow text across issues drifts terminology | #2359 launch (ChatGPT vs ChatGPT) | Centralize in `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` |
| Chat decisions not written to issues block Cursor | #2360 decision-propagation lesson | Decision propagation rule in handoff workflow |
| Handoff markers do not wake agents by themselves | #2360 queue stall; #2391 | `docs/ops/pmo/queue-watch-and-dispatch-protocol.md` |
| Predecessor closeout without successor disposition stalls queue | #2360 → #2361/#2363/#2364 | Atomic closeout template in `github-issue-closeout-protocol.md` |
| Merge with failed required pre-gate leaves hidden gate debt | PR #2373; #2376 | Post-#2380 automation + `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md` |
| ZIP intake can fail full-history audit on unrelated PRs | #2374 | Intake how-to and remediation planning separate from process visibility |
| Cloud Cursor may fail on billing limits | #2360 `@cursor` comment | Document fallback; do not assume cloud pickup |
| Lessons register should exist before launch | #2366 scope | This document (in progress while #2359 runs) |
| Docs-only ops PR closeout may fail on PR-body metadata | PR #2395 / #2376 | Pre-merge PR body hygiene + remove `status:in-progress` before merge; manual closeout when deliverable verified on `main` |

## Content Collection Phase 0 launch lessons (in progress)

Captured during #2359 documentation-promotion launch. Expand as launch continues.

### L-CC-001 — Failed pre-gate merge visibility (#2376)

**Observed:** PR #2373 merged with `ZIP History Audit (Full History)` still failed on the PR head. Post-merge automation did not initially surface an Ops issue naming the failed gate, run, job, and step.

**Impact:** Operators could believe launch proceeded cleanly while gate debt remained and future PRs stayed exposed to the same failure.

**Controls adopted:**

- Automation fix merged in PR #2380 (reference only; implementation not owned by this doc).
- Operator how-to: `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md`.
- Reference section: `docs/reference/ci/post-merge-validation-surface.md` (merged PR with failed required pre-merge check).
- Closeout rules: `docs/ops/pmo/github-issue-closeout-protocol.md`.
- Dispatcher trigger: `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`.

**Still open:** Root-cause ZIP remediation (#2374). Verify post-#2380 automation on the next merge-with-exception case.

### L-CC-002 — Separate process visibility from root-cause remediation

**Observed:** #2376 (process gap) and #2374 (ZIP artifact) were at risk of being conflated.

**Control:** Document three tracks — process visibility, root-cause gate failure, launch continuation — in the failed pre-gate how-to.

### L-CC-003 — #2366 must stay open during launch

**Observed:** Lessons were captured ad hoc in issue comments before this register existed.

**Control:** Append launch lessons here as they occur; link from #2366 and #2359; close #2366 only after Product Authority authorizes register maintenance complete.

### L-CC-004 — Docs-only ops PR post-merge closeout hygiene (#2376 / #2395)

**Observed:** PR #2395 merged the #2376 documentation deliverable, but Post-Merge Detection failed (`metadata=3`, `terminal_label_conflict` from `status:in-progress` on source issue). Remediation issue #2403 opened.

**Impact:** Source issue remained open with `status:failed` despite docs landing on `main`; queue appeared blocked.

**Controls adopted:**

- Phase 0 launch playbook Step 4–5: PR-body sections and label hygiene before merge.
- Drive intake how-to Step 6 gate checklist.
- Manual closeout acceptable when deliverable verified on `main` and automation gap is documented (#2403 disposition).

**Still open:** Prefer fixing PR body and labels **before** merge to avoid remediation churn.

## Open PMO improvement opportunities

| ID | Opportunity | Suggested next step |
| --- | --- | --- |
| O-001 | Phase 0 launch playbook for #2359 child chain | **Done** — `docs/how-to/ops/content-collection-phase0-launch-playbook.md` |
| O-002 | Drive-draft intake how-to with ZIP gate interaction | **Done** — `docs/how-to/ops/drive-draft-intake-and-promotion.md` |
| O-003 | Child issue template references handoff doc by path only | ChatGPT issue hygiene on #2361–#2365 |
| O-004 | Cloud Cursor billing fallback in Cursor rules | Docs PR when authorized |
| O-005 | Label automation on `CHATGPT HANDOFF` | Evaluate separately; not required for #2376 docs closeout |

## Required checkpoints

### Before launch

- [x] Lessons register exists or is explicitly in progress (#2366).
- [x] Handoff workflow doc path is canonical and referenced from program issues.
- [x] Queue watch / dispatcher procedure is identified (manual or automated).
- [x] Intake mechanics (including ZIP audit interaction) are documented or tracked as ops work.

### During execution

- [ ] Product Authority decisions are written to the relevant GitHub issue before Cursor acts.
- [ ] `CHATGPT HANDOFF` and `agent:ChatGPT` are used at review points.
- [ ] Merges with failed required pre-gates follow `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md`.
- [ ] Launch-halting defects get Ops issues, not chat-only notes.

### At closeout

- [ ] This register is updated with final program lessons.
- [ ] Controls are linked from parent program issue.
- [ ] Open improvement opportunities are filed or deferred with authority.

## Template for future programs

When starting a new LGFC program, add a row to the lessons table and answer:

1. What is the executable issue graph (not chat memory)?
2. Which repo doc owns handoff, closeout, and queue dispatch?
3. What intake or non-PR staging paths exist and how do they interact with gates?
4. What happens when merge occurs with an accepted gate exception?
5. What is the manual fallback when automation does not run?
6. What single control will the next program inherit?

## Related authorities

- Parent program: #2359
- Lessons issue (open): #2366
- Phase 0 workflow review: #2389
- Phase 0 launch playbook: `docs/how-to/ops/content-collection-phase0-launch-playbook.md`
- Drive intake how-to: `docs/how-to/ops/drive-draft-intake-and-promotion.md`
- Queue watch protocol: `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- Handoff workflow: `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`
