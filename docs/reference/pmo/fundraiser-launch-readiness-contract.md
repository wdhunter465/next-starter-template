---
Doc Type: Reference
Audience: Human + AI
Authority Level: Informational
Owns: The evidence contract for deciding production readiness of the 2027 fundraiser website for #2453
Does Not Own: Permission to deploy, a composite score, or replacement of existing launch-readiness checks
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #2453, #2449, #2089
Last Reviewed: 2026-09-27
---

# Fundraiser launch readiness contract

Production readiness is a set of pass or fail evidence items tied to a named component. It is not a score. This contract does not authorize deployment. Existing launch-readiness checks under `scripts/launch-readiness/` and `tests/e2e/launch-readiness-*.spec.ts` remain the implemented checks. This file classifies evidence; it does not add a runner.

## Evidence matrix

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

## Gates and sign-off

| Gate | Who signs | What they are signing |
| --- | --- | --- |
| Project | The role that owns the source Issue's acceptance | The Issue's acceptance evidence exists |
| Phase | Product Authority | The phase's blocking rows passed |
| Deploy | Product Authority authorizes; Day-2 Operations records the publish | The production deploy record |
| Launch | Product Authority | Every blocking row for the launched components passed on that revision |

A builder does not sign off work they implemented. `READY FOR REVIEW` on a pull request is not a launch signature.

## Go / No-Go

Go only when every blocking row for the components in scope has fresh pass evidence. No-Go when any blocking row is missing, failed, or tied to a different revision. This checklist does not itself perform the Go.
