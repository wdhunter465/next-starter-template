---
Doc Type: Template
Audience: Human + AI
Authority Level: Operational
Owns: Package-complete project-child and child-remediation Issue format
Does Not Own: Project Graduation, priority, Product/Production decisions, PR approval, or merge authority
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #3055, #3113
Last Reviewed: 2026-08-06
---

# Executable Child Task Template

A child may enter the executable queue only when every applicable field below is complete. Missing fields produce `PACKAGE-INCOMPLETE` before branch creation or editing.

## Authority and sequence

- Primary source Issue: #____
- Parent project: #____
- Task ID / sequence: ____
- Project Graduation GO: ____
- Predecessor and required WORK acceptance: ____ (ordered predecessor — not queue-wide block)
- Successor: #____ | terminal
- Execution relationship: serial | parallel-authorized
- Parallel collision proof: ____ | not applicable
- Advisory prerequisites (comments only; do not deny collision-safe work): ____
- Assigned Implementation / Operations role holder: ____ (preserve Product-authorized routing)
- WORK acceptance/closeout owner: WORK

## Objective and deliverable

- One bounded objective: ____
- Exact observable deliverable: ____
- Explicit non-goals: ____

## Git and writable scope

- Starting target SHA must be recorded before editing: yes
- Working-branch naming rule: ____
- PR target branch: ____
- Writable files/actions:
  - ____
- Prohibited files/actions:
  - ____

## Acceptance and implementation

- Observable acceptance criteria:
  - [ ] ____
- Exact implementation requirements:
  - ____
- Positive validation:
  - command/evidence: ____
  - expected result: ____
- Negative/failure-path validation:
  - command/scenario: ____
  - expected safe failure/result: ____
- Durable evidence location: ____

## Safety, rollback, and recovery

- Rollback/disable/recovery procedure: ____
- Protected Product/Production/legal/privacy/rights/cost/provider/credential/destructive-data/public-claim boundaries: ____
- Stop conditions: ____
- Bounded increment split (when only part is gated): ____ | not applicable
- HOLD owner, evidence, and release condition when applicable (protected stop or real collision only): ____ | not applicable

## Independent review

- Independent reviewer role holder: ____
- Builder self-approval: prohibited
- Builder self-merge: prohibited
- Required review/check evidence: ____

## Pre-implementation checkpoint

Record on the live Issue before branch creation or editing:

- exact starting SHA;
- working branch;
- allowlist confirmation;
- predecessor deterministic-completion evidence (validated merge + post-merge closeout, or WORK `ACCEPT` when a substantive gate is defined);
- package-complete confirmation;
- collision/dependency/hold check (distinguish advisory prerequisite, ordered predecessor, real collision, protected stop);
- Team eligibility and `agent:*` claim confirmation (`team:*` ownership unchanged);
- protected-stop check;
- validation and rollback confirmation.

Result: `PASS` | `PACKAGE-INCOMPLETE` | `HOLD` (evidence-specific protected stop or real collision only)

## Implementation handoff packet

- final commit/head SHA;
- exact changed files/actions;
- implementation summary;
- tests and failure-path results;
- check results;
- unresolved findings/risks;
- rollback readiness;
- PR/integration identity;
- scope confirmation.

## WORK closeout packet

WORK independently reviews the source package, final diff, tests, checks, review dispositions, integration identity, post-integration evidence, documentation, rollback, and unresolved exceptions when substantive assurance is required or a discrepancy appears.

Disposition: `ACCEPT` | `HOLD` (protected stop or real collision only) | `REMEDIATE` | `VERIFY MORE`

On deterministic predecessor completion (and on `ACCEPT` when a substantive gate applies):

- reconcile and close the child when mechanically or judgmentally authorized;
- reconcile parent progress;
- identify the next serial successor;
- verify successor package completeness and real dependency/collision/hold state;
- allow an eligible agent to self-claim the successor under standing Project Graduation authority;
- emit runtime wake transport if applicable;
- do not require repeat Administration or PMO dispatch.

While predecessor is in review, WORK prepares the successor package before implementer idle time.

WORK cannot independently verify or approve a PR implemented by WORK.
