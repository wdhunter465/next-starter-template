---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Step-by-step procedures to accomplish tasks safely
Does Not Own: Defining specs; redefining design/architecture/platform rules
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Last Reviewed: 2026-02-20
---

# Production Smoke Test (read-only)

This is a lightweight, **read-only** smoke test for the public LGFC site.
It does **not** require auth and it does **not** mutate data.

## Steps: run in Codespaces

```bash
bash scripts/prod-smoke.sh https://www.lougehrigfanclub.com
```

## What it checks

- Public pages respond (2xx/3xx): `/`, `/about`, `/contact`, `/terms`, `/privacy`, `/join`, `/login`, `/faq`, `/health`
- Public JSON endpoints return `ok:true`
- `/fanclub` is not directly accessible when logged out (redirect OR explicit client-side gating marker)

## Expected output

- A list of HTTP status codes per page
- Short JSON snippets for key endpoints
- Final `OK: production smoke passed`

## Notes

- `scripts/prod-smoke.sh` is Codespaces-safe (it does **not** use `set -euo pipefail`).
