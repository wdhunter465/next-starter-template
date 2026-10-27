---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Program #2039 public launch operator checklist
Does Not Own: Production merge authorization or live campaign launch
Canonical Reference: /docs/ops/pmo/website-public-launch-relaunch-readiness.md
Related issues: #2039, #2047
Last Reviewed: 2026-10-26
---

# Website Public Launch Checklist

## Purpose

Operator checklist for Program #2039 public relaunch readiness before production promotion.

## Scope

Preview validation, production promotion gates, and post-deploy verification handoff to smoke tests.

## Steps

1. Confirm Tasks #2041–#2046 are closed with `status:complete`.
2. Run preview deploy smoke per [`website-production-smoke-test.md`](/docs/how-to/website/website-production-smoke-test.md) against the Cloudflare Pages preview URL.
3. Obtain Product Authority production promotion authorization.
4. Verify Cloudflare Pages production deploy is green.
5. Confirm `NEXT_PUBLIC_GA_ID` is set only when analytics launch is authorized.
6. Confirm no live fundraiser campaign is enabled without separate authorization.
7. Run production smoke per [`website-production-smoke-test.md`](/docs/how-to/website/website-production-smoke-test.md).
8. Capture evidence using [`website-public-launch-evidence-template.md`](/docs/ops/reports/website-public-launch-evidence-template.md).

## Checklist

- [ ] Tasks #2041–#2046 merged and closed with `status:complete`
- [ ] Preview deploy smoke test passed (`docs/how-to/website/website-production-smoke-test.md`)
- [ ] Product Authority authorizes production promotion
- [ ] Cloudflare Pages production deploy green
- [ ] `NEXT_PUBLIC_GA_ID` set only when analytics launch is authorized
- [ ] No live fundraiser campaign enabled without separate authorization
- [ ] Production smoke test passed (`docs/how-to/website/website-production-smoke-test.md`)
- [ ] Evidence captured (`docs/ops/reports/website-public-launch-evidence-template.md`)
