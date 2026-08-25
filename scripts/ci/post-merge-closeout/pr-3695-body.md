# PR Summary

- **Issue:** #3693
- Intent label: intent:docs
- PR class: docs-governance
- Size: medium
- Delivery model: A
- Change mode: project
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: production-candidate
- Rollback profile: one-step
- Implementation agent: ChatGPT
- Component branch: not-applicable
- Component master: not-applicable
- Promotion PR: not-applicable

Documentation source classification: LEGACY_FALLBACK
Design source of truth: pre-Work `docs/ops/ai/CHATGPT-RULES.md` history plus current `Agent.md`, `docs/governance/AGENT-TEAM.md`, `docs/ops/ai/CORE-RULES.md`, and `docs/ops/ai/WORK-RULES.md`.

## Scope

Allowed paths:
- `Agent.md`
- `docs/governance/AGENT-TEAM.md`
- `docs/ops/ai/CORE-RULES.md`
- `docs/ops/ai/CHATGPT-RULES.md`
- `docs/ops/ai/CODEX-RULES.md`
- `docs/ops/ai/WORK-RULES.md`
- `docs/ops/ai/CLAUDE-CODE-RULES.md`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Restores ChatGPT as an active LGFC control-plane product with the same durable repository permissions and role authority as Work, while retaining Work as an active distinct product surface. Adds the #3693 assignment-continuity rule and restores the active ChatGPT control-plane operating contract.

## Verification

CI verification:
- Required checks passed on the final merged head.

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] ChatGPT and Work mapped to equivalent repository roles/permissions
- [x] `Agent.md` routes ChatGPT to active `CHATGPT-RULES.md`
- [x] startup framework recognizes ChatGPT
- [x] active ChatGPT doctrine no longer places ChatGPT outside delivery chain
- [x] assignment continuity across interruptions is explicit

Follow-up issue required: YES
Follow-up issue if required: #3696

## Reviewer / Bot Review Attestation

- [x] Human and bot findings reconciled through #3696.

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3852819065 — rejected — #3693 explicitly excluded unrelated implementation-agent permission changes; `AGENT-TEAM.md` is the canonical durable role mapping and changing Codex routing under the ChatGPT parity issue would exceed its authorized scope. Any Codex-policy reconciliation requires separate Product Authority governance scope. — thread state: outdated
- review-comment:3852819130 — rejected — the finding requests Codex-specific authority text beyond #3693 scope; `Agent.md` already states immediately below the product list that startup never authorizes implementation and that a source Issue, exact allowlist, role authority, promotion profile, and explicit implementation Go must be loaded separately for every product. — thread state: outdated
- review-comment:3852819162 — accepted — Claude Code startup should explicitly report both branch and working-tree clean/dirty state; corrected under exception #3696 on branch `fix/3696-review-governance-findings`. — thread state: outdated

## Post-merge remediation record

Exception #3696 reconciles all three late Copilot findings. Two Codex findings are dispositioned as outside the authorized #3693 scope rather than silently changing Codex policy. The valid Claude startup-state finding is corrected through the bounded #3696 remediation PR.
