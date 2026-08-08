---
Doc Type: How-To
Audience: Bill, ChatGPT
Authority Level: Operational Procedure
Owns: Chromebook Debian 12 installation and verification sequence for the repository-scoped LGFC GitHub Actions runner
Does Not Own: Repository runner contract, project launch, workflow migration, or production authorization
Canonical Reference: /docs/reference/ci/repository-runner-contract.md
Related Issues: #2294, #2593, #2667
Last Reviewed: 2026-07-20
---

# Configure the LGFC Chromebook Repository Runner

## Purpose

Install and verify one repository-scoped Chromebook Linux GitHub Actions runner that matches the approved runner contract without routing production, secret-bearing, or untrusted work to the host.

## Scope

This How-To covers repository-level registration, Debian 12 systemd service install, idle-state verification, the manual health workflow run from `main`, wake-packet delivery for Cursor Local Bridge, and stop/remove rollback. It does not authorize project launch, general workflow migration, Production routing, or retention of registration tokens in repository files.

## Current known truth

The Chromebook runner `lgfc-chromebook-linux` is registered. Permitted runner jobs are Repository Runner Health and Cursor Local Wake Delivery (packet write only). Cursor launch is owned by Cursor Local Bridge — see `docs/how-to/cursor/configure-cursor-local-bridge.md`.

## Intended final state

Runner healthy; Bridge installed and authenticated; wake packets delivered and either auto-started or explicitly fallen back; existing product workflows remain on current runners until a separate migration Go.

## Prerequisite

Do not begin host registration until the repository runner contract and manual health workflow are present on `main`.

Confirm the Chromebook Linux environment is Debian 12 x64, systemd is available, outbound HTTPS works, and the Linux environment is dedicated to runner work while the service is active.

## Procedure

### Create the repository runner

In `wdhunter465/next-starter-template`:

1. Open **Settings → Actions → Runners**.
2. Select **New self-hosted runner**.
3. Select **Linux** and **x64**.
4. Keep the generated registration page open. The registration token is time-limited.

Use a repository-level runner.

### Install on Chromebook Linux

Use the exact runner version, download command, and checksum shown by GitHub.

```bash
mkdir -p "$HOME/actions-runner"
cd "$HOME/actions-runner"
```

After downloading and extracting the runner package, register it with the generated token:

```bash
./config.sh \
  --url https://github.com/wdhunter465/next-starter-template \
  --token <REGISTRATION_TOKEN> \
  --name lgfc-chromebook-linux \
  --labels lgfc-repo-runner,chromebook,debian-12 \
  --work _work \
  --unattended
```

Do not store the registration token in repository files or reusable scripts.

### Install the service

```bash
sudo ./svc.sh install "$USER"
sudo ./svc.sh start
sudo ./svc.sh status
```

On Debian with `needrestart` enabled:

```bash
echo '$nrconf{override_rc}{qr(^actions\.runner\..+\.service$)} = 0;' \
  | sudo tee /etc/needrestart/conf.d/actions_runner_services.conf
```

### Verify registration

In **Settings → Actions → Runners**, confirm:

- runner name: `lgfc-chromebook-linux`;
- status: **Idle**;
- platform: Linux x64;
- labels include `lgfc-repo-runner`, `chromebook`, and `debian-12`.

### Run the health workflow

1. Open **Actions → Repository Runner Health**.
2. Select branch `main`.
3. Enter `RUNNER_HEALTH`.
4. Run the workflow.
5. Review the host capability and contract-validation summary.

The bootstrap workflow must remain manual-only and read-only. Do not migrate existing workflows to this runner during registration.

## Stop or remove

```bash
cd "$HOME/actions-runner"
sudo ./svc.sh stop
sudo ./svc.sh status
```

To remove the service:

```bash
sudo ./svc.sh uninstall
```

Remove the runner from repository settings before deleting the local installation directory.

## Troubleshooting

If a job remains queued, verify the service is running, the runner is **Idle**, the labels match, the workflow was dispatched from `main`, and the confirmation value is exact.

If any unexpected workflow is routed to the Chromebook, stop the service and disable the runner in repository settings before investigating.

## Bridge preflight relationship (#2681)

The Chromebook runner remains packet transport only. Host readiness before Cursor claim is owned by the Cursor Local Bridge preflight engine and the existing `lgfc-cursor-bridge-watchdog.timer`. Do not add a competing runner-side Cursor launcher.
