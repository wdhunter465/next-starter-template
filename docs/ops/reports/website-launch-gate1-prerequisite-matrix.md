---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: Gate 1 ("Clear the actual launch blocker") prerequisite reconciliation for the Website Launch Completion gated sequence WORK defined on 2026-08-10, covering #2859 → #2780, #2784/#2920, #2860, and #2926; the authorization packet for the one identified next protected action
Does Not Own: Gate 2 (#2928/#2929 rehearsal execution) or Gate 3 (#2930/#2931 Production qualification) — both explicitly out of scope until Gate 1 passes; any Production action, credential use, or protected CI path change; the #2780/#2784/#2859 acceptance decisions themselves (Product Authority / WORK)
Source Issue: #2780
Canonical Reference: /docs/ops/reports/website-launch-gate1-prerequisite-matrix.md
Related Issues: #2859, #2780, #2781, #2784, #2920, #2860, #2926, #2778, #2779, #2785, #3268, #2913, #3277, #3280
Last Reviewed: 2026-08-10
Executor: Claude Code
---

# Website Launch Completion — Gate 1 prerequisite matrix and authorization packet

## Purpose

WORK's 2026-08-10 instruction directs the remaining website launch work as one
gated completion sequence (Gate 1 → Gate 2 → Gate 3, hard stop before
Production). This report is Gate 1: "Clear the actual launch blocker." It
reconciles the real prerequisite state around #2859 → #2780, plus
#2784/#2920, #2860, and #2926, into one matrix, and — because the identified
next executable step still touches protected CI paths — stops at that
boundary with an authorization packet rather than building it.

It performs no Production action, requests no credential, and does not
create or modify any protected `.github/workflows/**` or `scripts/ci/**`
file. It starts from PR #3280's evidence (X-10/#2858 resolved; #2859 still
has 4 outstanding acceptance criteria; #2780 HOLD) rather than repeating
that investigation.

## Scope

Covers Gate 1 only: the prerequisite matrix (Section 1), the per-item
analysis WORK requested (Sections 2–6), and the authorization packet
(Section 7). It does not touch Gate 2 (#2928/#2929) or Gate 3
(#2930/#2931), and explicitly does not execute, build, or authorize the
protected action it identifies.

## Current known truth

- PR #3280 (merged) confirmed X-10's release condition ("#2858 ACCEPT") is
  met via #2858's own closeout comment, but this did not change any of
  #2859's 9 acceptance criteria — 4 remain outstanding.
- #2780's own `Entry Gate` field reads "#2859 completed and accepted." That
  gate is unmet. This report treats that HOLD as authoritative, not stale.
- #2779 (backup/recovery project) is **closed/complete as a GitHub Issue**
  (2026-08-04), which satisfies every downstream project's literal
  "#2779 completed and accepted" entry-gate text (#2784's own entry gate is
  exactly that). But the *actual deliverable* is a synthetic simulation
  against a disposable local `node:sqlite` database with fabricated fixture
  data (`scripts/ci/platform-recovery-d1-b2-isolation.mjs`,
  `component/platform-recovery-readiness`, never promoted to `main`),
  self-documented as "not a live Production D1 export." Bill's own 2026-08-10
  comment creating #3268 states plainly this gap is real and "does not waive
  the missing backup/restore proof." **This is the root cause behind #2859
  criterion 3, part of criterion 4/7, and #2860's Production write** — a
  closed Issue number does not mean the underlying capability exists.

## 1. Gate 1 prerequisite matrix

| Requirement | Authoritative Issue/evidence | Status | Exact action | Owner |
| --- | --- | --- | --- | --- |
| Real D1 backup/restore capability | #2779 (closed, but deliverable is synthetic-only); #3268 (created 2026-08-10, queued not active) | **PROTECTED / OUTSTANDING** (issue closed; capability does not exist) | Authorize and build real `wrangler d1 export`/Time Travel backup+restore proof under #3268 | Bill/WORK (authorization), Implementation (build) |
| #2858/X-10 accessibility-responsive contract evidence | `issuecomment-5226863778` ("ACCEPT / COMPLETE"); PR #3280 | **SATISFIED** | None | — |
| #2859 criterion 1 (route/component content requirement + owner) | #2906 matrix | **SATISFIED** | None | — |
| #2859 criterion 2 (present/missing/approval/deferred/blocked classification) | #2906 matrix; #2909 QA record | **SATISFIED** | None | — |
| #2859 criterion 3 (D1/B2 population via approved workflows) | #2908 (batch schema/harness only — no execution) | **OUTSTANDING — Production action** | Execute an approved batch once credentials + real backup proof exist | Bill/WORK (authorize), Editorial (source content), Implementation (execute) |
| #2859 criterion 4 (attribution/rights/privacy/links/dates/fallback verified) | #2909 §1 (6 of 26 rows fallback-verified); rest unverifiable against nonexistent content | **PARTIALLY SATISFIED — rest blocked on criterion 3, plus Product/Legal decision (P-22/P-23)** | Same as criterion 3, plus Legal review of Privacy/Terms body | Same + Legal/Bill |
| #2859 criterion 5 (no placeholder/broken media/empty section/stale copy) | Depends on real content existing | **OUTSTANDING — read-only verification, blocked on criterion 3** | Verify once content exists | Implementation, blocked on #3 |
| #2859 criterion 6 (search/nav expose only approved content) | Depends on real content existing | **OUTSTANDING — read-only verification, blocked on criterion 3** | Verify once content exists | Implementation, blocked on #3 |
| #2859 criterion 7 (Preview + Production evidence recorded) | None produced yet | **OUTSTANDING, split** — Preview half: **PROTECTED** (candidate action below); Production half: same as criterion 3 | Preview: build+run the read-only preflight (Section 7). Production: same as criterion 3 | Bill/WORK (authorize), Implementation (build/execute) |
| #2859 criteria 8, 9 (no paid service; Day-2 procedure recorded) | PR #3277 §2 | **SATISFIED** | None | — |
| #2780 entry gate ("#2859 completed and accepted") | The 4 outstanding #2859 items above | **OUTSTANDING — HOLD stands** | Cannot be marked satisfied while criteria 3/4(remainder)/5/6/7 remain open | Bill/WORK (final acceptance, once #2859 closes) |
| #2784 project acceptance (cited in #2781's own entry-criteria list as "#2784 compliance") | #2920 comments; WORK's 2026-08-05 disposition ("PMO-blocked, not active" for the remainder) | **OUTSTANDING, but explicitly deferred-with-owner, not silently dropped** | Same root causes as #2859: (a) live Production/D1 `page_content` verification needs credentials; (b) Bill's accessibility-statement wording approval | Bill (wording), Bill/WORK (credential authorization) |
| #2860 Production migration write | #2860 body "As-built decision": dual-read fallback already safe and shipped; not named in #2781's own entry-criteria list | **NOT LAUNCH-CRITICAL** (classified this pass) | None required for rehearsal; remains a valid post-rehearsal completion item under its own #2779/#3268-gated authorization | Product Authority (future scheduling only) |
| #2926 real entry-criteria record | PR #3236 (merged) — schema + harness only; PR body states verbatim "no real entry-criteria record exists yet" | **OUTSTANDING** | Cannot be produced until #2780 is accepted (candidate identity + monitoring-readiness depend on it) and #2784's remaining items receive their own deferred-with-fallback citation | Implementation, blocked on #2780/#2784 |

## 2. #2858/X-10 — confirmed resolved, no re-litigation

Per WORK's instruction, this is treated as resolved per PR #3280's live
citation (`issuecomment-5226863778`, "Disposition: ACCEPT / COMPLETE").
No new evidence has surfaced since that changes this. Not re-investigated
here.

## 3. #2859's 4 remaining acceptance criteria — exact classification

| Criterion | Requires |
| --- | --- |
| 3 — D1/B2 population | Production action + credential authority + real backup/recovery proof (privacy/security/cost-adjacent: none of these are paid, but the backup gap is a real security/recoverability boundary) |
| 4 (remainder) — attribution/rights/privacy verification | Same Production-population dependency, **plus** a Product/Legal decision (P-22 Privacy attorney review, P-23 Terms attorney review) |
| 5 — no placeholder/broken media/stale copy | Read-only verification, but only possible after criterion 3 lands |
| 6 — search/nav expose only approved content | Read-only verification, but only possible after criterion 3 lands |
| 7 — Preview + Production evidence recorded | **Splits**: Preview half is a genuinely new, credential-scoped, read-only Preview action (does not need the backup proof — Preview state isn't the durable Production record #2779/#3268 protects); Production half needs the same Production action + credential + backup proof as criterion 3 |

None of the 4 outstanding criteria are pure repository-implementation work
still waiting to be written — #2908 already delivered the batch-plan
schema/validator. What remains is (a) a Production write requiring
credentials this sandbox does not have and a backup proof that does not yet
exist, (b) a Product/Legal decision, and (c) verification steps that are
mechanically blocked on (a).

## 4. #2780 — HOLD confirmed, not reinterpreted

#2780's entry gate is unmet. This is not stale administrative state — it is
the direct, current consequence of #2859's real outstanding criteria
(Section 3). **#2780 stays HOLD.**

## 5. #2784/#2920 — deferred-with-owner, not a silent gap, not a new blocker

#2920's remaining items (Privacy/Terms copy verification, GA disclosure,
accessibility statement) are blocked on exactly the same two root causes as
#2859: live Production/D1 credential access, and a Bill-owned wording
decision (the accessibility statement). WORK's own 2026-08-05 disposition
on #2920 explicitly accepted the completed first increment and classified
the remainder as "PMO-blocked, not active" — an explicit, accepted
deferral, not a silently dropped requirement. This satisfies #2781's own
"any intentionally deferred item must have an approved fallback and cannot
be silently omitted" rule in spirit, but the *formal* citation of that
deferral inside #2926's real entry-criteria record has not been written yet
(because that record doesn't exist yet — Section 1). **#2784/#2920 does not
introduce a new, distinct blocker** — it is the same credential/Product-decision
gap surfacing in a second project. No unrelated compliance work is being
promoted onto the critical path.

## 6. #2860 — not launch-critical (classified this pass)

#2860's own body states the current Library route "already prefers
published, attributed `content_inventory` records and falls back to
`library_entries` when no eligible canonical records exist" — that dual-read
fallback is already shipped and safe, and #2860's remaining work (the actual
Production backfill write) has not touched it. #2781's own "Entry criteria"
list (#2778, #2779, #2780, #2783, #2784, #2785, #2786, #2787, #2776/#2777)
does not name #2860. **Classification: #2860 is not launch-critical.** Its
Production migration remains a valid future completion item once
#2779/#3268's real backup proof exists, but it does not block Gate 1, Gate
2, or Gate 3. No additional #2860 work is being done "merely because the
parent remains Active."

## 7. #2926 — merged scaffolding vs. real evidence still needed

PR #3236 (merged, `component/launch-rehearsal`) delivered
`scripts/ci/launch_rehearsal_entry_criteria.mjs`,
`tests/launch-rehearsal-entry-criteria.test.mjs`, and
`docs/ops/reports/launch-rehearsal-entry-criteria-2926.md` — a **record
schema and a deterministic readiness harness only**. The PR's own body
states verbatim: "#2780's monitoring project is not yet accepted, so this is
entry-criteria reconciliation and automation scaffolding only — **no real
entry-criteria record exists yet**." #2926 remains open, labeled
`status:queued`.

**What exists:** the mechanism that will validate a real record once one is
written (every criterion must be `satisfied`-with-evidence or
`deferred`-with-owner-and-release-condition, or the harness fails closed).

**What does not exist yet:** the actual record — real candidate SHA (not
assignable until Gate 1 passes and the candidate freezes, per WORK's own
instruction), real isolated environment identity, real synthetic/redacted
test-data plan, and real per-dependency dispositions for #2778 (satisfied,
closed), #2779 (protected — see Section 1 root-cause row), #2780 (HOLD),
#2783 (not reviewed this pass — out of Gate 1's named scope), #2784
(deferred-with-owner, Section 5), #2785 (satisfied, closed), #2786/#2787
(not reviewed this pass — out of Gate 1's named scope). Building that real
record is #2926's actual remaining acceptance criterion, and it cannot
honestly happen until #2780 is accepted.

## 8. Minimum-safe-action analysis — the Preview preflight does NOT unblock #2780

WORK asked whether the previously-identified read-only Preview D1/B2
preflight (modeled on #2913) is "the minimum safe action that can resolve
enough #2859 evidence to advance #2780." **Answer: it is the correct next
candidate action, but it is explicitly not sufficient to advance #2780 by
itself**, and this report will not overstate it:

- It would resolve only the **Preview half** of criterion 7 — one sub-part
  of one of #2859's 5 non-fully-satisfied criteria.
- Criteria 3, 5, 6, criterion 4's remainder, and criterion 7's Production
  half all remain blocked on the real Production credential + real
  #2779/#3268 backup proof, which the preflight does not provide (a
  read-only Preview check cannot substitute for Production write
  authorization or backup proof).
- Therefore, **even after the preflight runs successfully, #2859 would
  still have 3 fully outstanding criteria (3, 5, 6) and 1 partially
  outstanding criterion (4) — #2780's entry gate would still be unmet.**

It remains worth doing because it is genuine, real, incremental evidence
toward criterion 7 and reduces risk before any future Production
population — but Bill/WORK should authorize it knowing it does not clear
Gate 1 by itself. The actual Gate-1-clearing action is resolving the
#2779/#3268 backup proof and Production credential path for criterion 3,
which is a larger, separately-scoped decision (Section 1's root-cause row)
that this report is not authorized to build or schedule.

## 9. Authorization packet — read-only Preview D1/B2 preflight for #2859

**Exact proposed change/action:** Add a secret-backed, `workflow_dispatch`-gated
CI workflow that performs a real, read-only check of the Preview D1/B2
binding (schema presence / row-count style check, modeled on
`scripts/ci/production_d1_preflight_2913.mjs` and
`.github/workflows/library-content-production-preflight-2913.yml`, both on
`main`) against `component/production-content-readiness`'s content surfaces,
and posts the result as durable evidence in a new
`docs/ops/reports/production-content-preview-preflight-<issue>.md`-style
report.

**Exact protected CI paths affected:**
- New file under `.github/workflows/**` (protected path per
  `delivery_profile.mjs` `PROTECTED_PATTERNS`)
- New file under `scripts/ci/**` (protected path)
- Both require `Approval profile: protected-change-review` (Chat/Bill
  review), not `component-auto-integration`.

**Why it is necessary:** it is the only identified way to produce real
(not fabricated) evidence toward #2859 acceptance criterion 7 ("Preview...
evidence is recorded") without requiring the #2779/#3268 backup gap to
close first, since Preview data is not the durable Production record that
gap protects.

**Confirmation execution is read-only against Preview:** yes — schema/
row-presence check only; no `INSERT`/`UPDATE`/`DELETE`; no write of any
kind; never targets Production (mirrors #2913's `--local`/`--remote`
refusal pattern already proven in `scripts/migrations/library-content-backfill.mjs`).

**Data/binding/credential boundary:** consumes the Preview D1/B2 binding's
existing secret only at GitHub Actions runtime (never exposed to this
sandbox or any agent session); no new secret is created; no private member
data is read (schema/count-level check only, same evidence class as
#2913's precedent).

**Expected evidence produced:** a timestamped report recording environment
identity, binding identity, checked-at timestamp, and read-only result
(e.g., table/column presence, row counts) — no content bodies, no
credentials.

**Stop/failure conditions:** authentication failure, unexpected schema
drift, any indication the binding resolves to Production rather than
Preview, or any need to write — all fail closed with no mutation attempted.

**Rollback/reversion plan for any repository changes:** the workflow and
script are additive-only and independently revertible via a normal PR
revert; they do not modify any existing file, schema, or binding.

**Recommendation: GO**, with the explicit caveat from Section 8 — this
authorizes evidence-gathering that improves #2859's record but does **not**
by itself satisfy #2780's entry gate. Gate 1 remains HOLD either way until
the Production-population blocker set (Section 1's root-cause row) is
separately resolved.

## Acceptance checklist (this report)

- [x] Matrix covers every item WORK named (#2859→#2780, #2784/#2920, #2860,
      #2926) plus the #2779/#3268 root-cause row that explains most of them.
- [x] #2858/X-10 treated as resolved, not re-investigated.
- [x] #2780 HOLD treated as authoritative, not stale.
- [x] #2860 explicitly classified not-launch-critical with cited reasoning,
      not left ambiguous.
- [x] #2926's merged scaffolding is distinguished from its still-missing
      real record.
- [x] The Preview preflight's actual, limited impact is stated honestly —
      it does not oversell resolution of #2780's gate.
- [x] No protected CI path was created or modified by this report; the
      authorization packet stops at the boundary per WORK's instruction.

## Rollback (of this report)

Documentation-only. Revert via normal reviewed PR path if found inaccurate;
makes no code, schema, workflow, or Production state change.
