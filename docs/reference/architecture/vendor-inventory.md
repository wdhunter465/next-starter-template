---
Doc Type: Reference
Audience: Human + AI
Authority Level: Supporting
Owns: Current LGFC vendor inventory for architecture and workflow documentation
Does Not Own: Vendor contracts, credentials, runtime configuration, implementation code, or diagram assets
Canonical Reference: /docs/reference/architecture/vendor-inventory.md
Related Issues: #4442, #4416, #4430, #4399, #4165, #4173, #4074, #4749
Last Reviewed: 2026-10-27
---

# LGFC Vendor Inventory

## Purpose

This document records the current LGFC vendor inventory for architecture discussions, workflow documentation, and future diagram accuracy.

It gives maintainers and AI agents a single reference for which vendors are active, which vendor roles are current, and which available vendors remain future or inactive.

## Scope

This reference covers LGFC vendors and vendor-adjacent services currently used or explicitly available for future use.

It does not define vendor contracts, credentials, implementation code, runtime configuration, procurement decisions, or any diagram asset file.

## Current known truth

The LGFC ecosystem currently uses vendors across design, development, repository operations, PR review, repository analysis, hosting, storage, email, website integrations, fundraising, merchandise, and social platforms.

Zapier is the chosen candidate for social cross-posting (#4416, 2026-10-27). It is not activated. No paid activation is approved. The monthly cost ceiling is still open; Bill decides it by 2026-11-06. Until it is activated, show Zapier as future or inactive in architecture diagrams. Credentials stay out of the repository.

Givebutter is the fundraising vendor. The 2027 campaign is peer-to-peer, and peer-to-peer is enabled (#4415). The campaign and auction are drafts and stay unpublished until the Live Like Lou Foundation approves. LGFC keeps zero donor or user information from Givebutter (#4139).

Public social accounts in scope (#4416): Facebook page `LouGehrigFanClub`, Instagram `@lougehrigfanclub`, X `@gehrigfanclub`, and Pinterest `lougehrigfanclub`. The private Facebook group is manual unless the chosen tool can reach it.

Agent and role-holder status follows `docs/governance/AGENT-TEAM.md`, which is the only place that maps roles to members. This inventory records which vendors are in use, not who holds a role.

## Intended final state

This document should remain the current vendor source for LGFC architecture and workflow documentation.

If a vendor is added, removed, activated, retired, or reclassified, this document should be updated before dependent architecture diagrams or workflow docs are updated.

## Design, Development, and Repository Operations

In use (the two agent team members, per `docs/governance/AGENT-TEAM.md`):

- Anthropic (Claude Code)
- Cursor
- GitHub
- GitHub Copilot (pull request review only)

Occasional or assigned only (not durable role holders):

- Grok (occasional implementation on Issues Product Authority assigns)
- Jules (implementation only when explicitly assigned)

Research, monitoring and evaluation:

- Gemini (research and repository monitoring and reporting; read-only unless separately authorized)
- CloudflareAI (evaluation and support under recorded access)

Retired, not in use: the OpenAI-based members ChatGPT, Work and Codex ChatBot (#4074, #4165, #4173) and Devin (#4399). Historical records that name them are not rewritten.

## PR Reviewers

- Cubic
- GitHub Copilot

## Gate Checks and Repository Analysis

- Semgrep
- Deepwiki

## Repository Wiki

- Cubic

## Hosting, Storage, Email, Website Integrations, and Social Platforms

- Cloudflare
- Backblaze B2
- Apple (email address masking only; no mailbox or routing)
- MailChannels
- Elfsight
- Givebutter
- Bonfire
- Facebook
- Instagram
- Pinterest
- X (Twitter)

## Future / Available Vendors

- Zapier — chosen candidate for social cross-posting, not activated, and not in use.

## Notes

- Owners, environments, dependencies, monitors, and reconciliation dates for these vendors' assets are recorded in `docs/reference/platform/lgfc-asset-register.md` (#4535).
- This document lists LGFC vendors in use and one available future automation vendor. Vendors in the Gate Checks, Repository Wiki, and Hosting sections were not re-verified on 2026-10-09; the agent, reviewer, Zapier and Givebutter entries were.
- Bonfire is the LGFC store vendor.
- Inbound club mail (confirmed by Product Authority, 2026-10-21, #4757): mail to the club addresses reaches Cloudflare Email Routing (the domain's MX records), whose routing rules forward `admin@`, `support@` and `test@` on `lougehrigfanclub.com` to the club's mailbox; the catch-all rule drops mail to any other address. `test@` stays configured for email testing in parallel with the production addresses. Apple provides email address masking only, with no mailbox or routing role. Member replies to join email go to `admin@lougehrigfanclub.com` and take this path. Copyright permission requests and replies do not use the club addresses published on the website: they go through Product Authority's own mailbox (#4749).
- MailChannels is used for outbound transactional email delivery. Website email is sent from `admin@lougehrigfanclub.com` or `support@lougehrigfanclub.com` (#4751).
- Zapier must be shown as future or inactive in architecture diagrams until it is activated. No paid activation is approved, and the monthly cost ceiling is still open (#4416).
