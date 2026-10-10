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

## Outcomes

Permission received means the content is added to the library and used on the website with its source cited. No permission (denied, fee required, or no reply) means the content is noted in the library so it is not duplicated when found again, and it is never used on the website.

## One letter per source, not per item

Ask once per source (rights holder or collection), so one exchange settles permission for the source as a whole. The letter names the specific URLs where we found content, then asks for permission across "Gehrig and Gehrig-related content" the source holds. This avoids asking one piece at a time.

## Procedure

1. Group the on-hold candidates by `source_owner` (the actual creator or rights holder, not just the hosting site). One group, one letter.
2. Note `contact_info` for the group. If it is empty, find the source's rights, permissions, or reproductions contact page and record it.
3. Copy the letter below, fill every `[bracket]`, list the specific URLs found, and send it from the LGFC admin address.
4. Archive the exchange (see Archive record below). Set `usage_decision` to `hold` on every candidate in the group while waiting.
5. When the owner replies:
   - Written permission: archive the reply, record the exact scope granted, the credit wording and any conditions (use, size, duration, exclusions). A human sets the conclusion to `permission_granted` for the candidates the scope covers. Later finds from the same source inside that scope link to the same grant instead of a new request.
   - Refusal: record the denial and its scope, and set `usage_decision` to `deny` for the source's candidates it covers. Keep the records in the library so the same content is not added again if a later search finds it. Never use denied content on the website.
   - Conditions LGFC cannot meet (for example, a fee): set `usage_decision` to `deny` and flag fee-required.
   - No reply: send one follow-up after 30 days. After that, leave the items on `hold`. Silence is never permission.
6. A grant covers only what the reply says. If the owner limits it (for example, excludes some items or media types), record the exclusions and treat those items as not permitted.
7. Never publish on `hold`, and never treat the sent letter as permission.

## Archive record

LGFC must be able to show, for every asset in the library, that permission was asked for and given. For each exchange, archive:

- the full message as sent and each reply (subject, body, date and time, direction);
- sender and recipient addresses, including cc and bcc, and the message IDs;
- attachments;
- the scope requested and the scope granted or denied;
- the URLs listed in the request;
- the credit wording and conditions the owner stated;
- links from each affected candidate and library asset to the exchange that covers it.

The target home for this record is D1, so each library asset points to its permission trail. The D1 archive is not built yet (see Issue #4526). Until it exists, keep the original emails in the LGFC admin mailbox under a permission label, and record the message reference on each affected candidate's `rights_evidence`.

## Form letter

**Subject:** Permission request: [item title] for the Lou Gehrig Fan Club

Dear [name or "Rights and Permissions Team"],

I am writing on behalf of the Lou Gehrig Fan Club (LGFC), a fan-run community that honors Lou Gehrig's legacy and supports ALS awareness. Our website is at https://www.lougehrigfanclub.com.

We would like your non-exclusive permission to use Gehrig and Gehrig-related content from [source or collection name] on our website.

**What we found.** We have so far identified this content at:

- [URL 1: title, date, short description]
- [URL 2: title, date, short description]

**What we are asking.** We are asking for permission for these items and, more broadly, for Gehrig and Gehrig-related content that [source] holds the rights to, so that we do not need to come back to you one piece at a time. If you would prefer to limit the permission, for example to certain items, media types or dates, please tell us the limits and we will follow them.

**How we would use it.** Hosted on the LGFC website, for example displayed alongside a story about Gehrig's [year/event], as the full item or an excerpt with credit.

**Creator / rights holder as we understand it:** [name]

**About LGFC and how we operate**

- Membership is free. We do not charge for membership or for access to this content.
- LGFC makes no profit. We do not sell this content, run advertising against it, or use it for commercial products.
- We credit every source. We would display your credit exactly as you specify, with a link back to your collection or website where you wish.
- We do not alter the work beyond cropping or resizing for display, and we do not imply that your organization endorses LGFC.
- If you ask us to remove any item, we will take it down promptly. Our contact for that is admin@lougehrigfanclub.com.

If you are the right person to approve this, could you reply to confirm that:

1. LGFC may use the items above and Gehrig and Gehrig-related content from [source] as described (or tell us the limits),
2. who the rights holder is, if different from the above, and
3. the credit line should read: "[proposed credit line]" (or tell us your preferred wording).

If this is not your decision to make, I would be grateful if you could point me to the right person. If there are conditions or a fee, please let us know, and we will decide whether we can accept them.

Thank you for preserving this material and for considering our request.

Sincerely,
[name]
[role], Lou Gehrig Fan Club
admin@lougehrigfanclub.com

## Notes for the sender

- Ask only for content LGFC can host and display on its own site. Do not request permission to link out: members should stay on the LGFC website, and link-only content is not admitted to the libraries.
- Send one letter per source, naming the specific URLs found. Do not ask for blanket permission beyond what the source holds, and do not describe a grant as wider than the reply states.
- Do not say or imply that permission has been granted, or that publication is scheduled.
- Do not claim tax-exempt or charitable status. The letter says only what is true: free membership, no profit, full credit.
- The "no profit" and "free membership" statements must stay true. If LGFC policy changes, update this page before sending more letters.
- Rights conclusions remain a human decision under #3551.
- Holder-level outreach (organizations on #4368) uses this same letter. Product Authority reviews the template before the first send, per #4368 acceptance.
