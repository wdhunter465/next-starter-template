---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Drive-to-GitHub intake folder rules, branch lifecycle, and promotion constraints for Content Collection planning drafts
Does Not Own: Diataxis authority promotion, feature implementation, repository-history rewrite, or ZIP gate policy changes
Canonical Reference: /docs/ops/reports/content-collection-docs-audit-dedup-2360.md
Related Issues: #2359, #2360, #2367, #2374, #2366, #4776
Last Reviewed: 2026-10-26
---

# Drive Draft Intake and Promotion

## Purpose

Document how Content Collection Drive planning drafts enter the repository, how agents use them safely, and how promotion into Diataxis authority differs from intake staging.

Intake is **outside** the normal issue/PR authority path until drafts are enriched and promoted through a reviewed PR.

## Procedure

### Step 1 — Know the intake location

| Field | Value |
| --- | --- |
| Folder | `_incoming/drive-drafts/content-collection/` |
| Branch | `ChatGPT/drive-draft-intake-2367` |
| Manifest | `_incoming/drive-drafts/content-collection/SOURCE-MANIFEST.md` |
| Parent program | #2359 |

Contents are **non-authoritative** until promoted through PR into `docs/how-to/`, `docs/reference/`, `docs/ops/`, or other approved paths.

### Step 2 — Intake rules

1. **No root ZIP** — never commit `drive-download*.zip` to repository root; ZIP-in-root gate will fail.
2. **Provenance ZIP under intake only** — the retained ZIP under `_incoming/...` is provenance, not production assets.
3. **Full-history audit** — ZIP paths in git history can fail `ZIP History Audit (Full History)` on unrelated PRs until dispositioned (#2374).
4. **Do not promote intake wholesale** — audit first (#2360); enrich; promote smallest safe set per ChatGPT disposition.
5. **Do not create parallel authority** — merge into existing docs when audit identifies overlap (see audit report conflicts C1–C8).

### Step 3 — Branch lifecycle

| Branch | Role |
| --- | --- |
| `ChatGPT/drive-draft-intake-2367` | Source-material staging; may retain intake folder + ZIP |
| `cursor/<issue>-<task>-2e48` | Implementation/docs PR branches from `main` |
| `main` | Authoritative promoted docs only |

Intake branch content does not need to merge to `main` for Phase 0 audit work. Agents read intake on its branch or via manifest references.

When stale intake branch refs keep ZIP reachable in history, follow #2374 remediation before assuming gates are clean.

### Step 4 — Audit before promotion

Run #2360-style audit steps:

1. Compare each `.docx` draft to existing repo authority (audit report disposition table).
2. Flag conflicts; stop for a Product Authority decision.
3. Record target paths using existing ops tree (`docs/ops/reports/`, `implementation-plans/`, `pmo/`, etc.) — not `docs/ops/programs/`.

### Step 5 — Promote through PR

Promotion PR requirements:

- one source issue;
- docs-only allowlist;
- enriched Markdown (not raw `.docx` in Diataxis paths);
- authority header on every new active doc;
- validation commands recorded in PR body;
- issue-thread collaboration complete before PR open.

### Step 6 — Gate interaction checklist

Before marking a promotion PR merge-ready:

- [ ] ZIP-in-root check passes on PR branch
- [ ] ZIP History Audit (Full History) status reviewed (#2374 disposition if failing)
- [ ] DIATAXIS folder intent passes for changed docs
- [ ] Source issue lacks conflicting terminal labels (`status:in-progress` at merge blocks closeout)
- [ ] PR body includes required closeout sections and bot dispositions

## What not to do

- Do not treat Drive drafts or intake README as operational authority.
- Do not add `_incoming/` paths to routine implementation allowlists without explicit ops authorization.
- Do not perform repository-history rewrite from this how-to; route to #2374 with Product Authority authorization.

## Related authorities

- Phase 0 launch sequence: `docs/how-to/ops/content-collection-phase0-launch-playbook.md`
- ZIP remediation plan: `docs/ops/implementation-plans/zip-history-remediation-plan-2374.md`
- ZIP closeout evidence: `docs/ops/reports/zip-history-ref-cleanup-closeout-2374.md`
- Failed pre-gate operator follow-up: `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md`
