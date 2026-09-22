---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, LGFC maintainers
Authority Level: Controlled
Owns: #2459-004 single-repository assumption inventory and #2459-005 reusable-vs-premature classification (first two executable children of #2459)
Does Not Own: Any repository split, multi-repo cutover, shared-infrastructure platform build, or Production routing change
Canonical Reference: docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2459, #2449, #2460, #4203, #4204, #4205
Last Reviewed: 2026-09-22
---

# Repository Scalability Decision Brief — Single-Repository Assumption Inventory (#2459-004 / #2459-005)

## Purpose

Answer #4203's exact question: which current artifacts assume one repository, one website,
or one owner? Inventory those assumptions with concrete evidence, without proposing a
multi-repo cutover — that decision is explicitly out of scope for this child task.

Answer #4204's exact question: of the assumptions #4203 inventoried, which are reusable
patterns worth templating later versus premature platform engineering with no current need,
and does any of them constitute a genuine pre-2027-launch exception?

## Scope and non-goals

In scope: inventorying single-repository/single-website/single-owner assumptions across
GitHub repo identity, the Pages deployment, D1/storage bindings, the PMO dashboard, and the
self-hosted runner label, per #4203's acceptance criteria; classifying each as
reusable-later, repo-specific-now, or pre-launch exception, per #4204's acceptance criteria.

Non-goals: proposing or implementing a repository split; diverting Active website delivery
capacity; weakening single-repository authority; building shared multi-repo infrastructure;
creating additional GitHub organizations or repositories. Those remain explicitly out of
scope per #2459's own guardrails and #4203/#4204's protected stops.

## Current known truth

Verified directly against the current tree (2026-09-22, `main` at `5ce9495`):

### 1. GitHub repository identity — hardcoded in 45 files

A repository-wide search finds the literal slug `wdhunter465/next-starter-template`
hardcoded across **45 files** under `scripts/`, `.github/workflows/`, and `config/`. Examples:

- `scripts/lgfc-cursor-dispatch/lib/preflight.mjs:5` — `EXPECTED_REPO` constant, checked
  fail-closed before any dispatch workspace is trusted.
- `.github/workflows/lgfc-cursor-dispatch.yml` gates both the security-test job and the
  dispatch job themselves on `github.repository == 'wdhunter465/next-starter-template'`
  (lines 38, 71), plus a second shell-level check (`test "$REPOSITORY" = ...`, line 98) and
  a literal `--repo` flag passed to the dispatch script (line 193).
- The wake-ingress predicate (`scripts/cursor-bridge/lib/wake-ingress.mjs`) and the Chatterbox
  command bridge (`ops-chatterbox-command-bridge.yml`) carry the same pattern: the expected
  repository is a literal string, not a configuration value.

This is deliberate defense-in-depth (a wrong-repo dispatch must fail closed), but it also
means every one of these 45 sites would need an explicit, reviewed change to operate against
a second repository — there is no single point of repository configuration today.

### 2. Cloudflare Pages — one project, one deployment identity

`wrangler.toml` declares a single Pages project: `name = "lgfc-lite"` (line 1). Preview and
production URLs observed this session are both derived from that one project slug
(`next-starter-template-6yr.pages.dev`, with branch-specific preview subdomains such as
`claude-<branch>.next-starter-template-6yr.pages.dev`). Cloudflare's GitHub integration binds
that one Pages project to this one GitHub repository; there is no multi-repo Pages
aggregation or routing layer.

### 3. D1 database bindings — one Production, one Development, both hardcoded IDs

`wrangler.toml` declares exactly two D1 bindings, both with hardcoded `database_id` values
tied to specific Cloudflare account resources:

- Production: `database_name = "lgfc_lite"`, `database_id = "22d0dc3e-ad34-43af-8e6a-2063df1a1e04"`
  (line 12-13).
- Development: `database_name = "lgfc-litedev"`, `database_id = "35232809-b4c1-4df9-9f39-2f178b13c378"`
  (line 20-21).

Chatterbox (#3415) and every other D1-backed feature in this repository read/write through
these same two bindings. There is no per-repository or per-tenant database namespace —
"Development" and "Production" are the only two environments, both scoped to this one
repository's data.

### 4. PMO dashboard — partially parameterized, but single-repo per run

`scripts/pmo-dashboard/build-dashboard.mjs:13-14`:

```js
const OWNER = process.env.GITHUB_REPOSITORY_OWNER || 'wdhunter465';
const REPO = (process.env.GITHUB_REPOSITORY || 'wdhunter465/next-starter-template').split('/')[1];
```

This is the one component with a genuine escape hatch — `OWNER`/`REPO` read from
`GITHUB_REPOSITORY_OWNER`/`GITHUB_REPOSITORY` rather than being hardcoded — but the fallback
defaults to this exact repository, and the script has no concept of aggregating or building a
combined dashboard across more than one repository in a single run. Running it against a
second repository would produce a second, entirely separate dashboard, not a unified view.

### 5. Self-hosted runner label — one runner, one repository registration

`lgfc-cursor-dispatch.yml:87`: `runs-on: [self-hosted, linux, x64, lgfc-cursor]`. Confirmed
live earlier this session (#2871/#4283/#4284 work): exactly one registered self-hosted runner
(`lgfc-cursor-chromebook`, runner id 22) carries the `lgfc-cursor` label, and GitHub
self-hosted runners are registered per-repository (or per-org, which this repository does not
use). A second repository would need its own distinct runner registration — the current
Chromebook runner cannot serve two repositories' dispatch workflows simultaneously without
being re-registered, which would break the first repository's dispatch in the process.

## Analysis

Every one of the five areas #4203 named assumes exactly one repository, one Pages project,
one pair of D1 databases, and one runner. Only the PMO dashboard has any parameterization at
all, and even there it produces one dashboard per run, not a multi-repo view. This is
consistent with #2459's own design package, which already recommends retaining the
single-repository model rather than building for hypothetical scale.

No evidence gathered here or elsewhere this session identifies a genuine pre-2027-launch
dependency on multi-repository operation. Every artifact examined works correctly today
*because* it can assume a single repository — the 45-site hardcoded-slug pattern is a
deliberate fail-closed security posture (confirmed directly in this session's own work on
`wake-ingress.mjs` and `dispatch.mjs`), not an oversight that happens to also block scaling.

## Classification: reusable versus premature platform engineering (#2459-005)

Each of the five inventoried areas, tagged **reusable-later**, **repo-specific-now**, or
**pre-launch exception**, with the evidence the tag rests on:

### 1. GitHub repository identity (45 hardcoded sites) — repo-specific-now

The fail-closed `EXPECTED_REPO`/`github.repository ==` pattern is a deliberate security
control, not an accidental limitation. Centralizing it into one shared constant would be a
minor reusable-later cleanup (fewer places to update, same behavior), but the 45 call sites
already agree with each other today and nothing currently depends on more than one value. No
current capability needs this to be repo-agnostic. **Not a pre-launch exception** — no named
2027 dependency touches this.

### 2. Cloudflare Pages (one project, one repo binding) — repo-specific-now

This is Cloudflare's own GitHub-integration model, not a choice this repository made and can
unilaterally change. A multi-project routing/aggregation layer would be genuine platform
engineering with no current consumer. **Not a pre-launch exception.**

### 3. D1 database bindings (two hardcoded `database_id` values) — repo-specific-now

Same shape as PMO dashboard's env-var pattern would be a possible reusable-later template
(parameterize `database_id` by environment variable instead of a literal), but every current
D1 consumer (Chatterbox included) already works correctly against the two fixed bindings, and
no named feature needs a third. **Not a pre-launch exception.**

### 4. PMO dashboard (`OWNER`/`REPO` env fallback) — reusable-later (partial, already exists)

This is the one artifact that is *already* templated: `GITHUB_REPOSITORY_OWNER`/
`GITHUB_REPOSITORY` are read from the environment rather than hardcoded, so pointing the
script at a second repository requires no code change — only a second invocation. What it
does **not** do, and what would be premature to build now, is cross-repository aggregation
into one combined dashboard; there is no current consumer asking for a unified multi-repo
view. **Not a pre-launch exception** — the existing partial parameterization is sufficient for
any near-term need.

### 5. Self-hosted runner label (one runner, one repo registration) — repo-specific-now

GitHub's own runner registration model ties a self-hosted runner to one repository (or org,
which this repository deliberately does not use). Moving to an org-level runner would be a
security-posture change with its own review, not a documentation-only reusable pattern, and
nothing currently requires a second repository's dispatch capacity. **Not a pre-launch
exception.**

### Classification summary

| Area | Tag |
| --- | --- |
| GitHub repository identity | repo-specific-now |
| Cloudflare Pages | repo-specific-now |
| D1 database bindings | repo-specific-now |
| PMO dashboard | reusable-later (partial, already exists) |
| Self-hosted runner label | repo-specific-now |

**No pre-launch exception is named in any of the five areas** — consistent with #4203's own
finding and with #2459's design package default. The only artifact with any existing
reusable-later property (the PMO dashboard's env-var fallback) already has that property live
on `main` today; it requires no further work to remain usable if a second repository is ever
authorized.

## Recommendation (#4205 owns the final retain/split-later publication)

This brief's #4203/#4204 acceptance criteria are the inventory and the classification
themselves, not the retain/split decision (that belongs to #4205 per the child graph). Based
on the evidence above: no named pre-launch exception exists in any of the five areas. Every
examined artifact would require explicit, reviewed changes — not configuration — to support a
second repository, and none of those changes is reusable infrastructure sitting idle for lack
of a template; they are unbuilt because nothing today asks for them.

## Non-goals reaffirmed

- Does not propose or implement a repository split.
- Does not divert Active website delivery capacity.
- Does not weaken single-repository authority.
- Does not build shared multi-repo infrastructure.
