---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Live GitHub label bootstrap procedures and required label contracts
Does Not Own: Redefining design/architecture/platform specs; historical records
Canonical Reference: /docs/ops/OPERATING_MANUAL.md
Related Issues: #1075, #2175, #2208, #2469
Last Reviewed: 2026-07-12
---

# GitHub Label Bootstrap (Mandatory)

## Purpose

Define the live procedure for creating and maintaining GitHub labels required by repository workflows and issue routing.

## Scope

This procedure covers intent labels and generic orchestration labels stored in current repository contracts. It does not authorize the retired #1075 phase engine or its deleted state file.

## Current known truth

GitHub labels are repository configuration, not files. Workflows may fail or skip routing when required labels are missing. The dedicated #1075 CI orchestration engine and `.github/ci-orchestration-state.json` are retired by #2469.

The current durable generic orchestration label contract is `/.github/orchestrator-labels.json`.

Queue ownership, Operations/Governance/PMO/Engineering priority namespaces, and Pipeline stages are owned by `/.github/queue-label-registry.json` (Project #2702 / Issue #2724; Governance Team addition #3152). Live creation of those labels is authorized only through the reviewed migration procedure. Generic orchestrator status/type/agent labels remain separate from queue ownership authority.

## Intended final state

All labels required by current workflows exist in GitHub and match current repository contracts. Retired #1075-only state must not be restored as a label authority.

## Why this exists

Intent labels are repository configuration in GitHub, not files in the repo. CI workflows and labeler logic assume the labels already exist.

PRs cannot create labels. Missing labels can cause CI or routing failures even when code is correct.

## Canonical intent labels

- change-ops
- feature
- docs-only
- infra
- platform
- codex
- recovery

## Create via GitHub UI

Repository → Issues → Labels → New label (repeat for each required label).

## Create via GitHub CLI (preferred)

Run from a checked-out repo with `gh` authenticated:

```text
gh label create "change-ops" --color "B60205" --description "Operations, recovery, bug fixes, design realignment; may touch code + as-built docs" --force
gh label create "feature"    --color "1D76DB" --description "Intentional product change: new capabilities or improvements; may touch code + docs" --force
gh label create "docs-only"  --color "0075CA" --description "Docs-only governance/design/standards; no runtime changes" --force
gh label create "infra"      --color "0E8A16" --description "CI/workflows/monitoring/ops tooling; repo plumbing" --force
gh label create "platform"   --color "5319E7" --description "Cloudflare/runtime config only (e.g., wrangler bindings/routes)" --force
gh label create "codex"      --color "FBCA04" --description "Agent/automation control, guardrails, deterministic repo hygiene tooling" --force
gh label create "recovery"   --color "D93F0B" --description "Break-glass recovery / emergency repair intent (broad scope, controlled)" --force
```

## Generic orchestration labels

Minimum labels used by the current generic issue-factory and queue model include:

- `orchestrator`
- `status:queued`
- `status:blocked`
- `status:failed`
- `status:complete`
- task-type and agent-routing labels defined by current contracts

Use `/.github/orchestrator-labels.json` as the durable label contract. Create missing labels through an explicitly authorized bootstrap or maintenance action.

## Retired label authority

The deleted `.github/ci-orchestration-state.json` and retired CI phase engine are historical only. They must not be used to create labels, generate `lgfc-ci-phase:*` issues, or define current queue state.
