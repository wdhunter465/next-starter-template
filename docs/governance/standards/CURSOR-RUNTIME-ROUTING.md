---
Doc Type: Governance Standard
Audience: Human + AI
Authority Level: Binding
Owns: LGFC Cursor runtime selection, local-versus-cloud invocation boundary, assignment runtime metadata, and local resume routing
Does Not Own: Cursor product configuration, local poller implementation, implementation scope, merge approval, or cloud billing
Canonical Reference: /Agent.md
Related Issues: #2477, #2489, #2667, #2997, #3013, #3212, #3424, #3605, #3611, #4296, #4311
Last Reviewed: 2026-09-22
---

# Cursor Runtime Routing

## Purpose

Define which Cursor runtime may execute LGFC repository work and prevent local execution instructions from accidentally invoking Cursor Cloud.

## Scope

In scope: local versus cloud invocation, label routing, auto-start versus in-session awareness, and what counts as evidence that Cursor is actually receiving GitHub state.

Out of scope: Chromebook sleep policy, creating the `CURSOR_RUNNER_HEALTH_TOKEN` GitHub secret, runner-scoped Cursor API keys, and host watchdog implementation (host-side items on #4296; secret provisioning is Product on #4311).

## Current known truth

Two local transports exist and they do different jobs (#4296):

1. **In-session awareness (open Composer Agent chat):** the 1-minute loop from `~/.cursor/lgfc-always-on-loop.sh` must run **inside that chat** with `notify_on_output` on `^AGENT_LOOP_TICK_lgfc_always_on`. Bind with `~/.cursor/lgfc-wake-ctl.sh rebind --session "$CURSOR_CONVERSATION_ID"`. Bare `bind` does not steal a named live session. A systemd/`nohup` loop writing `/tmp/lgfc-always-on-loop.log` can be `poller_ok` while remaining `composer_inject_ok=false`.
2. **Cold auto-start (no live Composer session):** GitHub Actions `lgfc-cursor-dispatch` on runner label `lgfc-cursor` still launches identifiers-only `agent -p`. That starts a **new** Agent in the runner worktree. It does not inject into an already-open Composer chat. Dispatch preflight must round-trip `agent -p`; `agent status` is not sufficient (#4296).

`lgfc-cursor-runner-health.yml` must stay parse-valid GitHub Actions YAML. `permissions:` must not declare `administration` (invalid key; HTTP 422; empty-job failure on every push — #4311). `GITHUB_TOKEN` cannot call `listSelfHostedRunnersForRepo`. ONLINE/OFFLINE observation uses repository secret `CURSOR_RUNNER_HEALTH_TOKEN` (fine-grained PAT or GitHub App with Administration: Read). If that secret is absent, the job must succeed with `AUTH_NOT_CONFIGURED` and must not claim OFFLINE.

## Intended final state

Operators use the Composer loop for awareness in a live local session, and dispatch only to spawn Cursor when no such session exists. Docs, dispatch preflight, and runner health agree on that split. Runner-health failures mean OFFLINE/UNREGISTERED or AUTH_DENIED, never an unparseable workflow file. Host sleep, Cursor API-key storage, and creating `CURSOR_RUNNER_HEALTH_TOKEN` remain operator items (#4296 / #4311).

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

**Primary local auto-start (no live Composer session, #3212 Phase 4 / #4296):** GitHub Actions `lgfc-cursor-dispatch` on the dedicated Chromebook runner labeled `lgfc-cursor` invokes the fixed identifiers-only wrapper (`scripts/lgfc-cursor-dispatch/dispatch.mjs`), which launches authenticated local `cursor agent` / `agent` after an `agent -p` round-trip preflight. Contract: `config/github-actions/cursor-dispatch-runner.json`. How-to: `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`. Independent offline observation: `.github/workflows/lgfc-cursor-runner-health.yml`.

**Primary in-session awareness (live Composer Agent chat, #3605 / #3611 / #4296):** the 1-minute GitHub poller loop bound to `CURSOR_CONVERSATION_ID` with Composer `notify_on_output`. This is how PR gate failures, merges, and review comments reach an already-open chat. It is not a substitute for dispatch when no chat exists.

**Decommissioned (#3424):** Cursor Local Bridge is not an operationally supported primary local auto-start path. Host Bridge units stay stopped unless Product Authority authorizes temporary diagnostics.

**Not Composer awareness (#3212 Phase 4 / #4296):** automatic Bridge wake-packet delivery, scheduled Bridge watch, and a systemd/`nohup` poll-wake loop that only writes a logfile. Shared ingress predicate `scripts/cursor-bridge/lib/wake-ingress.mjs` remains in use by the dispatch workflow and must not be deleted with the Bridge package.

**Abandoned as a connection type (#3347 / #3340):** the non-AI `scripts/lgfc-event-wake` outbound poller / event-wake bridge prototype. Do not operate it as the Local pager. Historical reference only: `docs/reference/ci/event-wake-bridge-3340.md`.

**Approved diagnostic fallback only:** trusted manual `workflow_dispatch` on the retired wake workflow (confirmation `CURSOR_WAKE_DIAGNOSTIC`, actor `wdhunter465`), or explicit Product Authority re-enablement. Do not treat Bridge auto-start as primary. Do not treat a logfile-only poller as proof the Composer chat is awake.

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

- `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md` (primary auto-start when no Composer session exists)
- `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` (this standard)
- `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`
- `docs/reference/ci/cursor-local-bridge-contract.md` (decommissioned; historical Bridge contract)
- `docs/how-to/cursor/github-poll-wake-loop.md` (historical poll-wake archive; live Composer awareness is the always-on loop bound to this chat, #4296)

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
