# Platform Intent and ZIP Taint Governance

**Status:** AUTHORITATIVE  
**Effective Date:** 2026-01-26  
**Purpose:** Define platform intent label, ZIP taint behavior, and purge workflow policy

---

## Overview

This document establishes governance for:
1. The `platform` intent label for PRs touching Cloudflare-specific runtime configuration
2. ZIP taint behavior and permanent PR contamination
3. Manual purge workflow usage and restrictions

---

## Platform Intent

### Definition

The **`platform`** intent label identifies PRs that modify Cloudflare Pages runtime configuration ONLY.

### When to Use Platform Intent

A PR MUST use the `platform` label when it touches:
- **`wrangler.toml`** (Cloudflare Workers/Pages configuration)
- **`functions/**`** (Cloudflare Pages Functions / Edge runtime)

AND touches NO other areas.

### File-Touch Allowlist

**Allowed paths (platform intent):**
- `wrangler.toml`
- `functions/**`

**Explicitly DISALLOWED paths:**
- `docs/**` (use `docs-only` intent)
- `src/**` (UI/app code — use `feature` intent)
- `.github/workflows/**` (CI/infra — use `infra` intent)
- `package.json`, `package-lock.json` (dependencies — use `feature` or `infra` intent)
- `migrations/**` (database schema — use `feature` intent)

### Relationship to Other Intents

The repository defines these PR intent labels:

| Intent | Purpose | Allowed Paths |
|--------|---------|---------------|
| **infra** | CI/CD, workflows, build config | `.github/**`, `scripts/**`, config files |
| **feature** | Application features, UI, API | `src/**`, `functions/**`, `migrations/**`, `public/**` |
| **docs-only** | Documentation changes only | `docs/**`, `Agent.md`, `active_tasklist.md` |
| **platform** | Cloudflare runtime config only | `wrangler.toml`, `functions/**` |
| **change-ops** | Operational changes, migrations, scripts | `migrations/**`, `scripts/d1-*`, `scripts/b2-*`, `data/**` |
| **recovery** | Emergency fixes (break-glass) | All paths (unrestricted) |

For detailed intent definitions, see `/docs/governance/pr-intent-labels.md`.

**Key Distinctions:**

- **platform vs. feature:**  
  - `platform` = ONLY `wrangler.toml` + `functions/**`  
  - `feature` = UI/app code + API/functions + migrations  
  - If a PR touches BOTH Cloudflare runtime config AND app code → **MUST split into separate PRs**

- **platform vs. infra:**  
  - `platform` = Runtime configuration (Cloudflare-specific)  
  - `infra` = Build/CI/workflow infrastructure  
  - Touching BOTH → **MUST split into separate PRs**

- **platform vs. docs-only:**  
  - `platform` = Runtime configuration changes  
  - `docs-only` = Documentation ONLY  
  - Touching BOTH → **MUST split into separate PRs**

### PR Split Policy

**When a PR touches files across multiple intent categories, it MUST be split into separate PRs.**

Examples:

**Invalid (mixed intents):**
```
✗ PR touches: wrangler.toml + src/app/page.tsx
  → Violates platform intent allowlist (includes src/)
  → MUST split into:
     - PR #1: platform intent (wrangler.toml only)
     - PR #2: feature intent (src/app/page.tsx)
```

**Invalid (mixed intents):**
```
✗ PR touches: functions/api/login.ts + docs/website.md
  → Violates platform intent allowlist (includes docs/)
  → MUST split into:
     - PR #1: platform intent (functions/api/login.ts)
     - PR #2: docs-only intent (docs/website.md)
```

**Valid (single intent):**
```
✓ PR touches: wrangler.toml + functions/api/join.ts
  → All paths allowed under platform intent
  → Label: platform
```

### Enforcement

The `drift-gate` CI workflow validates PR intent allowlists:
- Checks that PR has exactly ONE intent label
- Verifies all changed files are allowed under that intent
- **BLOCKS merge if violations detected**

---

## ZIP Taint Behavior

### PR-Range ZIP Taint (Permanent)

**Critical Rule: ZIPs introduced anywhere in the PR commit range (`BASE..HEAD`) permanently taint the PR.**

#### How ZIP Taint Works

1. **Detection:** The `drift-gate` workflow scans the entire PR commit range:
   ```bash
   git rev-list --objects ${BASE_SHA}..${HEAD_SHA} | grep '\.zip$'
   ```

2. **Taint is Permanent:** If a ZIP file path appears in ANY commit within `BASE..HEAD`, the PR is tainted.

3. **Deletion Does NOT Fix:** Deleting the ZIP in a later commit does NOT remove it from git history.

#### Examples

**Scenario 1: ZIP added then deleted (STILL TAINTED)**
```
Commit A: Add feature.zip
Commit B: Extract files from feature.zip
Commit C: Delete feature.zip

Result: ✗ PR TAINTED
Reason: feature.zip exists in history (Commit A)
Action: ZIP taint persists; PR cannot merge
```

**Scenario 2: ZIP never committed (CLEAN)**
```
Local: Upload feature.zip
Local: Extract files
Local: Delete feature.zip
Commit A: Add extracted files (no ZIP in commit)

Result: ✓ PR CLEAN
Reason: ZIP never entered git history
Action: PR can merge normally
```

**Scenario 3: ZIP in earlier PR commit, removed in force-push (TAINTED)**
```
Initial PR commits (HEAD~3..HEAD):
  Commit 1: Add work.zip
  Commit 2: Extract files
  Commit 3: Delete work.zip

Force push (new HEAD):
  Commit 4: Only extracted files (work.zip not in this commit)

Result: ✗ PR STILL TAINTED
Reason: Original BASE..HEAD range included work.zip
Action: Must close PR and open fresh PR from clean branch
```

### Why ZIP Taint Is Permanent

Git history scanning uses `git rev-list --objects` which traverses the entire commit graph in the range. Even if a file is deleted in a later commit, its object and path remain in the git database and history.

**The ONLY way to fix ZIP taint:**
1. Close the tainted PR
2. Create a NEW branch from clean base (without ZIP in history)
3. Cherry-pick clean commits OR manually reapply changes
4. Open NEW PR (new BASE..HEAD range without ZIP)

---

## ZIP Purge Workflow

### Purpose

The `purge-zip-history.yml` workflow provides a **break-glass** mechanism to remove ZIP files from repository history.

### When to Run Purge

**ONLY run purge under these conditions:**
1. **Manual decision** by repository maintainer
2. **AFTER PR triage** confirms a ZIP was accidentally merged
3. **NEVER as routine PR cleanup**

### What Purge Does

The purge workflow:
- Scans entire repository history for ZIP files
- Optionally removes ZIPs using `git-filter-repo` (destructive)
- Rewrites git history (requires force push)
- Invalidates all existing PRs based on old history

### When NOT to Run Purge

**DO NOT run purge:**
- As part of normal PR development
- To "fix" a tainted PR (close PR instead)
- Before PR review (handle ZIP prevention upstream)
- Automatically or on schedule

### Purge is Break-Glass Only

**Purge is a high-impact operation:**
- Rewrites git history
- Requires force push to main
- Breaks all in-flight PRs
- Must be coordinated across team
- Should be rare (ideally never needed)

**Prefer prevention over purge:**
- Delete ZIPs before committing
- Use local extraction workflow
- Validate with `git ls-files | grep '\.zip$'` before push
- Let `drift-gate` catch ZIPs in PR review

---

## Agent/Copilot Guidance

### Intent Selection (Deterministic)

**Agent MUST select intent label based on file-touch analysis:**

1. **Check docs-only first:**
   - If ALL changed files start with `docs/` → Label: `docs-only`

2. **Check platform:**
   - If ALL changed files match `wrangler.toml` or `functions/**` → Label: `platform`

3. **Check infra:**
   - If ALL changed files match `.github/**`, `scripts/**`, or config files → Label: `infra`

4. **Check feature:**
   - If ALL changed files match `src/**`, `functions/**`, `migrations/**`, `public/**` → Label: `feature`

5. **If files span multiple intents:**
   - **MUST split PR** into separate PRs per intent
   - Example: `wrangler.toml` + `src/app/page.tsx` → Split into 2 PRs

### When to Split PRs

**ALWAYS split PRs when file-touch spans intent categories:**

- Platform + Feature → 2 PRs
- Platform + Docs → 2 PRs  
- Platform + Infra → 2 PRs
- Feature + Docs → 2 PRs
- Infra + Docs → 2 PRs

**NEVER combine multiple intents in one PR** (except `recovery` intent for break-glass emergencies).

### When NOT to Run Purge

**Agent MUST NEVER:**
- Suggest or run `purge-zip-history.yml` workflow
- Attempt to "fix" ZIP taint by deleting ZIPs in commits
- Recommend force-push to remove ZIPs from history

**Agent SHOULD instead:**
- Delete ZIPs BEFORE first commit
- Advise closing tainted PR and opening fresh PR
- Document ZIP prevention in PR description

---

## Enforcement

### CI Workflow: drift-gate.yml

The `drift-gate` workflow enforces:
1. **ZIP guard (tree):** No `.zip` files in working tree
2. **ZIP guard (PR history):** No ZIP paths in `BASE..HEAD` range
3. **PR intent allowlist:** File-touch matches intent label

**All checks are BLOCKING** — PRs cannot merge if they fail.

### Manual Review

**Repository maintainers MUST:**
- Verify intent label matches file-touch before approving PR
- Reject PRs with mixed intents (request split)
- Ensure ZIP prevention (not purge) is used for new PRs

---

## Troubleshooting

### Error: "ZIP file path detected in PR commit range"

**Cause:** ZIP file introduced in one or more commits within `BASE..HEAD`.

**Solution:**
1. Close the current PR
2. Create NEW branch from clean base
3. Reapply changes WITHOUT committing ZIP files
4. Open NEW PR

**DO NOT:**
- Delete ZIP and force-push (taint persists in PR range)
- Run purge workflow (break-glass only)

### Error: "File-touch allowlist violation for intent 'platform'"

**Cause:** PR labeled `platform` but touches files outside `wrangler.toml` / `functions/**`.

**Solution:**
1. **If only platform changes needed:**
   - Remove non-platform files from PR
   - Update PR with only `wrangler.toml` / `functions/**`

2. **If both platform and other changes needed:**
   - Split into separate PRs:
     - PR #1: `platform` intent (wrangler.toml, functions/**)
     - PR #2: Appropriate intent for other files

### Question: "Should I run purge-zip-history workflow?"

**Answer: NO (almost always).**

Purge is **break-glass only**, used AFTER a ZIP is merged and discovered later.

**For PRs with ZIP taint:**
- Close PR
- Open fresh PR from clean branch
- Let `drift-gate` prevent future ZIP commits

---

## References

**Related Documentation:**
- `/.github/CI_GUARDRAILS_MAP.md` — CI workflow reference
- `/.github/pull_request_template.md` — PR process and ZIP policy
- `/docs/governance/PR_GOVERNANCE.md` — Governance and standards
- `Agent.md` — Agent rules for file-touch discipline

**CI Workflows:**
- `.github/workflows/drift-gate.yml` — ZIP + intent enforcement
- `.github/workflows/purge-zip-history.yml` — Break-glass ZIP purge

**CI Scripts:**
- `scripts/ci/verify_zip_history_pr.sh` — PR-range ZIP detection
- `scripts/ci/verify_pr_intent_allowlist.mjs` — Intent allowlist validation
- `scripts/ci/pr_intent_allowlists.json` — Intent configuration

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-26 | Initial platform intent + ZIP taint governance |

---

**END OF PLATFORM INTENT AND ZIP GOVERNANCE**
