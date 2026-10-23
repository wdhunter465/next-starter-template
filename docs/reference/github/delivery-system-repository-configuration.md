---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: As-built GitHub repository configuration for Delivery System v1, template stable-field surfaces, component branch requirements, production approval controls, and rollback snapshot
Does Not Own: Domain policy definitions, CI workflow implementation, or live operator merge decisions
Canonical Reference: /docs/ops/implementation-plans/two-model-delivery-system/implementation-plan.md
Related Issues: #2500, #2477, #2502
Last Reviewed: 2026-07-15
---

# Delivery System Repository Configuration

This reference records the as-built GitHub configuration and template surfaces for Delivery System v1 Task 10. Policy definitions remain in domain governance and shared contracts; this document captures what the repository and GitHub settings actually enforce today.

## Stable metadata surfaces

Templates must capture stable facts only. Dynamic lifecycle state (review threads, check results, merge-readiness, closeout status) remains GitHub-native.

| Field | PR template | Issue templates | Parser contract |
| --- | --- | --- | --- |
| Size | yes | yes | `docs/reference/ci/delivery-profile-contract.md` |
| Delivery model | yes | yes | yes |
| Change mode | yes | yes | yes |
| Target environment | yes | yes | yes |
| Approval profile | yes | yes | yes |
| Gate profile | yes | yes | yes |
| Rollback profile | yes | yes | yes |
| Component branch | yes | yes | yes |
| Component master | yes | yes | yes |
| Promotion PR | yes | yes | template-only until promotion parser lands |

### Template inventory

| Surface | Path | PMO `medium-provisional` intake | Classification evidence |
| --- | --- | --- | --- |
| Pull request | `.github/pull_request_template.md` | via `Size:` field | profile examples in header comment |
| Delivery task | `.github/ISSUE_TEMPLATE/delivery-task.md` | yes | yes |
| Agent task | `.github/ISSUE_TEMPLATE/agent-task.md` | yes | yes |
| Feature request | `.github/ISSUE_TEMPLATE/feature_request.md` | yes | yes |
| Bug report | `.github/ISSUE_TEMPLATE/bug_report.md` | yes | yes |
| Issue picker | `.github/ISSUE_TEMPLATE/config.yml` | delivery-task link | — |

### Profile validation examples

These stable profiles must validate against `docs/reference/ci/delivery-profile-contract.md` and `npm run delivery-profile:check`:

| Profile | Delivery model | Target environment | Approval profile | Component branch | Promotion PR |
| --- | --- | --- | --- | --- | --- |
| Model A | `A` | `production` | `chat-bill-production` | `not-applicable` | `not-applicable` |
| Model B child | `B-child` | `component` | `component-auto-integration` | matches PR base | `not-applicable` |
| Model B promotion | `B-promotion` | `production` | `chat-bill-production` | matches PR head | `#<promotion-pr>` |
| Emergency recovery | `emergency-recovery` | `recovery` | `emergency-approval` | `not-applicable` | `not-applicable` |

Protected Model B child PRs use `protected-change-review` instead of `component-auto-integration` when protected paths change.

## Component branch requirements

### Approved model

| Requirement | Value |
| --- | --- |
| Branch pattern | `component/<release-unit>` |
| Active program branch | `component/delivery-system-v1` |
| Child PR base | `component/<release-unit>` |
| Child implementation branch | `cursor/<issue>-<task>-2e48` |
| Promotion PR head | `component/<release-unit>` |
| Promotion PR base | `main` |
| Auto-integration eligible | `B-child` with `component-auto-integration`, green technical checks, no protected paths, component green state |
| Auto-integration blocked | protected changes, failed/pending checks, component red state, hold labels, branch mismatch, missing component master |
| Production merge | promotion PR only — no child PR may target `main` for feature work |

### As-built state (2026-07-16)

| Setting | Current value | Notes |
| --- | --- | --- |
| `component/delivery-system-v1` branch | exists at `0767a2125afd55e28be21916960e763e5e29a583` | includes Pilot #2527, remediations, #2579 main sync |
| Component ruleset | none | no dedicated ruleset; Chat still performs protected-child and promotion decisions |
| Child auto-integration workflow | present | `.github/workflows/component-child-integration.yml`; publishes `Component Integration Eligibility` |
| Repo `allow_auto_merge` | `false` | confirmed live via GitHub API on 2026-07-16; workflow no-ops GraphQL enablement when false |
| Sync gap vs `main` | 0 commits on `main` not in component; 34 component commits not in `main` | measured 2026-07-16 against `main` `90d2e391ef67436987568e65fcddf9db872a1a06`; gating rationale in `docs/ops/reports/delivery-system-v1-promotion-readiness.md` |
| Live eligible-child proof | PR #2540 | artifact `eligible=true`, `requiresChatReview=false`; auto-merge not claimed while `allow_auto_merge=false` |
| Promotion release validation | PASS at #2511 head `0767a212…` | `quality` + `gitleaks` green; PR remains draft/held |

Component child integration automation is implemented (#2498). Live non-protected eligible-child eligibility is proven (#2540); repository `allow_auto_merge=false` remains a structural blocker for hands-off enablement. See `docs/ops/reports/delivery-system-v1-promotion-readiness.md`.

## `main` production approval controls

### Approved model

| Control | Requirement |
| --- | --- |
| Production merge approver | Chat primary; Bill alternate |
| Model A / promotion approval profile | `chat-bill-production` |
| Required deterministic checks | `quality`, `gitleaks` |
| Auto-merge to production | prohibited |
| Cursor self-approval | prohibited |

### As-built ruleset evidence

Captured from GitHub API `repos/wdhunter645/next-starter-template/rulesets/15885337` on 2026-07-13:

```json
{
  "id": 15885337,
  "name": "Main",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "require_code_owner_review": false,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "quality" },
          { "context": "gitleaks" }
        ]
      }
    }
  ]
}
```

Repository settings:

```json
{
  "allow_auto_merge": false,
  "allow_merge_commit": true,
  "allow_rebase_merge": true,
  "allow_squash_merge": true,
  "delete_branch_on_merge": false
}
```

Interpretation:

- `main` requires deterministic `quality` and `gitleaks` checks before merge.
- GitHub ruleset does not auto-approve production; `chat-bill-production` is enforced through delivery policy, PR governance, and human review — not repository auto-merge.
- `allow_auto_merge: false` prevents silent auto-merge at the repository level.

Canonical required-check reference: `docs/reference/ci/merge-protection-surface.md`.

## Emergency recovery controls

### Approved model

| Control | Requirement |
| --- | --- |
| Delivery model | `emergency-recovery` only |
| Change mode | `emergency` |
| Target environment | `recovery` |
| Approval profile | `emergency-approval` |
| Component metadata | `not-applicable` |
| Auto-integration into component branch | prohibited |
| Auto-merge to production | prohibited |
| Production activation | Chat or Bill explicit approval after stabilization |

### As-built verification

Emergency recovery cannot silently auto-merge production because:

1. Repository `allow_auto_merge` is `false`.
2. No ruleset grants auto-merge bypass for emergency-labeled PRs.
3. Emergency profile requires `emergency-approval`; delivery policy blocks component auto-integration for `emergency-recovery`.
4. `docs/how-to/ops/run-emergency-recovery.md` prohibits auto-integrating emergency work into component branches.

## Labels and intent routing

Relevant delivery labels observed on 2026-07-13:

| Label | Purpose |
| --- | --- |
| `docs-only` | Docs-only governance; no runtime changes |
| `feature` | Intentional product change |
| `platform` | Cloudflare/runtime config |
| `change-ops` | Operations, recovery, bug fixes, as-built docs |
| `recovery` | Break-glass recovery / emergency repair intent |
| `intent:docs` | Intent labeler path for documentation |
| `intent:feature` | Intent labeler path for product changes |
| `intent:infra` | Intent labeler path for infrastructure |
| `agent:cursor` | Cursor implementation routing |

Intent labeler maps `.github/pull_request_template.md` under `intent:docs` per `.github/intent-labeler.json`.

## Configuration rollback snapshot

Capture before any promotion or ruleset change. Restoration operator procedure lives in `docs/how-to/delivery/manage-component-integration.md` (section **Restore repository configuration after failed promotion**).

### Snapshot (2026-07-16)

| Asset | Value |
| --- | --- |
| `main` SHA | `90d2e391ef67436987568e65fcddf9db872a1a06` |
| `main` ruleset id | `15885337` |
| `main` ruleset name / enforcement | `Main` / `active` |
| Required checks | `quality`, `gitleaks` |
| `allow_auto_merge` | `false` |
| `allow_squash_merge` | `true` |
| Component branch head | `component/delivery-system-v1` @ `0767a2125afd55e28be21916960e763e5e29a583` |
| Promotion PR | #2511 (open draft; held; Quality PASS; awaiting Chat/Bill production authorization) |
| PR template path | `.github/pull_request_template.md` |
| Issue templates | `.github/ISSUE_TEMPLATE/{agent-task,bug_report,delivery-task,feature_request}.md` and `.github/ISSUE_TEMPLATE/config.yml` |
| Recent github-pages deployment SHA (sample) | `9f87b4bcb514bf8feeaee22b688cde704e8eb21b` |

## Canonical references

| Topic | Owner |
| --- | --- |
| Delivery metadata contract | `docs/reference/ci/delivery-profile-contract.md` |
| Delivery and release policy | `docs/governance/DELIVERY-AND-RELEASE.md` |
| PMO sizing and model selection | `docs/governance/PMO-PORTFOLIO.md` |
| Merge protection surface | `docs/reference/ci/merge-protection-surface.md` |
| Configuration restoration procedure | `docs/how-to/delivery/manage-component-integration.md` |
| Promotion readiness evidence | `docs/ops/reports/delivery-system-v1-promotion-readiness.md` |
| Implementation plan Task 10–12 | `docs/ops/implementation-plans/two-model-delivery-system/implementation-plan.md` |
