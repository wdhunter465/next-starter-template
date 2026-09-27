---
Doc Type: Reference
Audience: Human + AI
Authority Level: Informational
Owns: The launch-relevant debt taxonomy and disposition rules for #2452
Does Not Own: An inventory of every repository imperfection, or permission to remediate a row
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2452, #2449
Last Reviewed: 2026-09-27
---

# Launch technical debt registry

Record only debt that threatens or slows a named website component or repository-support project for the 2027 fundraiser. Do not list general cleanup.

## Taxonomy

| Kind | Meaning |
| --- | --- |
| Technical | Code, schema, or runtime behavior that is known to be incomplete |
| Operational | A missing or manual production procedure |
| Documentation | An active document that contradicts its canonical owner |
| Governance | A control that is duplicated, temporary, or pointing at a retired path |

## Fields

- Description
- Kind
- Affected component or project
- Launch impact: blocks implementation, blocks testing, blocks deployment, blocks operations, or tolerable until after launch
- Disposition: remediate, defer, or accept
- Owner, or `unassigned`
- Retirement evidence: what must be true before the row is removed

## Severity

Order work by launch impact, not by how old the debt is.

1. Blocks deployment or operations
2. Blocks testing
3. Blocks implementation
4. Tolerable until after launch

A tolerable row stays visible. It is not deleted to shorten the list.

## Disposition

- **Remediate** when the impact blocks a named launch path and a source Issue exists.
- **Defer** when the impact is real and explicitly tolerable until after launch.
- **Accept** only when Product Authority records that the residual impact is acceptable.

This file does not assign those dispositions to new work. Action still requires a source Issue.

## Initial register

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

D8 is watched with the model in #2087. Rows stay deferred until a source Issue names a component and a disposition. No row here is accepted.
