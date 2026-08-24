---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Gate profiles, check classification, deterministic evidence, validation ownership, promotion verification criteria, failure routing, remediation boundaries, and post-merge verification ownership
Does Not Own: Delivery Model A/B selection, agent approval routing, branch-protection UI settings, workflow YAML implementation, product/UX behavior, or platform isolation claims
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2689, #2686, #3668, #3671
Last Reviewed: 2026-08-24
---

# CI and Verification

## Purpose

This document is the canonical **CI and Verification** domain policy. It defines who owns validation decisions, how checks are classified, what evidence counts, how failures route, where Deterministic CI stops and human Engineering approval begins, and how post-merge verification is owned.

Detailed workflow inventories, classification matrices, merge-protection surfaces, preflight contracts, and as-built CI notes live under `docs/reference/ci/**`. Those files are **supporting specifications**, not co-owners of this domain policy. The deterministic PMO failure-remediation routing contract is documented at `docs/reference/pmo/failure-remediation-routing-contract.md`. The deterministic-versus-judgment gate inventory and eligibility-signal contract is documented at `docs/reference/pmo/deterministic-approval-inventory-contract.md`.

Delivery model selection and promotion-profile policy remain in `docs/governance/DELIVERY-AND-RELEASE.md` and `docs/governance/PMO-PORTFOLIO.md`. Agent roles and protected-stop contracts remain in `docs/governance/AGENT-TEAM.md`. PR process procedure remains in `docs/governance/PR_PROCESS.md`. Operations degradation remains in `docs/governance/OPERATIONS-AND-RECOVERY.md`.

## Role-based ownership

| Role | Actor | Owns in this domain |
| --- | --- | --- |
| **Product Authority** | Bill | Final judgment when verification cost, credential use in CI, or Production risk is material; not a routine gate for ordinary check green/red |
| **PMO / Engineering** | ChatGPT | Verification package completeness; Promotion Candidate qualification criteria authorship; primary review when CI/verification policy or protected gate meaning changes |
| **Implementation / Operations** | Cursor | Scoped implementation of approved CI docs and allowlisted verification work; remediation of failing checks inside the allowlist; no self-approval of protected gate or Production authority |
| **PR Approver / Engineering** | ChatGPT (Bill alternate) | Human judgment that work meets design, acceptance, repository, and promotion requirements; approval of protected/material changes; not replaceable by a green CI panel alone |
| **Deterministic CI** | GitHub Actions and authorized repository automation | Machine-provable checks, evidence artifacts, eligible non-main integration under Delivery policy, and bounded authorized automation |
| **Administration & Communications** | ChatGPT + automation | Routing, acknowledgments, evidence transport, hold/resume, and closeout state reconciliation that depends on verification outcomes |
| **Day-2 Operations** | Bill / Chat coordination | Production health verification after deploy; incident classification when live verification fails |
| **Supporting CI references** | `docs/reference/ci/**` | Workflow inventories, classification matrices, surface contracts, and as-built facts only |

Rules:

- Deterministic CI may record pass/fail and eligibility. It must not impersonate PR Approver / Engineering or Product Authority.
- Implementation / Operations must not treat a green check panel as self-approval for protected work or Production promotion.
- Supporting CI references must cite this domain policy and must not restate competing domain ownership.
- Live GitHub branch-protection settings are operator-controlled. Repo docs describe the expected surface; they do not mutate GitHub settings.

## Authority stack inside this domain

When CI or verification sources conflict inside this domain, resolve in this order:

1. Locked Product Authority decisions recorded by Bill when verification risk, cost, or credentials are material
2. This domain policy (`docs/governance/CI-AND-VERIFICATION.md`)
3. Delivery and Release policy for profile transitions and approval boundaries (`docs/governance/DELIVERY-AND-RELEASE.md`)
4. PR process policy for PR lifecycle procedure (`docs/governance/PR_PROCESS.md`)
5. Supporting CI surfaces under `docs/reference/ci/**` (merge protection, classification matrix, inventories, preflight, post-merge)
6. Source GitHub issue allowlist and acceptance criteria for the active task
7. Historical explanation, retired inventories, or evolution records (non-binding)

Live PR check panel state and latest head workflow runs outrank agent memory when readiness is claimed. See `docs/ops/ai/CORE-RULES.md` operational truth hierarchy for gate troubleshooting.

## Check classification

Every workflow or check belongs to exactly one primary class:

| Class | Meaning | Merge / integration effect |
| --- | --- | --- |
| **Required** | Deterministic blocker for the applicable target | Must pass before merge or eligible integration for that target |
| **Advisory** | Active signal that informs remediation | Must not be treated as a required blocker unless explicitly promoted with evidence |
| **Manual-only** | Operator-dispatched or paused | Not an automatic merge blocker |
| **Scheduled** | Cron or periodic OPS/hygiene | Not a PR merge-protection check unless separately required |
| **Compatibility** | Inert or marker workflow retained for transition | Read-only / no mutation; not a required blocker |
| **Retired** | Removed or permanently out of service | Must not be restored from stale plans or issue memory |

Current known required surface for `main` (supporting detail in `docs/reference/ci/merge-protection-surface.md`):

- `quality` from `GATE — Quality Checks`
- `gitleaks` from `GATE — Secret Scan`

Current known active advisory PR checks (supporting detail in `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md`):

- PR hygiene
- Diff scope
- Reviewer response completion

Component-child gate profiles may require a different evidence set than `main`. The gate profile named on the PR (`component-child`, `production-candidate`, `component-promotion`, `emergency-recovery`) selects which verification bar applies. Delivery policy owns when a profile may be used; this domain owns what verification means inside that bar.

## Validation evidence

Acceptable verification evidence is machine- or repository-native and inspectable:

| Evidence type | Acceptable source |
| --- | --- |
| Local validation | Commands named by the source issue, with pass/fail recorded on the PR |
| Required CI | Latest head runs for required checks on the live PR panel |
| Advisory CI | Latest head advisory runs and their artifacts/comments |
| Review evidence | GitHub-native review threads and dispositions |
| Post-merge evidence | Post-merge closeout artifacts, comments, and remediation records |
| Promotion evidence | Candidate identity, qualification checklist, and Go/No-Go record |

Not acceptable as sole evidence:

- agent memory or chat claims without GitHub or file proof;
- stale workflow runs from a superseded head SHA;
- retired #1075 orchestration state;
- screenshots that cannot be correlated to the current head.

## Deterministic eligibility vs human approval

| Outcome | Owner | May claim |
| --- | --- | --- |
| Machine-provable pass/fail | Deterministic CI | Check result and eligibility signal only |
| Eligible non-main integration (non-protected Development child) | Deterministic CI under Delivery policy | Integration eligibility to the component branch |
| Protected / material Development child | PR Approver / Engineering | Approval to integrate |
| Promotion Candidate Go / No-Go | PMO / Engineering + PR Approver / Engineering (+ required roles) | Candidate readiness |
| Production promotion | Recorded Production authority + required Engineering approval | Production Go |
| Post-merge source-issue closeout automation | Deterministic CI / Administration automation | Closeout execution against existing authority |

Rules:

- A green required-check panel is necessary for many transitions. It is never sufficient by itself for Production.
- Automated component-child integration does not activate policy on `main` and does not create a Production-readiness claim.
- Implementation / Operations remediates failures; it does not approve its own protected work.

## Promotion verification criteria

| Profile | Verification bar owned by this domain |
| --- | --- |
| **Sandbox** | Scaled-down safety checks; isolation proof required before any mutating claim |
| **Development** | Gate profile checks for the target (component-child or equivalent); allowlist and issue accounting intact |
| **Promotion Candidate** | Full applicable qualification: integrated candidate identity, required checks on the candidate, standards reconciliation, rollback package, disposition of gaps |
| **Production** | Exact approved candidate; no unreviewed drift; required Production and Engineering authority; live verification plan |
| **Day-2** | Production health, incident, and recovery verification under Operations policy |

Skipping a mandatory profile is a protected stop. Sandbox must not jump to Promotion Candidate or Production. Development must not jump to Production.

## Failure routing and remediation boundaries

The executable routing behavior for these classes is specified by `docs/reference/pmo/failure-remediation-routing-contract.md` and must remain subordinate to this policy.

| Failure class | Routes to | Remediation boundary |
| --- | --- | --- |
| Deterministic required-check fail on Implementation work | Implementation / Operations | Fix inside allowlist; re-run checks on new head |
| Advisory finding | Implementation / Operations (fix) or owning reviewer (disposition) | Fix, reject with rationale, N/A, or bounded follow-up issue |
| Scope / allowlist / authority defect | PMO / Engineering (controlling decision) | `GUIDANCE` / `ADJUSTMENT`; no silent scope expansion |
| Protected-path or Production-boundary fail | PR Approver / Engineering (+ Product Authority when material) | Stop affected transition |
| Post-merge validation fail | Administration & Communications + Implementation remediation as authorized | Single-owner closeout path; no racing mutation owners |
| Live Production verification fail | Day-2 Operations | Incident / recovery path; not a silent PR rewrite |

Routine bounded correction is not a repository-wide stop. Material inability to meet acceptance without replanning requires `PLAN CHANGE REQUIRED`.

## Post-merge verification ownership

| Concern | Owner |
| --- | --- |
| Automatic source-issue closeout after merge to `main` | `.github/workflows/post-merge-closeout.yml` (single automatic owner) |
| Manual/backfill closeout | Supporting post-merge workflows under `docs/reference/ci/post-merge-validation-surface.md` |
| Remediation after post-merge failure | Authorized remediation workflows + Implementation / Operations |
| Documentation evidence (for example DIATAXIS post-merge) | Supporting evidence workflows; not a second closeout owner |
| Production runtime health after deploy | Day-2 Operations / Operations and Recovery domain |

Supporting post-merge workflows must not race the same automatic mutation boundary as the single closeout owner.

## Local validation

Local validation commands named by the source issue are part of the verification bar for Implementation / Operations before ready-for-review claims. Local pass does not replace required CI on the PR head. Known pre-existing failures outside the allowlist must be disclosed, not silently fixed.

## Decision boundaries

| Decision class | Authority | Required record |
| --- | --- | --- |
| Promote an advisory check to required | PMO / Engineering design + operator branch-protection update | Source issue + updated merge-protection supporting surface |
| Retire or restore a workflow class | PMO / Engineering; Product Authority when material risk/cost | Source issue + classification matrix update |
| Change gate-profile meaning | This domain policy (+ Delivery when profile transition changes) | Domain policy and/or Delivery update via authorized issue |
| Claim PR ready for review / merge | Implementation evidence + applicable human approval | Live PR panel + PR body stable facts |
| Eligible component auto-integration | Deterministic CI under Delivery + this domain’s evidence rules | Component-child checks green; no scope/authority stop |
| Production Go | Production authority + Engineering | Promotion Candidate identity + approvals |

No agent may treat a draft comment, stale run, or retired inventory as a check-classification or Production decision.

## Escalation rules

Stop and escalate when:

- required vs advisory classification is contested and the source issue does not resolve it;
- Deterministic CI eligibility is being used to bypass required human approval;
- a Promotion Candidate or Production claim lacks the verification bar above;
- live PR panel state cannot be verified for a readiness claim;
- post-merge mutation ownership would be duplicated or raced;
- an approved verification plan cannot satisfy acceptance without replanning.

Routine inventory wording fixes, reference routing corrections, and allowlisted documentation are not escalation events.

## Approval rules

| Change type | CI-doc update first? | Approval |
| --- | --- | --- |
| Docs-only supporting inventory correction aligned to existing authority | Yes (the docs PR is the change) | Per delivery profile; Chat primary for policy meaning |
| Workflow behavior change matching already-recorded surfaces | Supporting surface update with or before implementation | Per delivery profile; protected-path rules apply |
| Required-check or Production verification meaning change | Yes | PMO / Engineering; Product Authority when material |
| Component-child drafting under an authorized Model B program | Per child allowlist | Component auto-integration only when the child profile allows it; does not activate `main` policy alone |

Cursor never self-approves CI or verification authority for protected or Production boundaries.

## Supporting specification map

| Topic | Supporting owner (non-policy) |
| --- | --- |
| CI domain vocabulary (historical/supporting) | `docs/reference/ci/lgfc-ci-ci-domain-reference.md` |
| Workflow classification matrix | `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md` |
| Merge-protection required surface | `docs/reference/ci/merge-protection-surface.md` |
| PR workflow CI inventory | `docs/reference/ci/pr-workflow-ci-inventory.md` |
| Closeout workflow inventory excerpt | `docs/reference/ci/workflow-inventory.md` |
| Post-merge validation surface | `docs/reference/ci/post-merge-validation-surface.md` |
| PR process current-state baseline | `docs/reference/ci/pr-process-current-state.md` |
| Unified PR preflight | `docs/reference/ci/pr-preflight.md` |
| Delivery-profile metadata contract | `docs/reference/ci/delivery-profile-contract.md` |
| Component auto-integration as-built | `docs/reference/ci/component-auto-integration-as-built.md` |
| Reviewer lifecycle surface | `docs/reference/ci/reviewer-lifecycle-surface.md` |
| Repository runner contract | `docs/reference/ci/repository-runner-contract.md` |
| Trusted reviewer evidence gate | `docs/reference/ci/trusted-reviewer-evidence-gate.md` |
| Failure remediation routing contract | `docs/reference/pmo/failure-remediation-routing-contract.md` |

Inventories under `docs/reference/ci/**` may be LOCKED as as-built facts. LOCKED means the specification is frozen for implementation claims; it does not make that file a Domain Policy co-owner.

## Drift detection

A change is CI/verification drift when it:

- treats a supporting CI inventory as higher authority than this domain policy;
- promotes an advisory, manual-only, compatibility, or retired check to required without recorded authority and surface update;
- claims Production readiness from Development or component-child green checks alone;
- duplicates automatic post-merge closeout ownership;
- introduces competing “this file wins” domain-policy language outside this document’s authority stack;
- restores retired #1075 orchestration as current policy.

## Canonical references

| Topic | Owner |
| --- | --- |
| Repository precedence | `docs/governance/REPOSITORY-AUTHORITY.md` |
| Agent roles and Deterministic CI role | `docs/governance/AGENT-TEAM.md` |
| Delivery approval and rollback profiles | `docs/governance/DELIVERY-AND-RELEASE.md` |
| PR lifecycle procedure | `docs/governance/PR_PROCESS.md` |
| Operations degradation and recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| Merge-protection surface | `docs/reference/ci/merge-protection-surface.md` |
| Workflow classification | `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md` |
| Failure remediation routing | `docs/reference/pmo/failure-remediation-routing-contract.md` |

## Supersession

Within the CI and Verification domain, this file supersedes competing domain-policy claims previously implied by:

- `docs/reference/ci/lgfc-ci-ci-domain-reference.md` as a policy owner of CI domain definitions;
- “SOURCE OF TRUTH” / independent policy framing in `docs/reference/ci/**` inventories that competed with domain ownership;
- historical #1075 orchestration documents as current verification authority.

Those files remain active as supporting specifications or historical records after subordination. Shared constitutional routing updates outside this allowlist are reserved for #2690.
