---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Host registration and verification procedure for the dedicated `lgfc-cursor` GitHub Actions runner used by #3212 Phase 2 dispatch
Does Not Own: Cursor Bridge package behavior, legacy poll-wake retirement, or Production website deployment
Canonical Reference: /docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md
Related Issues: #3212
Last Reviewed: 2026-08-09
---

# Configure the LGFC Cursor dispatch runner

Phase 3 note (#3212): `run.sh` reconnect and `LGFC_CURSOR_DISPATCH_DRY_RUN=true` host mode were evidenced during reliability validation; `sudo ./svc.sh install` remains preferred for reboot persistence.

## Purpose

Register and verify the dedicated Chromebook Linux self-hosted runner labeled `lgfc-cursor` that executes the Phase 2 Cursor dispatch workflow.

## Scope

**In scope**

- Creating a repository-scoped runner with labels `self-hosted`, `linux`, `x64`, `lgfc-cursor`
- Keeping it separate from `lgfc-repo-runner` wake-delivery
- Verifying online status and dry-run dispatch

**Out of scope**

- General-purpose CI on the Chromebook
- Pull-request / fork-head execution
- Retiring the Cursor Local Bridge (Phase 4)

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

   Note: as of Phase 3 evidence, manual `workflow_dispatch` for health/dispatch is gated to actor `wdhunter645` in workflow YAML. If the live Product Authority login differs, use the issues/label dry-run path and/or API runner status until that allowlist is reconciled.

8. Run `LGFC Cursor Dispatch` via `workflow_dispatch` with:
   - `issue_number`: a Cursor-owned Issue carrying `agent:cursor` + `handoff:ready`
   - `confirmation`: `CURSOR_DISPATCH`
   - `dry_run`: `true` for the first proof

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
