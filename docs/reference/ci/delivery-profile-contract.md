---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Shared delivery-profile metadata values, parser fields, classification invariants, protected path baseline, and CLI contract
Does Not Own: Auto-integration enablement, branch protection settings, workflow behavior, or production promotion approval
Canonical Reference: /docs/governance/DELIVERY-AND-RELEASE.md
Related Issues: #2485, #3752, #3753
Last Reviewed: 2026-08-26
---

# Delivery Profile Contract

This reference defines the stable delivery-profile contract introduced by issue
#2485 for Delivery System v1, extended by #3752 for Model C documentation-only
delivery. The contract is intentionally metadata-first: runtime gate behavior for
Model C is implemented under issue #3753 and must not invent broader write
authority than `docs/governance/DELIVERY-AND-RELEASE.md`.

## Stable PR metadata fields

Delivery metadata is stored as stable PR-body facts alongside the existing issue,
intent label, and PR class fields:

```text
Size:
Delivery model:
Change mode:
Target environment:
Approval profile:
Gate profile:
Rollback profile:
Component branch:
Component master:
```

The parser ignores dynamic lifecycle state and does not parse PR class as part of
the delivery profile. HTML comments, blank values, underscore placeholders, and
common placeholder tokens such as `TBD` are treated as missing metadata.

## Enumerated values

### Delivery models

- `A`
- `B-child`
- `B-promotion`
- `C`
- `emergency-recovery`

### Work sizes

- `medium-provisional`
- `small`
- `medium`
- `large`

### Change modes

- `project`
- `routine-ops`
- `planned-migration`
- `emergency`
- `documentation`

### Target environments

- `component`
- `preview`
- `production`
- `recovery`
- `docs`

### Approval profiles

- `component-auto-integration`
- `chat-bill-production`
- `protected-change-review`
- `emergency-approval`
- `documentation-review`

### Gate profiles

- `component-child`
- `production-candidate`
- `component-promotion`
- `emergency-recovery`
- `documentation`

### Rollback profiles

- `one-step`
- `multi-step`
- `emergency-stabilization`

## Classification result

`classifyDeliveryProfile({ baseRef, headRef, body, changedFiles })` returns:

```text
{
  deliveryModel,
  size,
  changeMode,
  targetEnvironment,
  approvalProfile,
  gateProfile,
  rollbackProfile,
  componentBranch,
  componentMaster,
  protectedChange,
  errors
}
```

Invalid or mismatched metadata is reported through `errors`. The classifier must
not silently downgrade one delivery model to another.

## Branch and profile invariants

### Model A

- Base branch: `main`
- Target environment: `production`
- Approval profile: `chat-bill-production`
- Gate profile: `production-candidate`
- Rollback profile: `one-step`

### Model B child

- Base branch: `component/**`
- Target environment: `component`
- Gate profile: `component-child`
- Rollback profile: `multi-step`
- Component branch: must match the PR base branch
- Component master: required GitHub issue reference matching `#<number>` for the
  stable component/program master issue (for example `#2477`); it is not a branch
  name and must not be compared to `baseRef`
- Approval profile:
  - `component-auto-integration` when no protected paths are changed
  - `protected-change-review` when protected paths are changed

Protected Model B child PRs require Chat review and are not auto-integration
eligible.

### Model B promotion

- Base branch: `main`
- Head branch: `component/**`
- Target environment: `production`
- Approval profile: `chat-bill-production`
- Gate profile: `component-promotion`
- Rollback profile: `multi-step`
- Component branch: must match the PR head branch
- Component master: required GitHub issue reference matching `#<number>` for the
  same component/program master issue used by child PRs; it is not a branch name
  and must not be compared to `baseRef`

### Model C (documentation-only)

- Base branch: `main` (or an approved documentation-only integration branch that
  merges only approved documentation surfaces to `main`)
- Delivery model: `C`
- Change mode: `documentation` (or `routine-ops` when limited to non-policy docs)
- Target environment: `docs` or `production` when merging documentation surfaces to `main`
- Gate profile: `documentation`
- Rollback profile: `one-step`
- Approval profile:
  - `documentation-review` for non-constitutional, non-domain-policy documentation
  - `protected-change-review` when changing Constitutional or Domain Policy
    governance, DIATAXIS authority, or supersession of a canonical owner
- Component branch / component master: empty or `not-applicable`
- **Path allowlist (fail closed):** every changed path must be inside the Model C
  namespaces in `docs/governance/DELIVERY-AND-RELEASE.md`
- **Path prohibition:** any application-code, runtime, CI/workflow implementation,
  test, migration, deployment, configuration, dependency-manifest, script, or other
  executable namespace fails classification — enforcement is path-based, not
  extension-based
- **Cross-boundary moves:** rename/move/copy into a prohibited namespace fails
- Runtime gate implementation: Issue #3753

### Emergency recovery

- Base branch: `main`
- Change mode: `emergency`
- Target environment: `recovery`
- Approval profile: `emergency-approval`
- Gate profile: `emergency-recovery`
- Rollback profile: `emergency-stabilization`
- Component branch: must be empty or `not-applicable`
- Component master: must be empty or `not-applicable`

### Model A component-metadata constraints

Model A PRs must also keep component branch and component master empty or
`not-applicable`. Contradictory component metadata must fail explicitly.

## Protected path baseline

The initial protected-change baseline is intentionally conservative:

```text
.github/workflows/**
.github/CODEOWNERS
wrangler*.toml
migrations/**
functions/api/auth/**
functions/api/admin/**
scripts/ci/**
docs/governance/**
```

Later delivery-system tasks may refine this baseline with evidence, but protected
paths covering authentication, secrets, production bindings, deployment,
destructive migrations, or governance enforcement must not be removed without
Chat review.

Model C may edit `docs/governance/**` when eligible, but those paths remain
protected documentation changes requiring independent review. Model C must never
treat protected **executable** paths (workflows, scripts/ci, migrations, auth) as
allowlisted documentation surfaces.

## CLI contract

Run:

```text
npm run delivery-profile:check
```

The CLI reads:

- `PR_BODY_FILE` — required path to the PR body Markdown file
- `PR_BASE_REF` — PR base ref
- `PR_HEAD_REF` — PR head ref
- `CHANGED_FILES_FILE` — required newline-delimited changed-file list for Model B
  child PRs and Model C path-boundary checks; optional for other delivery models.
  Missing or unreadable changed-file evidence for Model B child or Model C PRs
  fails closed instead of assuming `protectedChange: false` or allowlist success.
- `DELIVERY_PROFILE_RESULT_JSON` — optional JSON artifact output path

The command exits `0` when classification succeeds, `1` when metadata or
branch/profile validation fails, and `2` when required CLI input is missing. When
`DELIVERY_PROFILE_RESULT_JSON` is set, the command writes the full
classification result as machine-readable JSON.
