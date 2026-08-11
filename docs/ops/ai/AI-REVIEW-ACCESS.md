---
Doc Type: Reference
Audience: Human + AI
Authority Level: Operational Authority
Owns: Tokenized AI review access configuration, security constraints, and operator usage
Does Not Own: Member/admin authentication model, production merge approval, or Program #1685 scope
Canonical Reference: /docs/ops/ai/SHARED-AGENT-RULES.md
Related Issues: #1973, #2215, #3289
Last Reviewed: 2026-08-11
---

# AI Review Access

## Purpose

Provide a **read-only, token-protected, live inspection surface** so ChatGPT can review authenticated LGFC page structure and content without weakening normal `/fanclub` or `/admin` session authentication.

AI review access is **disabled by default** and intended for short, operator-controlled preview or review windows.

## Environment variables

Configure these in Cloudflare Pages environment settings. **Never commit values to the repository.**

| Variable | Default | Description |
| --- | --- | --- |
| `AI_REVIEW_ENABLED` | `false` | Master switch. When absent or false, all AI review routes fail closed. |
| `AI_REVIEW_TOKEN` | _(unset)_ | Long random secret used as `?token=` query parameter. |
| `AI_REVIEW_ALLOW_ADMIN` | `false` | When false, `/_ai-review/admin` and `/api/_ai-review/page-snapshot?path=/admin` are blocked. |

## Review URLs

When enabled with a valid token:

```text
/_ai-review/home?token=<AI_REVIEW_TOKEN>
/_ai-review/fanclub?token=<AI_REVIEW_TOKEN>
/_ai-review/admin?token=<AI_REVIEW_TOKEN>          # only when AI_REVIEW_ALLOW_ADMIN=true
/api/_ai-review/page-snapshot?path=/fanclub&token=<AI_REVIEW_TOKEN>
```

Source pages live under `src/app/ai-review/` and are exported to `/_ai-review/` during postbuild so Next.js private-folder rules do not block routing.

## Security constraints

1. Missing/invalid token → **404** (disabled) or **403** (enabled but unauthorized) from both the Cloudflare Pages `/_ai-review/*` edge guard and the snapshot API.
2. Token must **not** appear in HTML, JSON responses, logs, telemetry, or test snapshots.
3. Review URLs pass the token in the `?token=` query parameter per issue #1973; operators should treat preview access as short-lived and rotate the token after review.
4. No mutation endpoints, D1 dumps, impersonation, or environment/secret dumps through review mode.
5. Admin review surfaces are read-only summaries; publish/delete/export controls are not active.
6. Normal member login and `/fanclub` / `/admin` cookie auth are unchanged.

## Runtime model

- **Edge guard:** `functions/_ai-review/[[path]].ts` validates the token before static HTML is served.
- **Client gate:** review pages call `/api/_ai-review/page-snapshot` to hydrate read-only content; unauthorized clients render empty output.
- **Export path:** source pages live in `src/app/ai-review/` and postbuild renames `out/ai-review` to `out/_ai-review`.

## Operator usage (preview-first)

1. Enable review on a **preview** deployment first.
2. Set `AI_REVIEW_ENABLED=true` and configure `AI_REVIEW_TOKEN` in Cloudflare.
3. Share review URLs with ChatGPT/Bill only through secure channels (not in issues, PRs, or repo files).
4. Enable `AI_REVIEW_ALLOW_ADMIN=true` only when admin layout review is explicitly required.
5. **Disable immediately** after review: set `AI_REVIEW_ENABLED=false` and rotate `AI_REVIEW_TOKEN`.

### Workflow dispatch (`OPS — Enable AI Review Access`)

Use `.github/workflows/ops-ai-review-enable.yml` (script: `scripts/ops/enable-ai-review-access.mjs`):

| Input | Default | Rule |
| --- | --- | --- |
| `target_environment` | `preview` | Preview-first (#3289 / #2215). |
| `confirm_production` | `false` | Must be `true` when targeting production; otherwise the job fails closed. |
| `verify_base_url` | _(empty)_ | **Required** for preview (Pages preview hostname). Production defaults to `https://www.lougehrigfanclub.com` when empty. |
| `allow_admin` | `false` | Keep false unless admin layout review is explicitly required. |
| `trigger_redeploy` | `false` | Retry the latest deployment in the selected environment so secrets apply. |

Do not treat a successful production enablement run as permanent admin or permanent review access. Rotate/disable after the short review window.

## Disable immediately

```text
AI_REVIEW_ENABLED=false
```

Optionally unset or rotate `AI_REVIEW_TOKEN`. Redeploy or update the Cloudflare environment so the change takes effect without code changes.

## Implementation map

| Surface | Location |
| --- | --- |
| Shared guard | `src/lib/aiReviewAccess.ts` |
| Edge route guard | `functions/_ai-review/[[path]].ts` |
| Snapshot API | `functions/api/_ai-review/page-snapshot.ts` |
| Live review pages | `src/app/ai-review/{home,fanclub,admin}/page.tsx` |
| Tests | `tests/ai-review-access.test.ts` |

## Related governance

- Shared agent law: [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md)
- Source issue: [#1973](https://github.com/wdhunter645/next-starter-template/issues/1973)
