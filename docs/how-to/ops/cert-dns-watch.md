---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How the daily certificate and apex-redirect check opens one Operations Issue
Does Not Own: DNS changes, Cloudflare certificate issuance, or closing the exception
Canonical Reference: /docs/how-to/ci/workflow-failure-exception-issues.md
Related Issues: #4688, #4542, #4657
Last Reviewed: 2026-10-26
---

# Certificate and apex redirect watch

## Purpose

Once a day, read the TLS certificate expiry for `www.lougehrigfanclub.com`, `lougehrigfanclub.com`, and `next-starter-template-6yr.pages.dev`, and read the apex HTTP response. Open one Operations Issue when a certificate expires within 30 days or the apex is not a redirect to `www`.

## Scope

Workflow: `.github/workflows/ops-cert-dns-watch.yml` (12:17 UTC daily)
Script: `scripts/ops/cert-dns-watch.mjs`
Tests: `tests/cert-dns-watch.test.mjs`

The check is read-only. It does not change DNS or Cloudflare.

## Steps

1. **Each host** is connected to on port 443. A certificate whose expiry is inside 30 days is a failure.
2. **The apex** `https://lougehrigfanclub.com/` must redirect to `www.lougehrigfanclub.com`. Any other status or destination is a failure.
3. **When every check passes,** the job opens nothing.
4. **When any check fails,** the job opens one Issue titled `OPS EXCEPTION: certificate expiry or apex redirect changed`, labeled `team:operations` and `ops-exception`. A later failure comments on that Issue.
5. **Operations closes the Issue** with a comment naming the fix or the accepted decision.

## Rollback

Revert the pull request that added the workflow. Open exception Issues stay open until Operations closes them.
