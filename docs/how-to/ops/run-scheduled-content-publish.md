---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational Authority
Owns: How to author, schedule, and auto-publish dated content_blocks posts (currently the Fundraiser Daily Details feed) and cross-post them to social via Zapier
Does Not Own: The dynamic donation leaderboard/standings snapshot cadence (see /docs/how-to/ops/als-fundraiser-snapshots-and-publishing.md); the generic CMS draft/publish flow for non-scheduled blocks (/api/admin/cms/save.ts, /api/admin/cms/publish.ts); the 2027 program calendar itself (source: Issue #2093)
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Related Issues: #4253, #2093, #1700, #2039
Last Reviewed: 2026-09-20
---

# Scheduled content publish + Zapier social cross-post

## What this is

A way to pre-author a series of dated posts (e.g. the Fundraiser Daily Details
prize/giveaway posts running 2027-02-01 through 2027-03-01) once, in advance,
and have each one automatically go live on the website at its own scheduled
date — then automatically publish to every LGFC social platform — without a
human clicking Publish that day.

It extends the existing `content_blocks` CMS table (migration
`0011_cms_content_blocks.sql`) with a `scheduled_publish_at` column, rather
than introducing a separate content system. A scheduled row is just a normal
`content_blocks` row sitting in `status = 'draft'` with a future
`scheduled_publish_at`; once that time passes, an automated sweep flips it to
`published` exactly the way a human clicking Publish would.

## Before this works live: two secrets

Neither of these is optional — until both exist, the code path is complete
and tested but the scheduled cron will fail at auth (website side) or skip
the social step (Zapier side). This is the same situation Chatterbox went
through before `CHATTERBOX_BRIDGE_PROD_TOKEN` was provisioned — see
`docs/how-to/ops/run-chatterbox-multi-agent-dev-test.md` for that precedent.

1. **`SCHEDULED_CONTENT_BRIDGE_TOKEN`** — a secret you generate yourself (any
   long random string). Set it in **both**:
   - GitHub repo secrets (`Settings → Secrets and variables → Actions`)
   - Cloudflare Pages **Production** environment variables

   This authenticates the GitHub Actions cron job to
   `POST /api/scheduled-content/publish-due` (see
   `functions/_lib/scheduled-content-auth.ts`). It is a bounded credential:
   it can only publish already-authored draft rows whose scheduled time has
   arrived. It cannot create, edit, or approve content, and it is a
   completely separate credential from admin login sessions.

2. **`SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL`** — from a Zapier "Catch Hook"
   trigger step in a Zap you build yourself:
   - Create a Zap with trigger **Webhooks by Zapier → Catch Hook**.
   - Add one action per social platform you want to cross-post to (Facebook,
     Instagram, X, Pinterest), each connected to your own account inside
     Zapier — no separate developer-app registration or platform review is
     needed for any of them.
   - Copy the Catch Hook's webhook URL and set it as this secret in the same
     two places as above (GitHub repo secret + Cloudflare Pages Production
     env var).
   - Note: Instagram auto-posting via Zapier requires an Instagram
     Business/Creator account connected through Facebook — confirm that
     before relying on it.

   Until this URL is set, publishing to the website still works; the social
   cross-post step is simply skipped (logged as
   `social.ok: false, social.error: "SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL not configured"`
   in the sweep's response, never a hard failure).

## Authoring a scheduled post

`POST /api/admin/fundraiser-details/create` (admin session required, same
login as the rest of `/admin`):

```json
{
  "publish_date": "2027-02-01",
  "publish_time": "10:00",
  "title": "Grand prize announced!",
  "body_md": "Today we reveal the grand prize...",
  "social_caption": "Grand prize day! 🎉 See the full details on LGFC.com"
}
```

- `publish_time` defaults to `10:00` (America/New_York) if omitted.
- One post per `publish_date` — resubmitting the same date overwrites the
  still-draft row (upsert); once a date has published, resubmitting it is
  refused (`409`) rather than silently overwritten, since `content_blocks`
  publication is meant to be append-only for a live post.
- `social_caption` is optional; if omitted, the Zapier payload falls back to
  `title`.
- `GET /api/admin/fundraiser-details/list` shows every queued/published post
  for review before its date arrives.

## How the automated publish works

`.github/workflows/ops-scheduled-content-publish.yml` runs on a cron
schedule at both `14:00` and `15:00` UTC every day (covering 10:00 AM
America/New_York across the EST/EDT boundary without timezone-library logic)
and calls `POST /api/scheduled-content/publish-due` against **Production**
directly (`https://www.lougehrigfanclub.com`) — unlike the Chatterbox
workflows, which deliberately stay on Development.

That endpoint:

1. Finds every `content_blocks` row with `status = 'draft'` and
   `scheduled_publish_at <= now`.
2. Publishes each one (same effect as the existing manual
   `/api/admin/cms/publish` action — `published_body_md` set, `version`
   bumped, a `content_revisions` row written).
3. Fires one webhook per published post to
   `SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL` with `{ title, caption, body,
   published_at, site_origin, ... }`. A Zapier failure is logged but never
   rolls back the website publish — the two are independent.

The sweep is idempotent: calling it twice in the same day (both cron ticks)
only ever publishes each due row once, since the second call finds nothing
left in `draft` for that date.

Manual run: `workflow_dispatch` on the same workflow, no inputs required.

## Where it shows on the site

- **Homepage**: a teaser section (`src/components/home/FundraiserDailyDetailsTeaser.tsx`)
  showing the single newest published post, placed directly above the
  Campaign Spotlight section — matches the layout Bill specified on #2093
  (2026-09-20).
- **Full history**: `/fundraiser-details`
  (`src/app/fundraiser-details/page.tsx`), every published post,
  newest at the top.

Both read from the public, unauthenticated `GET /api/fundraiser-details/list`
endpoint — no admin token, published rows only.

## Extending this beyond Fundraiser Daily Details

Nothing about the `scheduled_publish_at` mechanism is fundraiser-specific.
Any `content_blocks` row in any `page`/`section` can be scheduled the same
way (e.g. the 2027-01-01 launch announcement, the 2027-02-15/03-01 CTA
reinforcements, or the 2027-06-02 Lou Gehrig Day closeout post from #2093's
calendar) by writing directly to `content_blocks` with a future
`scheduled_publish_at` — a dedicated admin authoring endpoint like
`fundraiser-details/create.ts` is a convenience for one recurring feed, not
a requirement of the mechanism itself.
