---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Canonical lane, role, promotion-profile, transition, communication, runner, and hold-state definitions
Does Not Own: Current team-member assignments, workflow implementation details, repository settings, or production credentials
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2640, #2641, #2639
Last Reviewed: 2026-08-18
---

# Operating Lanes and Promotion Profiles

## Purpose

Define the canonical durable roles, lane topology, promotion profiles, allowed transitions, communication, runner placement, and hold-state vocabulary for LGFC operations.

## Scope

- Owns canonical definitions for lanes, roles, promotion profiles, transitions, communication, runner placement, and hold states.
- Does not own current team-member assignments, workflow implementation details, repository settings, or production credentials.

## Current known truth

- Three horizontal lanes and one vertical Administration & Communications lane are canonical.
- Promotion profiles are Sandbox → Development → Promotion Candidate → Production; prohibited skips are binding.
- Durable roles are policy identities; concrete people/tools map through agent-team policy or project manifests.

## Intended final state

All operating docs, controllers, and handoffs use this vocabulary without alternate lane models or direct Sandbox or Development → Production paths.

## 1. Durable roles

Broad policy refers to roles, not individual people or software products.

| Role | Primary authority |
| --- | --- |
| Product Authority | Product outcome, priority, cost, and business decisions |
| PMO / Engineering | Requirements, design, architecture, acceptance criteria, planning, and implementation Go |
| Implementation / Operations | Scoped execution, testing, remediation, integration, promotion preparation, and deployment execution |
| PR Approver / Engineering | Independent validation that delivered work meets design and repository requirements |
| Administration & Communications | Evidence, routing, state reconciliation, acknowledgment, escalation, hold/resume, reporting, and closeout |
| Day-2 Operations | Production health, incident classification, containment, recovery strategy, and operational hold release |
| Deterministic CI | Machine-provable validation, evidence production, eligible non-main integration, and bounded authorized automation |

Current team members are mapped to these roles in the canonical agent-team policy or project manifest.

## 2. Lane topology

### Horizontal lanes

| Lane | Owns | Does not own |
| --- | --- | --- |
| PMO / Engineering | Intake, design, planning, decomposition, priority, Sandbox authority, implementation Go | Routine post-Go implementation execution |
| Implementation / Operations | Development, Promotion Candidate, testing, remediation, integration, deployment execution | Product or Engineering decisions; self-approval |
| Day-2 Operations | Monitoring, incidents, containment, recovery, production holds | Unrelated project planning after the incident is bounded |

### Vertical lane

| Lane | Owns | Does not own |
| --- | --- | --- |
| Administration & Communications | Cross-lane communication, issue/PR/check/deployment state, runner/controller routing, acknowledgments, escalation, evidence, reporting, hold/resume, closeout | Product, design, implementation, PR-approval, or recovery decisions |

## 3. Promotion profiles

| Profile | Entry | Required controls | Exit |
| --- | --- | --- | --- |
| Sandbox | PMO / Engineering authorizes an isolated experiment | Scaled-down build/test, secret scan, isolation, reproducibility; no production bindings | Discard, retain evidence, or adopt into Development |
| Development | Approved work package or adopted Sandbox result | Automated PR build/test/security/scope/metadata checks; protected-change routing; eligible non-main integration | Integrated Development result selected for Promotion Candidate |
| Promotion Candidate | Defined integrated Development SHA and release scope | Full applicable regression, integration, load/performance, security, migration, rollback, deployment-rehearsal, readiness, gap, and standards validation | Go/No-Go for Production |
| Production | Approved Promotion Candidate with no unreviewed drift | Full production authority, controlled promotion, deployment, rollback readiness, and live verification | Public feature under Day-2 Operations |

## 4. Transition rules

Allowed:

```text
PMO / Engineering -> Sandbox
PMO / Engineering -> Development
Sandbox -> Development
Development -> Promotion Candidate
Promotion Candidate -> Development        # remediation or material correction
Promotion Candidate -> Production
Production -> Day-2 Operations
Day-2 Operations -> Development            # corrective implementation
Day-2 Operations -> Promotion Candidate    # recovery release qualification when required
```

Prohibited:

```text
Sandbox -X-> Promotion Candidate
Sandbox -X-> Production
Development -X-> Production
```

Production promotion must identify the exact approved Promotion Candidate SHA or equivalent immutable release identity.

## 5. Gate expectations

### Sandbox gates

Required only to protect repository and environment safety:

- basic build or syntax validation when applicable;
- targeted tests for the experiment;
- secret scan;
- production-isolation check;
- reproducibility note;
- branch protection against Production promotion.

### Development gates

Automated and high-frequency:

- build, type, lint, and relevant tests;
- secret and security checks;
- scope and allowlist checks;
- metadata and branch-profile validation;
- protected-path detection;
- component branch freshness and state;
- deterministic eligibility for non-main integration.

A machine result should be recorded as automated eligibility or automated approval, not as a human Engineering judgment.

### Promotion Candidate gates

Comprehensive and solution-specific:

- integrated acceptance and regression testing;
- performance and load testing when applicable;
- security and privacy validation;
- migrations and data integrity;
- failure paths, resilience, and recovery;
- deployment and rollback rehearsal;
- operational readiness and monitoring;
- planned-versus-built and unresolved-gap review;
- documentation and repository-standards reconciliation;
- manual Go/No-Go by the required roles.

### Production gates

- exact approved candidate identity;
- no post-approval drift;
- required manual production authorization;
- current branch and environment state;
- production configuration and binding safety;
- rollback readiness;
- controlled merge/deployment;
- live smoke, route, asset, service, and health verification.

## 6. Communication events

The minimum canonical vocabulary is:

- `PROBLEM FOUND`
- `GUIDANCE`
- `ADJUSTMENT`
- `HOLD`
- `PLAN CHANGE REQUIRED`
- `RESUME`
- `IMPLEMENTATION HANDOFF`
- `PR REVIEW REQUEST`
- `APPROVED FOR INTEGRATION`
- `PROMOTION CANDIDATE READY`
- `PRODUCTION GO`
- `OPERATIONAL INCIDENT`
- `RECOVERY VERIFIED`
- `CLOSEOUT`

Issues and PRs carry durable authority and evidence. Labels carry current machine-readable routing/state. Check runs carry deterministic evidence. External notifications accelerate attention but do not become authority unless written back to GitHub.

## 7. Problem-adjustment ownership

Any role may report `PROBLEM FOUND`.

The finding routes to the role that made the controlling decision:

| Prior decision | Owning role |
| --- | --- |
| Product outcome or priority | Product Authority |
| Design, architecture, acceptance, project plan | PMO / Engineering |
| Bounded execution method within approved design | Implementation / Operations |
| PR disposition | PR Approver / Engineering |
| Routing, reporting, or closeout state | Administration & Communications |
| Incident classification, recovery strategy, hold release | Day-2 Operations |

Administration & Communications records the exchange and routes `RESUME`. Only the affected scope pauses unless evidence supports broader impact.

## 8. Runner and controller contract

The runner and routing controller are communications/control-plane infrastructure within Administration & Communications.

They may:

- observe and normalize events;
- route authorized actions;
- execute deterministic checks or bounded automation;
- publish acknowledgments and evidence;
- apply or clear authorized state markers;
- alert when delivery or communication fails.

They must not:

- invent execution authority;
- make product, design, approval, or recovery decisions;
- impersonate a human review;
- bypass profile transitions;
- promote Sandbox or Development directly to Production;
- merge to `main` without canonical production authority.

Runner host/service health, patches, capacity, security, stop/start, and recovery are Day-2 Operations responsibilities. Workflow creation and onboarding are Implementation / Operations responsibilities. The originating horizontal lane owns the meaning of the work request.

## 9. Operational holds

| Hold | Scope |
| --- | --- |
| Assessment hold | Broad pause while production impact and ownership are unknown |
| Targeted project hold | Projects or resources that may worsen or interfere with the incident |
| Incident-task hold | Only the affected implementation, deployment, or recovery task |
| No hold | Incident response continues in parallel with unrelated work |

A broad assessment hold should narrow when impact, probable cause, containment, affected scope, and resolution ownership are sufficiently understood. Full recovery is not required before unrelated work resumes.

## 10. Non-blocking Administration rule

Administration & Communications does not block work for pending prose, labels, dashboards, or bookkeeping. It may hold or return work only when evidence shows a substantive invariant failure, including missing authority, required task, acceptance, validation, approval, dependency, safety, production, or closeout integrity.