---
Doc Type: How-To
Audience: LGFC content operators, outreach owners, and AI implementation agents
Authority Level: Operational Procedure
Owns: Standard permission-request form letter and outreach procedure for rights holders of candidate Lou Gehrig content
Does Not Own: Rights conclusions, legal advice, publication approval, or the rights-evidence data model
Canonical Reference: /docs/reference/content-pipeline-rights-data-dictionary.md
Related issues: #4368, #3551, #4405
Last Reviewed: 2026-10-10
---

# Lou Gehrig Permission Request Form Letter

## Purpose

Some candidate content (photos, articles, footage) is worth using but is not free to use. Instead of dropping it, send the rights holder a short, consistent request. This page holds the standard letter and the steps for using it.

## When to use it

Use the letter when a candidate is on the owner-contact worklist: `rights_status` is `unknown`, or the source says "rights retained", "all rights reserved", or "contact for permission".

Do not use it for content that is already free to use with credit (public domain, CC0, CC BY, CC BY-SA). Those need only the credit line. See `lou-gehrig-free-use-content-discovery.md`.

## Procedure

1. Open the candidate and note `source_owner` (the actual creator or rights holder, not just the hosting site) and `contact_info`.
2. If `contact_info` is empty, find the source's rights, permissions, or reproductions contact page and record it on the candidate.
3. Copy the letter below, fill every `[bracket]`, and send it from the LGFC admin address.
4. Record the outreach in `rights_evidence`: date sent, recipient, and a copy of the letter. Set `usage_decision` to `hold` while waiting.
5. When the owner replies:
   - Written permission: keep the reply as evidence, record the exact credit wording and any conditions (use, size, duration), and have a human set the conclusion to `permission_granted`.
   - Refusal or conditions LGFC cannot meet (for example, a fee): set `usage_decision` to `deny`.
   - No reply: send one follow-up after 30 days. After that, leave the item on `hold`. Silence is never permission.
6. Never publish on `hold`, and never treat the sent letter as permission.

## Form letter

**Subject:** Permission request: [item title] for the Lou Gehrig Fan Club

Dear [name or "Rights and Permissions Team"],

I am writing on behalf of the Lou Gehrig Fan Club (LGFC), a fan-run community that honors Lou Gehrig's legacy and supports ALS awareness. Our website is at https://www.lougehrigfanclub.com.

We would like your non-exclusive permission to use the following on our website:

- **Item:** [title, date, and description]
- **Where we found it:** [source URL]
- **Creator / rights holder as we understand it:** [name]
- **How we would use it:** [hosted on the LGFC website, for example displayed alongside a story about Gehrig's [year/event]; full image or excerpt of [N words]]

**About LGFC and how we operate**

- Membership is free. We do not charge for membership or for access to this content.
- LGFC makes no profit. We do not sell this content, run advertising against it, or use it for commercial products.
- We credit every source. We would display your credit exactly as you specify, with a link back to your collection or website where you wish.
- We do not alter the work beyond cropping or resizing for display, and we do not imply that your organization endorses LGFC.
- If you ask us to remove the item, we will take it down promptly. Our contact for that is admin@lougehrigfanclub.com.

If you are the right person to approve this, could you reply to confirm that:

1. LGFC may use the item as described above, and
2. the credit line should read: "[proposed credit line]" (or tell us your preferred wording).

If this is not your decision to make, I would be grateful if you could point me to the right person. If there are conditions or a fee, please let us know, and we will decide whether we can accept them.

Thank you for preserving this material and for considering our request.

Sincerely,
[name]
[role], Lou Gehrig Fan Club
admin@lougehrigfanclub.com

## Notes for the sender

- Ask only for content LGFC can host and display on its own site. Do not request permission to link out: members should stay on the LGFC website, and link-only content is not admitted to the libraries.
- Keep one item or one closely related group per letter, so the answer maps to specific evidence.
- Do not say or imply that permission has been granted, or that publication is scheduled.
- Do not claim tax-exempt or charitable status. The letter says only what is true: free membership, no profit, full credit.
- The "no profit" and "free membership" statements must stay true. If LGFC policy changes, update this page before sending more letters.
- Rights conclusions remain a human decision under #3551.
- Holder-level outreach (organizations on #4368) uses this same letter. Product Authority reviews the template before the first send, per #4368 acceptance.
