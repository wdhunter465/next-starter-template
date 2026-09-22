---
Doc Type: Governance
Audience: Human + AI
Authority Level: Controlled
Owns: Supporting PR governance guidance, UI/layout PR references, documentation header compliance
Does Not Own: Canonical PR-process policy, PR body authority, PR-process CI promotion policy
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #1719, #1723, #4213
Last Reviewed: 2026-09-22
---

# Website Pull Request Governance

This document is a supporting governance reference. The canonical pull request process is `/docs/governance/PR_PROCESS.md`.

## Required PR framing

1. Follow `/docs/governance/PR_PROCESS.md`.
2. Use `.github/pull_request_template.md`.
3. Summarize exact edits with file paths.
4. Link source issue and any required follow-up issue.

## Merge authority (summary)

- Merge to `main` requires Product Authority approval (CMO when Product Authority is unavailable and a CMO holder is recorded in `docs/governance/AGENT-TEAM.md`). The current Product Authority holder is mapped only in `docs/governance/AGENT-TEAM.md`.
- Non-`main` Model B component integration may follow `/docs/governance/PR_PROCESS.md` when the source issue authorizes `component-auto-integration`.
- Governance documentation on an authorized project component branch is version-controlled project work; it does not create an intermediate human gate solely because the files live under `docs/governance/**`.
- Project-branch docs become repository-wide authority only after Product Authority-approved promotion to `main` (or a separate early documentation promotion when another active project must consume the rule first).
- Cursor does not self-approve or self-merge. Cursor does not merge to `main`.

Full matrix: `/docs/ops/reports/pr-readiness-merge-authority-1723.md`.

## Issue mutation (summary)

- Cursor does not close, reopen, or relabel issues unless the active source issue explicitly grants that exact mutation.
- Merge or component integration is not issue closeout.
- Atlas/controller closeout mutations require an authorized closeout path after clean verification.

Full matrix: `/docs/ops/reports/issue-mutation-closeout-permission-1724.md`.

## Source issue accounting

Source issue accounting is governed by `/docs/governance/PR_PROCESS.md`.

During #2175 / #2208 rebuild, `GATE — PR Issue Accounting` is manual-only. Do not treat older issue-accounting workflow comments or PR-body normalization behavior as current authority.

After merge, a singular wrong primary `Issue:` reference may be auto-corrected during post-merge closeout when repository evidence identifies exactly one unambiguous owning source issue. That clerical repair does not weaken pre-merge one-primary-issue accounting and does not authorize guessing among multiple plausible source issues.

## Canonical references for UI/layout work

- `/docs/reference/design/LGFC-Production-Design-and-Standards.md`
- `/docs/reference/design/home.md`
- `/docs/reference/design/fanclub.md`

Do not use archived `.html` snapshots as active source-of-truth references.

---

## Runtime & Platform Policy

- Cloudflare Pages + Next.js deployment model is the active platform baseline.
- Do not perform framework/runtime migrations in unrelated PRs.
- Keep CSS/layout approach aligned to current repository standards.

---

## Drift Control

- Structural edits must align with canonical MD specifications under `docs/reference/design/**`.
- If required canonical documentation is missing/outdated, open or update the relevant spec first.
- Archived materials under `docs/archive/**` are historical context only.

---

## As-Built Documentation Requirement

Any PR that changes Cloudflare-rendered page behavior must update `/docs/as-built/cloudflare-frontend.md` in the same PR.

---

## Footer Design Enforcement

Footer behavior must remain aligned with `/docs/reference/design/LGFC-Production-Design-and-Standards.md` and `/docs/reference/design/home.md`.

Required invariants:

- Left: rotating quote + dynamic-year copyright.
- Center: logo used as scroll-to-top affordance.
- Right links: Privacy (`/privacy`), Terms (`/terms`), Contact (`/contact`).
- No extra footer nav links and no footer admin shortcut.

---

## Social Wall Change Control

For Social Wall changes:

1. Validate against active design docs.
2. Update implementation docs when behavior changes.
3. Verify rendered behavior in preview/production.
4. Record verification in PR notes.

---

## Documentation Header Compliance

For any PR touching active docs (`docs/reference`, `docs/governance`, `docs/how-to`, `docs/explanation`, `docs/ops`, `docs/templates`):

- Each touched markdown file must include the canonical header from `/docs/templates/markdown-header-template.md`.
- Run `./scripts/ci/docs_check_headers.sh .` locally before opening/updating the PR when local tools are available.
- If the guardrail fails, use the file-specific remediation output and apply the exact template fields.
