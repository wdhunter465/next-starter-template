---
Doc Type: Reference
Audience: Product Authority, Operations, and implementation agents
Authority Level: Controlled
Owns: The payload the scheduled-publish sweep sends to Zapier, the per-platform field mapping, and the Zap design for social cross-posting (plan step 3 of #4785)
Does Not Own: Zapier account, plan or cost; platform connections or credentials; the decisions in plan step 1 of #4785; public announcement content and timing; the scheduled-publish authoring and sweep steps (see /docs/how-to/ops/run-scheduled-content-publish.md)
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4785, #4253, #4414, #4416, #4435, #4433, #4684, #4407
Last Reviewed: 2026-10-26
---

# Social cross-post: Zapier payload contract and Zap design

## Purpose

Fixes, in one place, what the website sends to Zapier, how each field maps to each social platform, and how the Zap is built and fails. It is the "payload contract and field-mapping sheet" and "Zap design" from plan step 3 of #4785. It does not record any Product Authority decision: the open decisions are listed at the end and the design below holds for any answer to them.

Status: design only. Nothing here is provisioned. No Zapier account, webhook URL or platform connection exists or is recorded in the repository.

## Payload contract, version as implemented today

Sent by `functions/api/scheduled-content/publish-due.ts` (`postToZapier`): one `POST` per published post, `Content-Type: application/json`, to `SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL`. Sent only after the website publish has succeeded.

| Field | Type | Null | Source | Notes |
| --- | --- | --- | --- | --- |
| `key` | string | no | `content_blocks.key` | Stable id of the post, for example `home.fundraiser-daily-details.2027-02-01`. Unique per post |
| `page` | string | no | `content_blocks.page` | Site page the post belongs to |
| `section` | string | no | `content_blocks.section` | Section within the page |
| `title` | string | no | `content_blocks.title` | Plain text |
| `caption` | string | no | `social_caption`, else `title` | The text intended for social. Never empty while `title` is set |
| `body` | string | yes | `content_blocks.body_md` | Markdown, not rendered. Do not post it as is |
| `image_url` | string | yes | `content_blocks.image_url` | Absolute public URL. `null` when the post has no image |
| `image_alt` | string | yes | `content_blocks.image_alt` | Required by the authoring endpoint whenever `image_url` is set |
| `published_at` | string | no | publish result | ISO 8601 timestamp of the website publish |
| `site_origin` | string | no | request origin | `https://www.lougehrigfanclub.com` when called by the Production workflow |

Delivery behavior: no retry, no queue. A non-2xx response or a network error is returned in the sweep response as `social: { ok: false, error }` and never rolls back the website post. When the secret is unset, the social step is skipped with `error: "SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL not configured"`.

### Gaps in the current payload

These make the Zap harder to build safely. None is implemented. Each needs a code change under its own Issue and an approved workflow or endpoint review, so they are proposals, not part of the contract.

| Proposed field | Why | Interim workaround in the Zap |
| --- | --- | --- |
| `post_url` | Every platform caption should link back to the post on the site. The payload has the origin but not the page path | Build the link from `site_origin` plus the fixed page path for the series (`/fundraiser-details`). It points at the list, not the single post |
| `event_id` (`key` plus version) | A Zap retry or a manual replay would otherwise post twice with nothing to deduplicate on | De-duplicate in the Zap on `key` using Zapier Storage or a Filter on "already posted" |
| `schema_version` | Lets the Zap reject a payload shape it was not built for | None. Pin the Zap to this table and re-test after any change to `publish-due.ts` |
| `is_test` | A clear marker so a test payload can never reach a real account | Use a separate Catch Hook for test (see Test mode) |

## Per-platform field mapping

Every row reads the same Catch Hook fields. Character limits are the commonly published limits and must be re-checked on each platform and in Zapier's own action settings before the build is accepted.

| Platform | Zap action | Text | Image | Link | Limits to enforce in the Zap |
| --- | --- | --- | --- | --- | --- |
| Facebook Page | Create Page post | `caption` | `image_url` if present, else text-only post | Append the site link | Long limit; no truncation needed in practice |
| Facebook Group | Not postable by Zapier (see Facebook Group) | Same as the Page | Same as the Page | Same as the Page | Not applicable |
| Instagram | Instagram for Business: create photo post | `caption` | `image_url` required | Link in the caption is not clickable; say "link in bio" | Caption about 2,200 characters; image must be a reachable public URL; skip the platform when `image_url` is null |
| X | Create post (existence and cost to be verified) | `caption`, truncated | `image_url` if the action supports media | Append the site link | 280 characters including the link; truncate before the link |
| Pinterest | Create pin | `title` as the pin title, `caption` as the description | `image_url` required | Destination link is the site link | Title about 100 and description about 500 characters; needs a board; skip the platform when `image_url` is null |

Rules that follow from the table:

1. A post with `image_url: null` is posted to Facebook Page and X only. Instagram and Pinterest are skipped, not failed. This is the working assumption until Product Authority sets the image rule.
2. Truncate in the Zap with a Formatter step, never by changing the caption on the website.
3. `body` is not posted anywhere. It is Markdown and can be long.
4. The image is posted exactly as the website serves it. Any rights or privacy question about an image is a protected stop (#4785); the permission gate and rights register decide which images may appear on the site at all, and social posting must not widen that.

## Zap design

One Zap, one Catch Hook trigger, parallel branches. Not one Zap per platform, so there is one webhook URL to guard and one place to turn everything off.

1. **Trigger:** Webhooks by Zapier, Catch Hook. The hook URL is the secret `SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL`.
2. **Guard:** Filter that stops the Zap unless `site_origin` equals `https://www.lougehrigfanclub.com`, so a payload from Preview or Development can never post to real accounts.
3. **De-duplicate:** Filter on whether `key` was already posted (Zapier Storage), then record `key` after the first platform step succeeds.
4. **Format:** Formatter steps to build the link, truncate for X, and split `caption` and `title` for Pinterest.
5. **Branches (Paths):**
   - Facebook Page: always.
   - X: always, if X is in scope.
   - Instagram and Pinterest: only when `image_url` is present.
6. **Errors:** Zapier's error notification emails the Operations holder and Bill when any step fails. A failed platform step must not stop the other branches.
7. **Facebook Group:** a reminder step to the Group admin (email or Zapier-supported messaging) carrying the Page post link, if Product Authority chooses that route.

## Test mode

- A separate Zap (or a separate Catch Hook on a copy of the Zap) points at test destinations only: a private or test Facebook Page, a test Instagram account if available, a test Pinterest board. Its URL is never set as the Production secret.
- Test payloads are clearly marked. Example, with obviously fake content:

```json
{
  "key": "test.social-crosspost.example",
  "page": "test",
  "section": "test",
  "title": "[TEST] Social cross-post check",
  "caption": "[TEST] Please ignore. Social cross-post wiring check.",
  "body": null,
  "image_url": null,
  "image_alt": null,
  "published_at": "2026-11-04T15:00:00Z",
  "site_origin": "https://www.lougehrigfanclub.com"
}
```

- Posting from a test destination is not a public post. Any post on a real LGFC account is public and needs Product Authority's authorization first.
- The pilot post (plan step 5) is authorized by Product Authority and goes to real or test destinations as Product Authority chooses.

## Failure visibility today

| Event | What happens now | Gap |
| --- | --- | --- |
| Zapier or network failure in the sweep | The post is already live on the site. The sweep returns HTTP 200 with `social.ok: false` and an error string | The workflow only fails on a non-200 status. A social failure with a 200 is not a failed run |
| Sweep published something | `.github/workflows/ops-scheduled-content-publish.yml` comments the response body on #4253 | The failure is readable there, but nothing is emailed to Operations or Bill and nothing is flagged on the run |
| A failed social post | Not retried. The next sweep finds the row already published and does not resend | A missed post needs a manual replay from Zapier history, or a deliberate re-send |
| A platform step fails inside Zapier after the hook was accepted | The sweep sees success | Covered only by Zapier's own error email (Zap design, item 6) |

Closing these gaps needs a workflow change (flag `social.ok: false` as a warning on the run), which needs Product Authority approval and independent review. It is not part of this document.

## Secrets

- The Catch Hook URL is a secret. It is set in GitHub repository secrets and Cloudflare Pages Production variables by Product Authority, never written to the repository, an Issue or a PR.
- Platform credentials stay in Zapier's own connection UI. No credential is shared with agents.
- The payload carries no member personal data. Keep it that way: do not add member or donor fields.

## Open decisions (Product Authority, plan step 1 of #4785, due 2026-10-26)

None of these is decided. Each changes only the item named.

| Decision | Affects |
| --- | --- |
| Zapier account owner, owning email and paid plan (cost) | Whether a multi-step Zap can run at all; a paid plan is a cost stop |
| How the Facebook Group is handled | Zap design item 7 and the Group row in the mapping |
| Whether X is in scope if it needs a paid API | The X branch |
| Image rule: every post has an image, or text-only goes to Facebook and X only | Branch guards for Instagram and Pinterest; the current design assumes the second option |
| Pinterest board and hashtag rules | Pinterest mapping; whether `caption` carries hashtags |

## Follow-up work this document implies

Each is a separate Issue and PR, none is started by this one:

1. Add `post_url`, `event_id`, `schema_version` and a visible warning for `social.ok: false` to the sweep and workflow (code, workflow; Product Authority approval and independent review).
2. Update `/docs/how-to/ops/run-scheduled-content-publish.md` after the Zap exists, so the runbook matches what was built.
3. Add the scheduled-job health entry if a workflow changes (#4684).
