---
Doc Type: Operational Rules
Audience: AI (Codex) — RETIRED
Authority Level: Agent-Specific — RETIRED
Owns: Historical record only
Does Not Own: Any current agent-team policy, Operations authority, implementation authority, review authority, or Production approval
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3755, #3808, #4052, #3126, #4165
Last Reviewed: 2026-09-19
---

# CODEX-RULES.md — RETIRED

**RETIRED 2026-09-19 (#4165).** Product Authority permanently terminated Codex as an LGFC agent. Codex holds no current LGFC team role, Operations first-responder authority, implementation authority, review authority, or wake/dispatch path. No product should run a Codex startup contract or accept `agent:codex` as a live assignment. This file is retained only because bootstrap/governance checks require the historical pointer path; it must not be treated as current authority.

Live Codex dispatch workflows, the `lgfc-codex` runner contract, and the #3125/#3126 configuration stack were removed under #4165. Host runner uninstall and secret deletion remain operator/admin work.

Canonical role mapping lives in `docs/governance/AGENT-TEAM.md`. Shared execution discipline lives in `docs/ops/ai/CORE-RULES.md`.
