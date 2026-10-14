---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Host registration and verification procedure for the dedicated `lgfc-cursor` GitHub Actions runner used by #3212 dispatch (primary after Phase 4)
Does Not Own: Historical Cursor Bridge package internals or Production website deployment
Canonical Reference: /docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md
Related Issues: #3212, #3347, #2636, #4567, #4570, #4587
Last Reviewed: 2026-10-14
---

# Configure the LGFC Cursor dispatch runner

Phase 4 (#3212): this runner path is the **primary** Cursor Local auto-start transport. Legacy Bridge wake delivery and poll-wake are retired as execution dependencies. The #3340 `lgfc-event-wake` poller is **abandoned as a connection type** (#3347) — do not substitute it for this runner.

## Purpose

Register and verify the dedicated Chromebook Linux self-hosted runner labeled `lgfc-cursor` that executes the Cursor dispatch workflow.

## Scope

**In scope**

- Creating a repository-scoped runner with labels `self-hosted`, `linux`, `x64`, `lgfc-cursor`
- Keeping it separate from `lgfc-repo-runner` (delivery/health only; Bridge wake retired)
- Verifying online status and dry-run / live dispatch

**Out of scope**

- General-purpose CI on the Chromebook
- Pull-request / fork-head execution
- Re-enabling retired Bridge/poll-wake without Product Authority

## Prerequisites

- Chromebook Linux VM online with outbound HTTPS to GitHub
- Product Authority GitHub access to create a runner registration token
- Repository slug `wdhunter465/next-starter-template`
- Official GitHub Actions runner package for linux-x64

## Steps

1. On the Linux VM, create an isolated directory (example):

```bash
mkdir -p "$HOME/actions-runners/lgfc-cursor"
cd "$HOME/actions-runners/lgfc-cursor"
```

2. Download and extract the current official GitHub Actions runner for linux-x64 (verify checksum from GitHub docs at install time).

3. Create a repository registration token (Product Authority):

```bash
gh api -X POST repos/wdhunter465/next-starter-template/actions/runners/registration-token --jq .token
```

4. Configure with dedicated labels (do **not** reuse the delivery runner directory):

```bash
./config.sh \
  --url https://github.com/wdhunter465/next-starter-template \
  --token "<registration-token>" \
  --name lgfc-cursor-chromebook \
  --labels self-hosted,linux,x64,lgfc-cursor \
  --work _work \
  --unattended
```

5. Install and start the service under a dedicated least-privilege account when feasible:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

Phase 3 reliability evidence (#3212) validated reconnect using foreground/background `./run.sh` when `sudo ./svc.sh install` was not yet available. Prefer `svc.sh` for reboot persistence; treat `run.sh` as a temporary host mode only.

For reliability dry-runs on the issues/label path, the host may set:

```bash
export LGFC_CURSOR_DISPATCH_DRY_RUN=true
```

before starting the runner so label-driven wakes exercise the wrapper without invoking Cursor. Clear that variable (or set `false`) only when a controlled live invoke is explicitly authorized.

6. Confirm GitHub shows the runner online with label `lgfc-cursor`.

7. Run the GitHub-hosted health workflow (`LGFC Cursor Runner Health`) with confirmation `CURSOR_RUNNER_HEALTH`.

   Note: manual `workflow_dispatch` for health/dispatch is gated to actor `wdhunter465` (live Product Authority login). The retired `wdhunter645` login is not a trusted dispatch actor.

8. Run `LGFC Cursor Dispatch` via `workflow_dispatch` with:
   - `issue_number`: a Cursor-owned Issue carrying `agent:cursor` + `handoff:ready`
   - `confirmation`: `CURSOR_DISPATCH`
   - `dry_run`: `true` for the first proof

## Host sleep and the health threshold

The runner lives on a Chromebook that usually sleeps overnight. While the host sleeps, GitHub reports the runner as `offline`, which is not a fault (#4567).

`LGFC Cursor Runner Health` runs at 11:17 and 17:17 UTC (7:17 AM and 1:17 PM Eastern daylight time) and treats the results as follows (#4570):

| Observation | Result |
|---|---|
| Runner online | Pass |
| Runner offline, previous check online or no previous check | Notice only: job summary plus a `RUNNER_OFFLINE_NOTICE` annotation. The run passes and no `ops-exception` Issue opens. |
| Runner offline, previous check also offline | Fail. The workflow-failure watcher opens an `ops-exception` Issue. |
| Previous-run lookup fails | Notice only. The summary names the error. The run is not an offline result and does not fail (#4587). |
| Three consecutive failed runs | The third failure opens one Issue, uploads `runner-health-halted`, and later runs pass with a halt notice until a person re-enables the check. |
| No runner with label `lgfc-cursor` registered | Fail immediately |
| Health token cannot list runners (`AUTH_DENIED`) | Fail immediately |

Each offline check uploads a `runner-offline-observation` artifact (kept 3 days). The next check reads recent runs and their artifacts with `fetch` and the workflow's own `GITHUB_TOKEN` (`actions: read`). `actions/github-script@v7` does not provide `getOctokit`; calling it threw before any HTTP request and the old catch treated that as a second offline check (#4587). Permissions stay `contents: read` and `actions: read`.

The threshold is therefore two consecutive offline checks: a sleeping host gives a notice at 11:17 UTC and clears by 17:17 UTC, while a real outage fails within about six hours. A manual run with confirmation `CURSOR_RUNNER_HEALTH` counts as a check, so a manual run while the host is online resets the count.

After three consecutive failed runs, the check halts (#4587). The run that reaches that count opens one Issue titled `OPS EXCEPTION: LGFC Cursor Runner Health halted after 3 consecutive failures` (labels `team:operations` and `ops-exception`), uploads `runner-health-halted` (kept 90 days), and does not fail, so the workflow-failure watcher does not open a second Issue for that run. Later scheduled runs see the halt marker, pass, and do not open another Issue. The health token opens that Issue; it is the same secret that lists runners, so the workflow `permissions:` block does not change. If creating the Issue fails, that run still fails once and the existing watcher opens the single `OPS EXCEPTION: LGFC Cursor Runner Health failed` Issue.

A person re-enables the check by running **LGFC Cursor Runner Health** manually, signed in as `wdhunter465`, with confirmation `CURSOR_RUNNER_HEALTH` and re-enable `REENABLE_CURSOR_RUNNER_HEALTH`. That run uploads `runner-health-reenabled` and starts the failure count over. An online runner does not clear a halt by itself.

To keep the host awake when dispatch must be available overnight:

- ChromeOS **Settings > System preferences > Power**: set **While charging** to **Keep display on** (or **Turn off display** without sleep), keep the Chromebook on power, and turn off **Sleep when cover is closed**.
- Leave the Linux development environment running; the runner service `actions.runner.wdhunter465-next-starter-template.lgfc-cursor-chromebook.service` reconnects by itself when the host wakes.

## Security rules

- Never target product PR CI at `lgfc-cursor`
- Never check out untrusted fork refs on this runner
- Do not place broad PATs or production secrets in the runner environment
- Cursor auth remains local to the service account that runs the wrapper

## Rollback

```bash
sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token "<removal-token>"
```

Also disable or remove `.github/workflows/lgfc-cursor-dispatch.yml` through a reviewed PR if the prototype must be withdrawn.
