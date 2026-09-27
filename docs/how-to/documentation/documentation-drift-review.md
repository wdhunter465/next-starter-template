---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational Authority
Owns: The repeatable review used to find documentation drift and open a follow-up Issue
Does Not Own: The authority hierarchy, permission to waive documentation impact, or CI implementation
Canonical Reference: /docs/explanation/operations/documentation-monitored-assets.md
Related Issues: #2087
Last Reviewed: 2026-09-27
---

# Review documentation drift

Use this procedure when a change, closeout, or reading shows that an operational document may not match as-built behavior or its canonical owner.

## Steps

1. Name the document and the behavior or rule it claims to describe.
2. Open the canonical owner in that document's `Canonical Reference` header. If the header is missing, treat the missing header as the finding.
3. Compare the claim with the canonical owner and with the current code or workflow only for the behavior just changed. Do not inventory the whole repository.
4. Classify the result:
   - **Match.** No Issue.
   - **Stale claim.** The canonical owner or the code has moved. The monitored document needs an edit.
   - **Competing rule.** Two active documents give different instructions. The canonical owner wins. The other document must point at it or be superseded.
   - **Historical file used as current.** An archive, snapshot, or retired-agent file is being followed. Route the reader to the current owner.
5. If the correcting edit is not in the current pull request, open one Issue. Include the file paths, the contradiction in one or two sentences, and the canonical owner. Do not bundle unrelated drift.
6. Do not change workflow files, do not bulk-migrate folders, and do not mark documentation impact exempt from review.

## Execution

Stop when the finding is recorded on an Issue or corrected in the same pull request that caused it. This procedure does not authorize the remediation Issue's implementation.
