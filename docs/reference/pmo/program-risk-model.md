---
Doc Type: Reference
Audience: Human + AI
Authority Level: Informational
Owns: The lightweight program-risk field model and gate-blocking test for #2451
Does Not Own: A separate authority hierarchy, permission to remediate a risk, or a claim that the initial rows are already mitigated
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2451, #2449
Last Reviewed: 2026-09-27
---

# Program risk model

This is the risk record for threats to the website components and repository-support work required for the 2027 fundraiser. It does not create a second portfolio. A risk becomes executable work only when Product Authority names a source Issue for it.

## Fields

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

## When a risk blocks

A risk blocks a phase gate, merge, deploy, or launch only when its release impact says so and Product Authority has accepted that row. An advisory row never blocks by itself. This document does not accept any row as a new block.

## Closure

Close or downgrade a risk only with evidence: a merged fix, an executed control, or a Product Authority decision that the impact is accepted. Clearing the row without that evidence is not closure.

## Review

Review open rows when a related source Issue merges, and again before a launch Go / No-Go. Owners do not self-approve closure of a risk they also implemented.

## Initial register

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
