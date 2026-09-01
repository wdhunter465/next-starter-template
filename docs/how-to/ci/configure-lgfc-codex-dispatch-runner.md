---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Codex Chromebook runner registration and verification
Does Not Own: Cursor runner/configuration or Codex task authority
Canonical Reference: /docs/how-to/ci/configure-lgfc-codex-dispatch-runner.md
Related Issues: #3808
Last Reviewed: 2026-09-01
---

# Configure the LGFC Codex dispatch runner

Register a separate repository-scoped Linux runner with labels `self-hosted,linux,x64,lgfc-codex`. Do not reuse the Cursor runner directory or change Cursor configuration.

```bash
mkdir -p "$HOME/actions-runners/lgfc-codex" && cd "$HOME/actions-runners/lgfc-codex"
./config.sh --url https://github.com/wdhunter465/next-starter-template \
  --token "<registration-token>" --name lgfc-codex-chromebook \
  --labels self-hosted,linux,x64,lgfc-codex --work _work --unattended
sudo ./svc.sh install
sudo ./svc.sh start
```

Verify `/usr/bin/codex exec --help` and run `LGFC Codex Dispatch` manually with `confirmation=CODEX_DISPATCH` and `dry_run=true`. Inspect the queue record under `~/.lgfc-codex-dispatch` and the source Issue acknowledgment before enabling live invocation.

## Steps

1. Confirm the runner is online with labels `self-hosted`, `linux`, `x64`, and `lgfc-codex`.
2. Run the dry-run dispatch and verify an acknowledgment queue record.
3. Enable live dispatch only after Product Authority authorizes the host.
4. Inspect `retryable-failure` and `stale` records when a wake is missed; retry only from a trusted event.

## Rollback

Stop/uninstall only this runner service and disable the Codex workflow through a reviewed PR. Do not stop or edit the `lgfc-cursor` runner.
