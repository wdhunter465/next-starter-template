---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational Authority
Owns: Cursor local and Cloud Agent session bootstrap verification
Does Not Own: Canonical governance doctrine or merge authority
Canonical Reference: /Agent.md
Related Issues: #1609, #1614, #2398, #3212, #3424
Last Reviewed: 2026-08-13
---

# Agent session bootstrap

## Goal

Verify that Cursor local and Cloud Agent sessions receive thin bootstrap routing to the mandatory documentation chain without duplicating canonical governance.

## Bootstrap surfaces

| Surface | Audience | Mechanism |
| --- | --- | --- |
| `.cursor/rules/*.mdc` | Local Composer/Agent | `alwaysApply: true` project rules |
| `AGENTS.md` | Cloud Agent | Root-level bootstrap router ([Cursor cloud setup](https://cursor.com/docs/cloud-agent/setup)) |
| `.agents/skills/*/SKILL.md` | All agents | Relevance-selected skills — **not** always-on bootstrap |

MCP servers are **not** part of session bootstrap. MCP connects external tools; project rules and `AGENTS.md` supply routing context.

`.cursor/hooks.json` is **out of scope** for bootstrap. Hooks may provide stronger enforcement in a later hardening issue.

## Procedure

### Verify local Composer/Agent bootstrap

1. Open the repository in Cursor with a **new** Agent/Composer chat.
2. Open **Cursor Settings → Rules** and confirm these project rules show **Always Apply**:
   - `00-mandatory-doc-chain`
   - `10-pr-governance-preflight`
   - `20-stop-conditions`
3. Ask the agent which documentation chain it must read before implementation; confirm it cites `Agent.md` and the shared/core/Cursor rule paths.
4. Run `node .agents/checks/agent-governance-check.mjs .` — expect **PASS**.

### Verify Cloud Agent bootstrap

1. Start a **new** Cloud Agent session from a branch containing this bootstrap work.
2. Ask the agent to report which bootstrap rules or `AGENTS.md` instructions it loaded **before doing anything else**.
3. Confirm the first bootstrap report marks each canonical file as **read** (not "required but not yet read"):
   - AGENTS.md: read
   - Agent.md: read
   - SHARED-AGENT-RULES.md: read
   - CORE-RULES.md: read
   - CURSOR-RULES.md: read
4. For PR work, confirm the first bootstrap report also marks:
   - lgfc-pr-governance/SKILL.md: read
   - .github/pull_request_template.md: read
   - docs/how-to/cursor/open-task-pr.md: read
5. Confirm the agent stops when no source issue or allowlist is provided.
6. If Cloud verification is unavailable, document the limitation and open a follow-up issue.

A Cloud Agent bootstrap test **fails** when the first response lists canonical files as required but not yet read.

### Verify CI guardrails

```bash
node .agents/checks/agent-governance-check.mjs .
npm test -- tests/agent-governance-bootstrap.test.mjs
```

Both commands must pass before marking the PR ready for review.

## Related procedures

- Cursor Local environment and agent runbook (restart without chat memory): [`local-environment-and-agent-runbook.md`](./local-environment-and-agent-runbook.md)
- Primary Cursor local auto-start (dispatch runner): [`../ci/configure-lgfc-cursor-dispatch-runner.md`](../ci/configure-lgfc-cursor-dispatch-runner.md)
- Runtime routing standard: [`../../governance/standards/CURSOR-RUNTIME-ROUTING.md`](../../governance/standards/CURSOR-RUNTIME-ROUTING.md)
- Cursor Local Bridge configure (superseded/decommissioned): [`configure-cursor-local-bridge.md`](./configure-cursor-local-bridge.md)
- Local GitHub poll-wake loop (retired execution dependency; archive only): [`github-poll-wake-loop.md`](./github-poll-wake-loop.md)

## Execution

Record local and cloud verification results in the PR body under **BUILD / TEST / VERIFICATION**.
