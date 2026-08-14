---
Doc Type: How-To
Audience: LGFC editors, admins, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Takedown-request intake and recording procedure, member soft-deletion procedure, operational response SLA, and recovery/restore steps
Does Not Own: Runtime moderation UI, D1 migrations, legal policy, or public-copy authorship
Canonical Reference: /docs/ops/reports/compliance-product-decision-register-2919.md
Related Issues: #2784, #2918, #2919
Last Reviewed: 2026-08-05
---

# Handle a Takedown Request or Member Deletion Request

## Purpose

Define the administrator procedure for recording an auditable takedown/suppression against published content, and for soft-deleting a member account, per the #2919 approved Product Decision Record (items 5 and 6).

## Scope

Covers the two administrator-controlled evidence controls built for #2919: `POST /api/admin/editorial/suppress` (content takedown) and `POST /api/admin/member-operations/delete` (member soft-deletion/restore). Both are reversible-by-design (nothing is hard-deleted) and both leave an audit trail. Does not cover a public-facing takedown route (none exists, per the approved decision), session revocation, or any destructive/hard-deletion path.

## Current known truth

Both controls are additive, admin-only, and reversible; no hard-delete path exists in the repository for either content or member records. Soft-deletion does not currently revoke an active session or block login for a soft-deleted account — see "What soft-deletion does not currently do" below.

## Operational response SLA

Acknowledge a takedown or deletion request received at `Support@LouGehrigFanClub.com` or `admin@lougehrigfanclub.com` within **5 business days**, and complete the recorded action (suppression or soft-deletion) within **30 days** of acknowledgment, consistent with the response window referenced in `docs/reference/content/member-submission-content-model.md`. If a request requires escalation (e.g., disputed ownership, unclear scope), note the delay reason in the resolution field described below rather than leaving the request unacknowledged.

## Procedure: takedown / content suppression

### When to use this

A rights holder, subject, or other party emails Support or Admin asking that specific published content (a photo, article, memorabilia entry, or other Library item) be removed.

### Procedure

1. Confirm the request is legitimate and identify the exact `content_inventory` record(s) affected (by title, tag, or URL).
2. Call `POST /api/admin/editorial/suppress` with an admin token:
   ```json
   {
     "content_inventory_id": 123,
     "suppression_reason": "Rights holder requested removal; no verifiable public-domain status.",
     "takedown_request_source": "Support@LouGehrigFanClub.com email from <requester>, 2026-08-05",
     "takedown_resolution_note": "optional — any additional context"
   }
   ```
3. The record's `status` becomes `archived`; it drops out of published/draft admin views by default. The row itself, and the reason/source/timestamp, are **not** deleted — this is the audit evidence.
4. Reply to the requester confirming the content has been removed from public display.

### There is no separate public takedown route

Takedown requests are handled entirely through the existing email intake (`/contact`) and this admin action. No dedicated public-facing takedown form or route exists, per the #2919 approved Product decision.

### Recovery

To restore suppressed content, an operator updates the `content_inventory` row's `status` back to `published` or `draft` directly (via the existing admin editorial tools) and may clear `suppression_reason`/`takedown_request_source`/`takedown_resolution_note` if the takedown is being formally rescinded — but should generally leave the audit fields in place with a note added, so the history of the request is not lost.

## Member soft-deletion

### When to use this

A member emails Support or Admin asking that their account be deleted.

### Procedure

1. Confirm the requester's identity matches the account email.
2. Call `POST /api/admin/member-operations/delete` with an admin token:
   ```json
   {
     "email": "member@example.com",
     "action": "delete",
     "deletion_reason": "Member requested account deletion by email, 2026-08-05.",
     "deleted_by": "admin@lougehrigfanclub.com"
   }
   ```
3. The `members` row is marked `deleted_at`/`deletion_reason`/`deleted_by`; the matching `join_requests` row is marked `deleted_at` too. Neither row is removed.
4. Reply to the requester confirming the account has been deleted.

### What soft-deletion does not currently do

This control does not currently block an existing session or prevent login for a soft-deleted account — it is a data-lifecycle marker and audit record, not a session-revocation mechanism. That capability was not authorized by the #2919 Product Decision Record and is out of this task's bounded envelope. It is tracked as a bounded, explicitly held follow-up: #3076.

### Recovery

Soft-deletion is reversible. Call the same endpoint with `"action": "restore"` and the member's `email` (no other fields required) to clear the deletion markers on both `members` and `join_requests`.

### Destructive deletion is not authorized

There is no hard-delete path for members or their data anywhere in this control. Do not attempt to remove rows directly; use the soft-delete/restore actions above so the audit trail is preserved.
