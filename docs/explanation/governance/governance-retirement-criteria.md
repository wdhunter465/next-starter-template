---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: The test for retiring a temporary governance control, and the current candidate list for #2458
Does Not Own: Permission to retire a control, GitHub authority, or builder and reviewer separation
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2458, #2449, #3155
Last Reviewed: 2026-09-27
---

# Governance retirement criteria

A control may be retired only after its replacement is operating and evidenced, and only with a written rationale and a rollback. Speed during website build-out is not a retirement reason. This file retires nothing.

## Test

All of these must be true:

1. The control was temporary, duplicate, or tied to a condition that has ended.
2. A named replacement is already in use, not merely proposed.
3. Evidence shows the replacement caught or recorded the same class of defect the old control existed for.
4. GitHub Issues and pull requests remain the executable authority.
5. Builder and reviewer separation still applies.
6. Human merge and launch authorization still apply.
7. Product Authority, or the recorded Governance holder, authorizes the retirement.
8. Rollback is the previous document or check, restorable by reverting the retirement change. Historical rows are not erased.

If any item is false, the disposition is keep.

## Who authorizes

Product Authority authorizes retirement of a protected control. A recorded Governance holder may authorize retirement of a non-protected duplicate only when the test above passes. The implementer of the replacement does not approve the retirement.

## Candidates

| Candidate | Disposition now | Why it is not retired |
| --- | --- | --- |
| Temporary reconciliation procedures | Keep | No demonstrated automated replacement is named here |
| Duplicate closeout reports | Keep | Which report is the survivor is not evidenced here |
| Manual checks that CI now performs | Keep until the specific check is named | A general claim that CI replaced them is not evidence |
| Stale tracker controls | Keep | #3155 owns migration accounting; this list does not close it |
| Redundant documentation validation paths | Keep | Header and folder checks are still the active controls |
| Transitional Diátaxis artifacts | Keep | #3155 is open. Retiring them here would hide unfinished migration |

Recommended timing for every row is after the replacement evidence exists and #3155 has accounted for any documentation path the row would remove. That timing is not now.
