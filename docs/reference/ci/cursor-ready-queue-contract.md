---
Doc Type: Reference
Audience: Human + AI
Authority Level: Reference
Owns: The Cursor ready-queue file, the queries it holds, what a Cursor tick does with them, and the rule for when Cursor may go quiet
Does Not Own: Runtime selection (docs/governance/standards/CURSOR-RUNTIME-ROUTING.md), the shared execution law, queue-state label definitions, or the local poller implementation
Canonical Reference: /docs/governance/AGENT-EXECUTION.md
Related Issues: #4982, #4362, #4966, #4994, #5016, #5007
Last Reviewed: 2026-10-28
---

# Cursor ready-queue contract

## Purpose

Keep the Cursor local agent working without a task list from Product Authority. The repository says what is ready (`status:ready` and the other queue-state labels). The local poller asks GitHub on every tick. Cursor is idle only when GitHub has nothing for it.

## Scope

This file specifies the Cursor host files and what the Cursor poller does with them. The queue order, the meaning of a tick, the skip, cycle and repeat rules and when an agent may go quiet are shared by every agent and live only in `docs/governance/AGENT-EXECUTION.md` (Assigned-queue continuation). The labels are in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` (Queue-state labels). Runtime selection is in `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`.

## Current known truth

- The wake scripts, the tick text, and the seven queries are in `scripts/cursor-wake/`. `scripts/cursor-wake/install.sh` copies them to `~/.cursor`. Merging that change does not replace the host files. The host changes only when `install.sh` is run.
- Before this contract the poller's `nextExecutable` pointer came from a host-side list. It did not read `status:ready`, so a ready Issue could sit on GitHub while Cursor reported that nothing was ready.
- Status: the repository copy is the source. `scripts/cursor-wake/verify.sh` reports match or drift against the installed files. #4982 holds no install record yet.

## The file

Path: `~/.cursor/lgfc-ready-queue.txt`. One GitHub issue-search query per line, in priority order. A line starting with `#` is a comment. The poller adds `repo:wdhunter465/next-starter-template` to each query.

```text
# 1 Operations interrupt. Handle before anything else.
is:issue is:open label:team:operations label:ops:priority:1,ops:priority:2,ops:priority:3,ops:priority:4
# 2 Cursor's own post-merge exceptions.
is:issue is:open label:post-merge-failure label:agent:cursor
# 3 Assigned and ready.
is:issue is:open label:agent:cursor label:status:ready
# 3b Assigned and in progress across several pull requests.
is:issue is:open label:agent:cursor label:status:active
# 4 Ready and unclaimed.
is:issue is:open label:status:ready -label:agent:cursor -label:agent:claude
# 5 Unassigned and not yet reviewed, primary queues.
is:issue is:open label:team:operations,team:governance -label:agent:cursor -label:agent:claude -label:status:ready -label:wait:product -label:wait:review -label:wait:dependency -label:status:hold
# 6 Unassigned and not yet reviewed, secondary queues.
is:issue is:open label:team:engineering,team:pmo -label:agent:cursor -label:agent:claude -label:status:ready -label:wait:product -label:wait:review -label:wait:dependency -label:status:hold -label:pmo:task
```

Cursor's own open pull requests are checked on every tick as well: a failing gate is work.

The seven lines are the shared queue order: line 1 is step 1, line 2 is step 2, lines 3 and 3b are step 3, line 4 is step 4, lines 5 and 6 are step 5 (primary, then secondary).

## Canonical tick text

The host loop reads this sentence from `~/.cursor/lgfc-tick-prompt.txt` (the repository file is `scripts/cursor-wake/tick-prompt.txt`) and appends one poll suffix: `Poll fresh=<n> events=<list>.` It does not rewrite the sentence.

```text
Read docs/reference/ci/cursor-ready-queue-contract.md and docs/governance/AGENT-EXECUTION.md from origin/main and follow them. Run the queries in ~/.cursor/lgfc-ready-queue.txt. Skip any Issue labeled wait:* after recording the blocker. Act on the first Issue that can move. Never send a third identical report.
```

On every tick, read those two files from `origin/main` and follow them.

## What a Cursor tick does

1. Refresh the rules (next section), then run the queries in order. Write each result count and the first Issue numbers to `~/.cursor/lgfc-wake-poll-inbox.json` under `readyQueue`. The inbox stays a keepalive record. The queue itself is GitHub.
2. Hand Cursor every non-empty query, not one "next item". An Issue labeled `wait:*` is reported as skipped, with the label, so the head of the list is never a waiting Issue.
3. Cursor works the first Issue that can move and applies the shared rules (Assigned-queue continuation) to the rest. Query 5 and 6 results are reviewed and owned as the shared law says.
4. Check Cursor's open pull requests and fix any failing gate.
5. Report the tick in one line. Do not report "nothing to do" while any step found work.

## Fresh rules on every tick (#5007)

The queue is read from GitHub, and so are the rules Cursor acts on. A merged change to the shared law must reach a running session without anyone running `git pull`.

- **Fetch, do not pull.** Run `git fetch origin main` in the workspace. Do not check out, merge or reset anything, and leave the branch Cursor is on and its working tree alone.
- **Read from `origin/main`.** Read the rule files with `git show origin/main:<path>` (or the GitHub contents API), not from the working copy: `docs/governance/AGENT-EXECUTION.md`, `docs/ops/ai/CURSOR-RULES.md` and `docs/governance/AGENT-TEAM.md`.
- **Report the version.** Write the `origin/main` commit SHA and the blob SHA of `AGENT-EXECUTION.md` (`git rev-parse origin/main:docs/governance/AGENT-EXECUTION.md`) into `readyQueue` in `~/.cursor/lgfc-wake-poll-inbox.json` and print both in the tick line.
- **Reload on change.** When the blob SHA differs from the previous tick's, the next action starts by re-reading Assigned-queue continuation. A changed rule is never left for a person to notice.
- **A failed fetch is visible.** If the fetch fails, the tick says so once and works from the last good copy of the rules. It does not silently use the checkout.

## Host files

| Host file | Role | Refresh after a change here |
| --- | --- | --- |
| `~/.cursor/lgfc-ready-queue.txt` | The seven queries | Only if the block above changes. Confirm it exists and matches. |
| `~/.cursor/lgfc-wake-poll-inbox.json` | Keepalive record, `readyQueue` counts | No. |
| `~/.cursor/lgfc-wake-ctl.sh` and the poller | Run the queries and write `readyQueue` | Yes, if the poller picks one "next item" by itself (it must follow step 2 above), or if it does not fetch `origin/main` and report the two SHAs (Fresh rules on every tick). |
| `~/.cursor/lgfc-always-on-loop.sh` and `~/.cursor/lgfc-tick-prompt.txt` | The loop and the canonical tick sentence | Yes. The sentence is the block under Canonical tick text. The loop appends the poll suffix and does not change the sentence. |
| `.cursor/rules/*.mdc` in the workspace | Always-apply rules, which only point to the shared law | The shared law is read from `origin/main` each tick, so a stale checkout no longer hides it. These small pointer files still load from the workspace; pull when they change. |

Record the refresh date on #4994, and the first tick that prints the two SHAs on #5007.

## Intended final state

A new `status:ready` label wakes Cursor from the GitHub side (the dispatch trigger, tracked on #4982), and the poller finds the same Issue on its next tick. The two keepalives agree because they read the same labels.

## Restore

A new machine reaches a working loop from this repository alone:

1. Clone the repository and check out `main`.
2. Run `scripts/cursor-wake/install.sh`. It copies the wake control script, the loop, the watchdog, the poller, the tick sentence, and the seven queries into `~/.cursor`. It does not rebind and it does not start a loop.
3. Run `scripts/cursor-wake/verify.sh`. Each file prints `match`. A `drift` line means the installed file differs or is missing.
4. Start the loop and the watchdog only through the session bind in `docs/ops/ai/CURSOR-RULES.md`. Record the install date on #4982.

`GITHUB_POLL_REPO` and `GITHUB_POLL_LOGIN` override the poller defaults. `LGFC_NEXT_WORK_RESOLVER` is the only optional resolver path. No secret and no home-directory path is stored in the scripts.
