---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Host registration and verification procedure for the dedicated `lgfc-codex` GitHub Actions runner (#4052 Cursor-parity)
Does Not Own: Cursor dispatch, Production website deployment, or PR/review/workflow_run wake extensions
Canonical Reference: /docs/how-to/ci/configure-lgfc-codex-dispatch-runner.md
Related Issues: #4052, #3808, #3212
Last Reviewed: 2026-09-17
---

# Configure the LGFC Codex dispatch runner

This runner path is the **Cursor-parity** local Codex auto-start transport. It copies the proven Phase-4 Cursor design (`lgfc-cursor-dispatch`) with Codex-only labels, wrapper, and CLI. The failed #3844 broad event surface is **not** used.

Do not copy Cursor Local Bridge, poll-wake, or `lgfc-event-wake` into Codex.

## Purpose

Register and verify the dedicated Chromebook Linux self-hosted runner labeled `lgfc-codex` that executes the Codex dispatch workflow.

## Scope

**In scope**

- Creating a repository-scoped runner with labels `self-hosted`, `linux`, `x64`, `lgfc-codex`
- Keeping it separate from `lgfc-cursor` and `lgfc-repo-runner`
- Verifying online status and dry-run / live dispatch

**Out of scope**

- General-purpose CI on the Chromebook
- Pull-request / fork-head / `workflow_run` execution on this runner
- Direct CI/review/merge wake (second-stage extension only, after base parity)

## Prerequisites

- Chromebook Linux VM online with outbound HTTPS to GitHub
- Product Authority GitHub access to create a runner registration token
- Repository slug `wdhunter465/next-starter-template`
- Official GitHub Actions runner package for linux-x64
- Local `codex` CLI authenticated for the service account (`codex --version`)

## Steps

1. On the Linux VM, create an isolated directory (do **not** reuse the Cursor runner directory):

```bash
mkdir -p "$HOME/actions-runners/lgfc-codex"
cd "$HOME/actions-runners/lgfc-codex"
```

2. Download and extract the current official GitHub Actions runner for linux-x64 (verify checksum from GitHub docs at install time).

3. Create a repository registration token (Product Authority):

```bash
gh api -X POST repos/wdhunter465/next-starter-template/actions/runners/registration-token --jq .token
```

4. Configure with dedicated labels:

```bash
./config.sh \
  --url https://github.com/wdhunter465/next-starter-template \
  --token "<registration-token>" \
  --name lgfc-codex-chromebook \
  --labels self-hosted,linux,x64,lgfc-codex \
  --work _work \
  --unattended
```

5. Install and start the service:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

Prefer `svc.sh` for reboot persistence. For first dry-runs, the host may set:

```bash
export LGFC_CODEX_DISPATCH_DRY_RUN=true
```

before starting the runner so label-driven wakes exercise the wrapper without invoking Codex. Clear that variable only when a controlled live invoke is explicitly authorized.

6. Confirm GitHub shows the runner online with label `lgfc-codex`.

7. Run the GitHub-hosted health workflow (`LGFC Codex Runner Health`) with confirmation `CODEX_RUNNER_HEALTH`.

8. Run `LGFC Codex Dispatch` via `workflow_dispatch` from `main` with:
   - `issue_number`: a Codex-owned Issue carrying `agent:codex` + `handoff:ready`
   - `confirmation`: `CODEX_DISPATCH`
   - `dry_run`: `true` for the first proof

Trusted manual actors are `wdhunter465` and `wdhunter645`.

## Security rules

- Never target product PR CI at `lgfc-codex`
- Never check out untrusted fork refs on this runner
- Do not place broad PATs or production secrets in the runner environment
- Codex auth remains local to the service account that runs the wrapper
- Never pass `--dangerously-bypass-approvals-and-sandbox`, `--yolo`, or `--force`

## Rollback

```bash
sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token "<removal-token>"
```

Also disable or remove `.github/workflows/lgfc-codex-dispatch.yml` through a reviewed PR if the path must be withdrawn.
