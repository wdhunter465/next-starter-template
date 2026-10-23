---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Live implementation sequencing, task status, thread execution map
Does Not Own: Design specifications or final architecture decisions
Canonical Reference: /docs/ops/pmo/CURRENT-STATE.md
Last Reviewed: 2026-10-23
---

The recovery-era plan is archived at `docs/archive/superseded/ops/trackers/LGFC-REPO-RECOVERY-AND-IMPLEMENTATION_PLAN.md` (#4138, 2026-10-23). This worklist is the live sequence.

Thread Closeout Log:
/docs/ops/trackers/THREAD-LOG_Master.md

# IMPLEMENTATION-WORKLIST_Master.md

Location (authoritative):
/docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md

Purpose:

Day-1 execution map with one-task / one-thread discipline, PR-driven execution control, active sequencing for website implementation, and Day 2 repository operations.

---

# Operating Rules

- One task = one thread.
- Fresh repository ZIP at thread start for repo-specific work when ZIP-based verification is the assigned workflow.
- Normal implementation work closes through the source GitHub issue and pull request lifecycle.
- Routine tracker-update PRs are not required for normal implementation work.
- Tracker/status-index updates are required only when the source issue explicitly authorizes tracker governance, tracker reconciliation, or status-index maintenance.
- No mixed intent inside a task unless the task explicitly allows it.
- No regressions.
- No case-sensitive duplicate folders or files.
- Authorized tracker updates must be append-preserving and must not discard historical entries.

---

# Regression Checklist

Run when a task touches shared UI, routing, auth, or layout:

- Header links work on Home and at least 3 other public pages.
- Logo routes to `/`.
- Footer links match locked design authority.
- `/fanclub/**` redirects to `/` when logged out.
- Cloudflare build succeeds.
- Home page renders without obvious layout breakage.

---

# Current Status Snapshot — 2026-03-18

## Phase 1 — Documentation Stabilization
Status: COMPLETE
Notes:
- LGFC-Production-Design-and-Standards.md remains the sole design authority.
- Core documentation stabilization work is complete.
- Tracker files require recovered historical continuity after the 2026-03-16 overwrite incident.

## AI governance files
Status: COMPLETE
Notes:
- `/Agent.md` present as agent entry/control file.
- `/docs/ops/ai/SHARED-AGENT-RULES.md` present (shared agent law index; PR #1269).
- `/docs/ops/ai/CORE-RULES.md` present (detailed shared execution rules).
- `/docs/ops/ai/CODEX-RULES.md` present (Codex-specific rules; PR #1269).
- `/docs/ops/ai/CURSOR-RULES.md` / cursor rules governance present in repo history and operational use.
- `/docs/ops/ai/CHATGPT-RULES.md` present (ChatGPT control-plane rules; PR #1263 / #1269).
- Erroneous duplicate folder `docs/ops/AI/` was removed during cleanup.
- Cursor YAML / review workflow update is being handled in PR #544.
