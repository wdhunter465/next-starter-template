---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---

# Governance — Change Control

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Define how production changes are proposed, reviewed, executed, verified, and (if needed) rolled back for the LGFC repository and Cloudflare Pages deployment.

## Scope
- Any change merged into the repository (code, config, CI, docs).
- Any change that could affect production behavior, governance enforcement, or recovery capability.

## Authority & precedence
- This file governs change mechanics.
- Design truth comes from `/docs/reference/design/LGFC-Production-Design-and-Standards.md` and `docs/reference/design/LGFC-Production-Design-and-Standards.md`.
- If documents conflict, follow `/docs/governance/document-authority-hierarchy_MASTER.md`.

## Change units (non-negotiable)
- One PR = one intent label (see `/docs/governance/pr-intent-labels.md` and `/docs/governance/PR_GOVERNANCE.md`).
- PR templates and file-touch allowlists are enforced by CI (drift gates).

## Standard change flow (Day-2 Operations)
1. **Classify**: choose the single intent label that matches the work (infra/docs-only/feature/change-ops/platform/codex).
2. **Scope-lock**: define the exact files allowed to change (must satisfy drift gate).
3. **Execute**: apply the minimum change set.
4. **Verify**: run required checks and post-merge verification (see `/docs/governance/verification-criteria_MASTER.md`).
5. **Document**: update authoritative Ops docs in the same PR when required.

## Emergency change flow (production incident)
Use when production is broken or security risk is active.
- Still use a single PR + single intent label.
- Prefer smallest safe change that restores last-known-good behavior.
- Explicitly record the rollback plan in the PR description.
- After stabilization: open a follow-up “change-ops” PR for RCA + hardening.

## Rollback rule
Rollback is a *normal operation*, not a failure.
- If any verification gate fails post-merge or a regression is observed:
  - Revert the PR immediately (fastest path).
  - Then debug in a new PR.

## Required artifacts for every change
- Clear change summary.
- Acceptance criteria that can be verified.
- Verification steps (commands and expected outcomes).
- Documentation impact statement (“Docs updated: <files>” or “No docs updates required.”).

## Auditable record
- Operations records must be written to repo docs, not chat.
- Use `/docs/ops/deploy-log.md` and `/docs/postmortems/*` when applicable.
