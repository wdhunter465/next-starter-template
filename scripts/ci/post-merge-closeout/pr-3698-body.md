<!-- CURSOR_AGENT_PR_BODY_BEGIN -->
- **Issue:** #3634
- Related exception: #3699

## FILE-TOUCH ALLOWLIST (MANDATORY)
Allowed files:
- `docs/how-to/website/member-submission-review.md`
- `docs/how-to/website/member-content-submission.md`
- `docs/reference/content/member-submission-content-model.md`

## CHANGE SUMMARY
- PR #3698 aligned member-submission documentation with runtime `rights_choice` behavior.
- Exception #3699 captured six late Copilot findings that were reconciled in PR #3737.
- Successor exception #3742 captured the non-canonical closeout-body format finding from PR #3737.

## BUILD / TEST / VERIFICATION
- Commands run:
  - `node -e "const fs=require('fs');const s=fs.readFileSync('/tmp/pr-3698-body.md','utf8');for(const x of ['CURSOR_AGENT_PR_BODY_BEGIN','## FILE-TOUCH ALLOWLIST (MANDATORY)','## BUILD / TEST / VERIFICATION','## REVIEWER RESPONSE ACCOUNTING','CURSOR_AGENT_PR_BODY_END'])if(!s.includes(x))process.exit(1)"` — PASS
- Gate verification:
  - PR #3737 reviewer thread `3857339295` inspected: YES
  - Required canonical closeout sections present: YES
- Result summary: PASS

## ACCEPTANCE CRITERIA
- [x] All six late PR #3698 reviewer findings are reconciled.
- [x] Documentation distinguishes immediate `member_owns_full_grant` rights clearance from held external-source evaluation.
- [x] Verification targets both rights paths.
- [x] Invalid `rights_choice` sequencing matches runtime behavior.
- [x] `rights_choice` requirement is documented for member content-pipeline intake.
- [x] Privacy/follow-up override for full-grant submissions is documented.
- [x] Closeout body uses the canonical managed-body structure required by downstream parsers.

## REVIEWER RESPONSE ACCOUNTING
- review-comment:3852925897 — accepted — opening review procedure now states rights state is conditional on `rights_choice`; full-grant clears rights immediately while external-source submissions remain held. — thread state: outdated
- review-comment:3852925943 — accepted — verification explicitly tests both external-source held state and full-grant `rights_hold = 0`. — thread state: outdated
- review-comment:3852925976 — accepted — procedure distinguishes immediate rights clearance from independent privacy/content/publication gates. — thread state: outdated
- review-comment:3852926014 — accepted — failure-order wording matches runtime: rejection occurs before file-byte read or B2 write, while a file-presence check may occur first. — thread state: outdated
- review-comment:3852926064 — accepted — content model/procedure document `rights_choice` for member content-pipeline intake as well as Path C uploads. — thread state: outdated
- review-comment:3852926090 — accepted — rights-state table documents independent review overrides for full-grant submissions. — thread state: outdated
- review-comment:3857339295 — accepted — replaced the non-canonical PR-template-like closeout body with the canonical managed-body structure used by downstream closeout parsers. — thread state: resolved

## PR GATE READINESS CHECKLIST
- [x] Originating PR #3698 reviewer findings accounted for.
- [x] PR #3737 successor reviewer finding accounted for.
- [x] Canonical closeout structure verified.

## POST-MERGE CLOSEOUT CHECKLIST
- [x] PR #3698 merge lineage retained.
- [x] Exception #3699 retained as source lineage.
- [x] Successor exception #3742 records the final closeout-format correction.

## REQUIRED PRE-REVIEW SELF-CHECK
- [x] PR body contains all required canonical sections.
- [x] Allowed files section matches the PR #3698 documentation scope.
- [x] All reviewer feedback has explicit disposition where required.

## PROGRESS + READINESS (MANDATORY)
- Status: REMEDIATED
<!-- CURSOR_AGENT_PR_BODY_END -->
