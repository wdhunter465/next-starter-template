---
Doc Type: Governance Standard
Audience: Human + AI
Authority Level: Binding
Owns: LGFC Cursor runtime selection, local-versus-cloud invocation boundary, assignment runtime metadata, and local resume routing
Does Not Own: Cursor product configuration, local poller implementation, implementation scope, merge approval, or cloud billing
Canonical Reference: /Agent.md
Related Issues: #2477, #2489, #2667, #2997, #3013, #3212
Last Reviewed: 2026-08-09
---

# Cursor Runtime Routing

## Purpose

Define which Cursor runtime may execute LGFC repository work and prevent local execution instructions from accidentally invoking Cursor Cloud.

## Default runtime

LGFC implementation defaults to:

```text
Runtime: local
```

A source issue may select one of these stable values:

```text
Runtime: local
Runtime: cloud
Runtime: either
```

`cloud` or `either` requires explicit authorization in the source GitHub issue from Bill or Chat. Runtime must not be inferred from labels, branch names, prior sessions, or agent availability.

## Invocation boundary

`@cursor` is a Cursor Cloud invocation. It is prohibited for local LGFC work.

Local Cursor routing uses the following eligibility signal — labels and status only, no comment-marker protocol (#3013):

- source issue label `agent:cursor`;
- source issue label `handoff:ready`;
- issue is open and not already carrying an already-handed-off status label (`status:review`, `status:complete`, `status:post-merge-verify`).

There is no required resume/response comment. Comments are ordinary context Cursor reads after launch; they carry no routing or gating authority.

**Primary local transport (auto-start, #3212 Phase 4):** GitHub Actions `lgfc-cursor-dispatch` on the dedicated Chromebook runner labeled `lgfc-cursor` invokes the fixed identifiers-only wrapper (`scripts/lgfc-cursor-dispatch/dispatch.mjs`), which launches authenticated local `cursor agent` / `agent`. Contract: `config/github-actions/cursor-dispatch-runner.json`. How-to: `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`. Independent offline observation: `.github/workflows/lgfc-cursor-runner-health.yml`.

**Retired as execution dependencies (#3212 Phase 4):** Cursor Local Bridge automatic wake-packet delivery, scheduled Bridge watch, and the local 12-minute poll-wake loop. Shared ingress predicate `scripts/cursor-bridge/lib/wake-ingress.mjs` remains in use by the dispatch workflow and must not be deleted with the Bridge package.

**Approved diagnostic fallback only:** trusted manual `workflow_dispatch` on the retired wake workflow (confirmation `CURSOR_WAKE_DIAGNOSTIC`, actor `wdhunter645`), or explicit Product Authority re-enablement. Do not treat poll-wake or Bridge auto-start as primary.

Labels are the durable routing signal. They do not prove that a local Cursor process is running and must not be described as an automatic cloud invocation.

## Assignment requirement

Every Cursor assignment must declare `Runtime: local | cloud | either`.

For LGFC work:

- omitted runtime is invalid;
- `local` is the default selection;
- `cloud` or `either` requires explicit issue authorization;
- a runtime change requires a new GitHub-recorded decision before execution continues.

## Local authority sources

Local Cursor resumes from repository-controlled state, not chat memory. The detailed procedures are:

- `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md` (primary auto-start)
- `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` (this standard)
- `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`
- `docs/reference/ci/cursor-local-bridge-contract.md` (retired primary; historical Bridge contract)
- `docs/how-to/cursor/github-poll-wake-loop.md` (retired execution dependency; diagnostic archive)

If a procedure conflicts with this standard, this standard controls runtime selection and the procedures must be corrected.

## Prohibited behavior

Do not:

- use `@cursor` to start, resume, revise, or remediate local LGFC work;
- treat a cloud-agent acknowledgement as evidence that the local agent is active;
- switch an assignment from local to cloud because local execution is delayed;
- invent an additional comment-marker gate on top of labels/status — labels and status are the sole execution authorization (#3013);
- rely on chat-only instructions for local resume.

## Exception path

Cloud execution may be used only when the source issue explicitly states:

```text
Runtime: cloud
Cloud authorization: Bill | Chat — <issue comment reference>
```

The issue must also define cost/resource expectations, branch, allowed paths, validation, and review authority. A cloud exception does not become the default for successor work.

## Verification

For agent-authority or assignment-template changes:

1. Confirm the assignment contains exactly one Runtime field.
2. Search active authority for `@cursor`.
3. Retain `@cursor` only where it is explicitly identified as prohibited, historical, or cloud-only.
4. Confirm local instructions rely on `agent:cursor` + `handoff:ready` labels and status only — no comment-marker requirement.
5. Run repository documentation-header and DIATAXIS checks.
