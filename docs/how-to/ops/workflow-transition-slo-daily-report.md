---
Doc Type: How-To
Audience: Bill, ChatGPT/Atlas, Day-2 Operations
Authority Level: Operational Authority
Owns: Generating the #2679 workflow transition SLO daily scorecard from repository evidence
Does Not Own: Auto-merge to main, protected-decision substitution, Cloudflare token work (#2215), or claiming two-week baseline complete
Canonical Reference: /docs/ops/reports/workflow-transition-slo-2679.md
Related Issues: #2679, #3212, #2676, #2677, #3288
Last Reviewed: 2026-08-10
---

# Workflow transition SLO daily report

## Purpose

Produce the deterministic daily scorecard defined by `#2679` / `docs/ops/reports/workflow-transition-slo-2679.md` from GitHub-native workflow and PR evidence.

Missing instrumentation is reported as `measurement_failure`, never as a silent pass.

## Prerequisites

- `gh` authenticated with Actions and PR read access
- Node 18+ (repo pins Node 22)
- Working directory: repository root
- Live repository only: `wdhunter465/next-starter-template`

## Steps

1. Confirm you are on the live LGFC repository (`wdhunter465/next-starter-template`).
2. Run offline self-test once after pulling collector changes.
3. Run report mode for the desired window (default: prior 24 hours ending now).
4. Open the Markdown scorecard under `ops-artifacts/workflow-transition-slo/`.
5. Treat `measurement_failure` rows as instrumentation defects (open or update bounded follow-ups); do not rewrite them into green compliance.
6. Optionally dispatch the GitHub Actions workflow `OPS — Workflow Transition SLO Report` for a scheduled/CI artifact upload.

## Offline self-test

```bash
node scripts/ops/test-workflow-transition-slo-report.mjs
# or
node scripts/ops/workflow-transition-slo-report.mjs --mode=self-test
```

## Report mode

```bash
node scripts/ops/workflow-transition-slo-report.mjs --mode=report
```

Optional window controls:

```bash
node scripts/ops/workflow-transition-slo-report.mjs \
  --mode=report \
  --window-end=2026-08-10T21:00:00.000Z \
  --hours=24
```

Outputs (gitignored under `ops-artifacts/`):

- `ops-artifacts/workflow-transition-slo/slo-daily-<window-end>.md`
- `ops-artifacts/workflow-transition-slo/slo-daily-<window-end>.json`

## Scheduled publication

Workflow: `.github/workflows/ops-workflow-transition-slo-report.yml`

- `workflow_dispatch` for on-demand runs
- Daily schedule at **5:00 PM America/New_York** year-round via GitHub Actions IANA timezone support (`cron: '0 17 * * *'` + `timezone: 'America/New_York'`; remediates #3288 — no winter 4 PM EST drift)
- Uploads the artifact; does not commit reports into `docs/`

### Schedule verification (EDT vs EST)

GitHub evaluates the cron in `America/New_York`, so wall-clock 17:00 ET is preserved across DST. Equivalent UTC instants for sample dates (Node `Intl`):

```bash
node --input-type=module -e '
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", timeZoneName: "shortOffset",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
for (const iso of ["2026-07-15T21:00:00.000Z", "2026-01-15T22:00:00.000Z"]) {
  console.log(iso, "->", fmt.format(new Date(iso)));
}
'
# Expect: July sample shows 17:00 GMT-4 (EDT); January sample shows 17:00 GMT-5 (EST).
```

## Safety

- Read-only against GitHub Issues/PRs
- Does not authorize automatic merge to `main`
- Does not bypass protected decisions or weaken approval gates to improve scores
- Draft slug `wdhunter645/next-starter-template` is rejected
