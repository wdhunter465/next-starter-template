---
Doc Type: How-To
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Operational Authority
Owns: Local Cursor GitHub poll-wake loop operation, watch rules, wake semantics, pickup evidence, and known reliability limits
Does Not Own: Poller script implementation in `~/.cursor/github-poller/`, merge authority, GitHub webhook configuration, or cloud agent billing
Canonical Reference: /docs/how-to/cursor/agent-session-bootstrap.md
Related Issues: #2398, #2492, #2667, #3212, #3424
Last Reviewed: 2026-08-13
---

# Cursor local GitHub poll-wake loop

## Status (#3212 Phase 4 / #3424)

**Retired as an execution dependency.** Do not run `poll-wake-loop.sh` as part of normal LGFC Cursor wake. Cursor Local Bridge is **decommissioned** and is not a fallback that reactivates this loop. Primary transport is `lgfc-cursor-dispatch` (`docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`). Restarting this loop requires an explicit Product Authority decision.

Host marker: `~/.cursor/github-poller/RETIRED-3212-PHASE4.txt`.

## Purpose

Archive the **legacy** local Cursor GitHub poll-wake operation formerly used as backup when Bridge auto-start was primary. That Bridge path is decommissioned (#3424).

## Scope

Covers operator behavior for `~/.cursor/github-poller/` while working in `wdhunter465/next-starter-template`. The scripts are user-local tooling and are not part of the repository tree.

## Current known truth

- **Primary path (#3212 Phase 4):** `lgfc-cursor-dispatch` → dedicated `lgfc-cursor` runner → identifiers-only wrapper → local Cursor CLI.
- **Cursor Local Bridge is decommissioned (#3424).** Bridge packet wake and this poller remain retired as execution dependencies.
- Historical poller behavior (below) is retained only for forensic/operator archive reference.

## Components

| Path | Role |
| --- | --- |
| `~/.cursor/github-poller/poll-github.mjs` | Single poll through `gh`; emits JSON |
| `~/.cursor/github-poller/poll-wake-loop.sh` | Repeating poll and wake wrapper |
| `~/.cursor/github-poller/poll-loop.sh` | Alert-only loop |
| `~/.cursor/github-poller/state.json` | Saved watermark and seen-event state |
| `~/.cursor/github-poller/poll-errors.log` | Recommended persistent failure log |
| `~/.cursor/github-poller/README.md` | Local operator reference |

## Detection rules

`poll-github.mjs` treats an item as new only when its update time is later than `state.since` and it matches one of these rules:

| Trigger | Rule |
| --- | --- |
| Cursor handoff queue | Open issue labeled `agent:cursor` **and** `handoff:ready` |
| Assigned issue | Open issue assigned to `GITHUB_POLL_LOGIN` (default `wdhunter645`) |
| Assigned PR | Open PR assigned to `GITHUB_POLL_LOGIN` |

The preferred routing bundle uses all available paths:

1. Open source issue.
2. `agent:cursor` + `handoff:ready`.
3. Assign source issue to `wdhunter645`.
4. If revising a PR, assign the open PR to `wdhunter645`.
5. Post exactly one canonical `CHATGPT RESPONSE` or `CHATGPT CLOSEOUT` on the source issue.
6. Post exactly one separate `LOCAL CURSOR RESUME` on the source issue referencing that response.

## What the poller does not reliably detect

- Issues missing either required wake label.
- PR-only review comments on unassigned PRs.
- `agent:ChatGPT` issues unless another watch rule matches.
- A comment whose parent issue/PR is not in a watched class.
- Activity older than the saved watermark.
- Chat-only instructions.

## Loop behavior

`poll-wake-loop.sh [minutes]` accepts intervals from 2 through 12 minutes and defaults to 5.

1. Run `node poll-github.mjs`.
2. On success with `fresh: 0`, remain silent.
3. On success with `fresh > 0`, emit the agent wake line.
4. On failure, emit a failure message and persist stderr to `~/.cursor/github-poller/poll-errors.log`.

Expected wake output:

```text
AGENT_LOOP_TICK_github_poll {"fresh":N,"prompt":"..."}
```

A wake means qualifying activity was detected. It does not authorize merge, broaden scope, or prove execution started.

## Required marker alignment

The poller prompt and local README must recognize the live markers:

- `CHATGPT HANDOFF`
- `CHATGPT RESPONSE`
- `CHATGPT CLOSEOUT`
- `LOCAL CURSOR RESUME`

Legacy `### AGENT HANDOFF` may be accepted only as an alias during local migration. It must not remain the sole marker named in the prompt.

After a wake, Cursor must:

1. Open the qualifying source issue.
2. Read the latest canonical Chat response.
3. Read the separate `LOCAL CURSOR RESUME` referencing that response.
4. Verify branch, PR, labels, open issue state, and one bounded action.
5. Perform that action only.
6. Return canonical `CHATGPT HANDOFF` when review, blocker, PR-ready, or completion state is reached.

## Procedure

From a terminal:

```bash
~/.cursor/github-poller/poll-wake-loop.sh 5
```

Before starting:

```bash
gh auth status
pgrep -af poll-wake-loop
```

Operational rules:

- Keep one local Cursor agent chat open.
- Run only one poll-wake loop.
- Start the loop with full local permissions.
- Stop with Ctrl+C in the terminal running the loop.
- Reset the watermark only when deliberately replaying current activity:

```bash
rm ~/.cursor/github-poller/state.json
```

Do not pulse labels by default. Removing and re-adding `handoff:ready` is a recovery action only after confirming the issue is eligible, the loop is running, the canonical transaction exists, and the prior activity may have fallen behind the watermark. Record the reason in the issue.

## Failure handling

The loop is best-effort, not a guaranteed notification bus.

| Outcome | Meaning | Required response |
| --- | --- | --- |
| `fresh: 0` | Poll succeeded; no qualifying new activity | No action |
| `fresh > 0` | Qualifying activity detected | Read canonical issue transaction |
| `poll failed` | Poll did not complete | Inspect `poll-errors.log`; do not interpret as idle |
| Wake with no valid transaction | Detection worked but routing is malformed | Post canonical `CHATGPT HANDOFF` with `Status: blocked` |
| Valid transaction with no later Cursor evidence | Pickup not proven | Dispatcher re-checks eligibility and loop health |

Recommended loop wrapper behavior:

```text
append poll stderr and timestamp to ~/.cursor/github-poller/poll-errors.log
preserve the existing wake output contract
avoid discarding stderr with 2>/dev/null
```

## Verification

When this how-to changes, record:

```bash
gh auth status
node ~/.cursor/github-poller/poll-github.mjs
bash scripts/ci/docs_check_headers.sh
```

Expected:

- poll JSON contains `"ok":true` and `"fresh":0` or `"fresh":N`;
- active prompt names the live markers;
- failure logging is enabled locally;
- repository documentation header check passes.

## Stop conditions

- Stop if local poller behavior diverges from this document.
- Stop if the latest resume contains multiple independent actions.
- Stop if source issue labels, assignment, branch, PR, or canonical response do not agree.
- Do not treat poller wake as scope or merge authorization.

## Related authority

- `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`
- `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`
