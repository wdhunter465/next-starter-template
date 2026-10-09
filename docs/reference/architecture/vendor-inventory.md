---
Doc Type: Reference
Audience: Human + AI
Authority Level: Supporting
Owns: Current LGFC vendor inventory for architecture and workflow documentation
Does Not Own: Vendor contracts, credentials, runtime configuration, implementation code, or diagram assets
Canonical Reference: /docs/reference/architecture/vendor-inventory.md
Related Issues: #4442, #4416, #4430, #4399, #4165, #4173, #4074
Last Reviewed: 2026-10-09
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

Zapier is available but not currently active. It must be shown as future or inactive in architecture diagrams unless later activated. Whether to activate it (paid tier, credentials) or choose another tool for social announcements is a pending Product Authority decision (P-02, #4416). Until that is recorded, no social-posting tool is active.

Givebutter is the fundraising vendor. No 2027 Givebutter campaign has been created yet (#4430). LGFC keeps zero donor or user information from Givebutter (#4139).

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
- Apple iCloud Mail
- MailChannels
- Elfsight
- Givebutter
- Bonfire
- Facebook
- Instagram
- Pinterest
- X (Twitter)

## Future / Available Vendors

- Zapier — available, but not currently in use.

## Notes

- This document lists LGFC vendors in use and one available future automation vendor. Vendors in the Gate Checks, Repository Wiki, and Hosting sections were not re-verified on 2026-10-09; the agent, reviewer, Zapier and Givebutter entries were.
- Bonfire is the LGFC store vendor.
- Apple iCloud Mail is used for the custom email domain mailbox layer.
- MailChannels is used for outbound transactional email delivery.
- Zapier must be shown as future or inactive in architecture diagrams unless later activated.
