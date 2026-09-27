---
Doc Type: Reference
Audience: Human + AI
Authority Level: Informational
Owns: The lightweight program-risk field model and register (#2451), the launch-focused technical debt taxonomy and register (#2452), and the launch readiness evidence contract (#2453) for the 2027 fundraiser
Does Not Own: A separate authority hierarchy, permission to remediate a risk or debt row, a claim that any row is already mitigated or accepted, or replacement of existing launch-readiness checks
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2449, #2451, #2452, #2453
Last Reviewed: 2026-09-27
---

# 2027 fundraiser: risk, debt, and launch readiness

Parent session record #2449 named eleven strategic PMO topics. This file records three sibling topics from that list — Program Risk Model (#2451), Technical Debt Registry (#2452), and Launch Readiness Framework (#2453) — as one reference document instead of three, so the documentation set does not regrow immediately after a consolidation pass. Each part below independently satisfies its own source Issue's acceptance criteria; combining them changes file count only, not content or decisions.

None of the three parts creates a second authority hierarchy, authorizes remediation, accepts a risk or debt row, or authorizes deployment. Each stays subordinate to `docs/governance/PMO-PORTFOLIO.md` and to Product Authority.

## Part 1 — Program risk model (#2451)

This is the risk record for threats to the website components and repository-support work required for the 2027 fundraiser. It does not create a second portfolio. A risk becomes executable work only when Product Authority names a source Issue for it.

### Fields

Every risk row uses these fields:

- Description
- Affected component or project
- Probability: low, medium, or high
- Impact: low, medium, or high
- Detectability: how someone notices it before launch
- Recovery cost: what it takes to restore service or correctness
- Owner: a role from `docs/governance/AGENT-TEAM.md`, or `unassigned`
- Mitigation: the control that exists now, or `none recorded`
- Trigger: the observable event that escalates the risk
- Deadline: a date, a phase gate, or `none`
- Release impact: blocks a phase gate, blocks merge, blocks deploy, blocks launch, or advisory

### When a risk blocks

A risk blocks a phase gate, merge, deploy, or launch only when its release impact says so and Product Authority has accepted that row. An advisory row never blocks by itself. This document does not accept any row as a new block.

### Closure

Close or downgrade a risk only with evidence: a merged fix, an executed control, or a Product Authority decision that the impact is accepted. Clearing the row without that evidence is not closure.

### Review

Review open rows when a related source Issue merges, and again before a launch Go / No-Go. Owners do not self-approve closure of a risk they also implemented.

### Initial risk register

These domains are open. Owners are unassigned until Product Authority records one. None of these rows authorize remediation.

| ID | Domain | Release impact | Owner | Mitigation recorded here |
| --- | --- | --- | --- | --- |
| R1 | Post-merge instability | advisory | unassigned | Existing post-merge closeout |
| R2 | Soft-fail masking | advisory | unassigned | none recorded |
| R3 | Launch end-to-end gaps | advisory | unassigned | Existing launch-readiness specs where present |
| R4 | Authentication and protected routes | advisory | unassigned | `docs/reference/design/auth-model.md` |
| R5 | Content and admin readiness | advisory | unassigned | none recorded |
| R6 | Cloudflare deployment and bindings | advisory | unassigned | none recorded |
| R7 | Production telemetry and recovery | advisory | unassigned | Day-2 Operations role exists; procedure is not defined here |

Escalation is an Issue that names the risk ID. This register does not open those Issues.

## Part 2 — Launch technical debt registry (#2452)

Record only debt that threatens or slows a named website component or repository-support project for the 2027 fundraiser. Do not list general cleanup.

### Taxonomy

| Kind | Meaning |
| --- | --- |
| Technical | Code, schema, or runtime behavior that is known to be incomplete |
| Operational | A missing or manual production procedure |
| Documentation | An active document that contradicts its canonical owner |
| Governance | A control that is duplicated, temporary, or pointing at a retired path |

### Fields

- Description
- Kind
- Affected component or project
- Launch impact: blocks implementation, blocks testing, blocks deployment, blocks operations, or tolerable until after launch
- Disposition: remediate, defer, or accept
- Owner, or `unassigned`
- Retirement evidence: what must be true before the row is removed

### Severity

Order work by launch impact, not by how old the debt is.

1. Blocks deployment or operations
2. Blocks testing
3. Blocks implementation
4. Tolerable until after launch

A tolerable row stays visible. It is not deleted to shorten the list.

### Disposition

- **Remediate** when the impact blocks a named launch path and a source Issue exists.
- **Defer** when the impact is real and explicitly tolerable until after launch.
- **Accept** only when Product Authority records that the residual impact is acceptable.

This file does not assign those dispositions to new work. Action still requires a source Issue.

### Initial debt register

| ID | Kind | Domain | Launch impact | Disposition | Owner |
| --- | --- | --- | --- | --- | --- |
| D1 | Operational | CI reliability | tolerable until after launch | defer | unassigned |
| D2 | Operational | Deployment and environment | tolerable until after launch | defer | unassigned |
| D3 | Technical | Authentication and protected routes | tolerable until after launch | defer | unassigned |
| D4 | Technical | High-risk component gaps | tolerable until after launch | defer | unassigned |
| D5 | Operational | Content administration | tolerable until after launch | defer | unassigned |
| D6 | Technical | Test coverage | tolerable until after launch | defer | unassigned |
| D7 | Operational | Production observability | tolerable until after launch | defer | unassigned |
| D8 | Documentation | Authority and drift | tolerable until after launch | defer | unassigned |

D8 is watched with the monitored-documentation model in #2087. Rows stay deferred until a source Issue names a component and a disposition. No row here is accepted.

## Part 3 — Fundraiser launch readiness contract (#2453)

Production readiness is a set of pass or fail evidence items tied to a named component. It is not a score. This contract does not authorize deployment. Existing launch-readiness checks under `scripts/launch-readiness/` and `tests/e2e/launch-readiness-*.spec.ts` remain the implemented checks. This section classifies evidence; it does not add a runner.

### Evidence matrix

| Area | Component | Blocking or advisory | Evidence | Freshness |
| --- | --- | --- | --- | --- |
| Critical-path end-to-end | Public and FanClub routes covered by the existing launch-readiness specs | blocking when those specs are the authorized suite for that route | Passing spec result for the revision under test | The revision being launched |
| Authentication and protected routes | `/join`, `/fanclub`, `/fanclub/**` | blocking | Result compared with `docs/reference/design/auth-model.md` | The revision being launched |
| Homepage and navigation invariants | Public homepage and primary navigation | blocking | Comparison with the production design standard | The revision being launched |
| Mobile behavior | The same routes at a phone-width viewport | blocking | Recorded pass or fail for that viewport | The revision being launched |
| Accessibility and visual validation | Pages in the design standard's critical path | advisory until a source Issue names a blocking check | Named finding or explicit pass | The revision being launched |
| Performance and reliability | Production host | advisory until a threshold is named on a source Issue | Measurement attached to the revision | The revision being launched |
| Cloudflare preview | The pull request preview | blocking for merge promotion of that change | Preview check | That pull request |
| Cloudflare production | The production publish | blocking for launch Go | Production deploy record; see #2089 | That publish |
| D1 and B2 bindings | Data and media used by the launched routes | blocking | Binding and read evidence for the revision | The revision being launched |
| Telemetry, rollback, recovery | Production | blocking for launch Go | Rollback path recorded; see #2089 | That publish |
| Content and admin operations | Admin and editorial paths required for the fundraiser | advisory until a source Issue names the path | Operator pass or fail | The revision being launched |

Advisory rows do not block. A blocking row with missing or stale evidence is a fail.

### Gates and sign-off

| Gate | Who signs | What they are signing |
| --- | --- | --- |
| Project | The role that owns the source Issue's acceptance | The Issue's acceptance evidence exists |
| Phase | Product Authority | The phase's blocking rows passed |
| Deploy | Product Authority authorizes; Day-2 Operations records the publish | The production deploy record |
| Launch | Product Authority | Every blocking row for the launched components passed on that revision |

A builder does not sign off work they implemented. `READY FOR REVIEW` on a pull request is not a launch signature.

### Go / No-Go

Go only when every blocking row for the components in scope has fresh pass evidence. No-Go when any blocking row is missing, failed, or tied to a different revision. This checklist does not itself perform the Go.
