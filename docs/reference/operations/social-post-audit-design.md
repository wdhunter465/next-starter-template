---
Doc Type: Reference
Audience: Product Authority, Operations, and implementation agents
Authority Level: Controlled
Owns: The social post evidence record: its fields, status meanings, where it is kept, the procedure to recall any past post, and the hand-built records for 2026-11-10 to 2026-11-12
Does Not Own: The daily post design (see /docs/reference/operations/social-daily-post-automation-design.md); the posts themselves (see /docs/reference/operations/social-daily-post-queue-2026-11.md); the archive of post text and photo in D1 (#5097); the weekly scorecard figures (#5198); platform accounts and credentials
Canonical Reference: /docs/reference/operations/social-daily-post-automation-design.md
Related Issues: #5197, #5198, #5143, #5097, #5156, #5159, #5173, #5196
Last Reviewed: 2026-11-12
---

# Social post evidence record

## Purpose

Product Authority, 2026-11-12: on a date years from now (for example 2029-09-10) the club must be able to say what was posted on an earlier date (for example 2027-03-03): the text, the picture used, the date and time the post was created on each platform in use at that time, and any attempt that failed. This document defines the record that answers that question, and shows it filled in by hand for three days.

## Why the ledger is not enough

`social_post_ledger` (#5156) was built to stop a post going out twice. For Facebook, Instagram and Pinterest its `posted` row means "the hand-off Issue was opened", with `platform_post_id` set to `issue#<n>`. It carries no platform id, no platform created time, and no failure from Zapier. On 2026-11-11 it says `posted` for Facebook and Pinterest although no photo post was found on either platform (see the records below). The picture is stored as a photo id only, and the file behind an id can change by 2029.

## The record

One record per post per platform. A record is never edited: a correction is a new record with `version` + 1 and `supersedes` set.

| Field | Meaning |
| --- | --- |
| `schema` | `social_post_evidence/1` |
| `post_id`, `platform` | The queue id (for example `2026-11-12-daily`) and `x`, `facebook`, `instagram` or `pinterest` |
| `version`, `supersedes` | Version number of this record and the version it replaces |
| `scheduled_for` | Planned send time from the queue (New York time) |
| `text`, `text_sha256` | The text that was queued, and its SHA-256 |
| `photo` | `photo_id`, `variant` (`original`, or a platform variant once #5196 lands), `image_url`, `image_sha256`, `image_bytes`, `width`, `height`, `alt_text`. The hash is of the bytes sent. If the photo file changes later, the hash still proves what went out |
| `status` | See the next table |
| `attempts[]` | Every try: `at_utc`, `by` (job, Zap, session or person), `outcome` (`ok`, `error` or `handed_off`), `detail`/error text |
| `handoff` | For Zapier platforms: the hand-off Issue number and the time it was opened |
| `platform_record` | The platform's own `post_id`, `url`, `created_at_utc` and `created_at_new_york`, as read from the platform. Absent when no post was found |
| `anomalies[]` | Posts that appeared on the platform but were not made by the queue (for example a text-only post), with id, time and text |
| `verified` | When (`on`), by whom and by which lookup the platform was read |
| `content_item_id` | Added when #5097 lands: the archive row for this text and photo |
| `note` | Anything a reader in 2029 needs that the fields do not say |

### Status

| Status | Meaning | Counts as |
| --- | --- | --- |
| `handed_off` | The job sent the request or opened the hand-off Issue; the platform has not been read back yet. This is what `posted` meant for Facebook, Instagram and Pinterest | Not yet known |
| `confirmed` | A read-back found the post on the platform and recorded its id and created time | Success |
| `failed` | An attempt returned an error (for example a Buffer error). The error is in `attempts` | Failure |
| `missing` | Handed off, but the read-back found no matching post after the 4-hour lateness window | Failure |
| `not_eligible` | Left off by a queue rule (for example Instagram and a photo outside its limits), with the reason in `note` | Not counted |

## Where it is kept

- **D1:** a table `social_post_evidence`, one row per record version, for queries.
- **Repository:** an append-only export, `data/social-audit/<year>/<month>/<date>.json`, one file per day, committed by a job or a reviewed pull request. The GitHub history then answers the 2029 question on its own, with no database, Zapier or Buffer account.
- **Backups:** the D1 table is covered by the existing backups (`lgfc-d1-backups`).
- **Retention:** indefinite. Nothing in this record is member data; all of it is already public.

## Relation to the archive record (#5097)

#5097 saves the text and photo of each daily post in the D1 archive tables (`content_items`, with its source, credit and rights fields), because text plus photo make up the archive. The evidence record does not copy that: it holds only what the platforms did with the post (attempts, platform id and created time, status, failures) and the hash of the bytes sent. When #5097 lands, an evidence record gains a `content_item_id` pointing at the archive row, and the text and picture in the export remain as a self-contained copy so that the 2029 recall does not depend on either database.

## Platform lookups (tested 2026-11-12, read-only)

| Platform | Lookup | Date and time filter | Failures visible |
| --- | --- | --- | --- |
| X (via Buffer) | Buffer `list_posts` with a `dueAt` window and a `status` filter. Returns id, text, `sentAt`, image address, alt text, image size, error | Yes | Yes (`status: error`) |
| Instagram | Graph API `/<account>/media` with `since` and `until`, through the Zapier raw GET action. Returns id, timestamp, permalink | Yes | No |
| Pinterest | `GET /v5/pins/<id>`, and the "New Pin" trigger for the latest pins. Returns `created_at`, title, description, image, board | By id; the list is the latest only | No |
| Facebook Page | "New Post by You" trigger with the page id. Returns id, `created_time`, message, picture | Latest only; no raw GET action is enabled | No |

Zapier's task history shows Zap failures but is not readable from the repository or from a session.

## Recall procedure

To answer "what was posted on date D":

1. Open `data/social-audit/<year>/<month>/<D>.json`. Each record gives the text, the picture (id, hash, size, alt text), the platform id and link, the platform created time (UTC and New York), the attempts and any failure.
2. If the file is missing, query `social_post_evidence` for the date, then fall back to the queue file in the git history (`data/social-post-queue.json`, text and photo id) and the hand-off Issues (labels `social-post` and `social:<platform>`).
3. To confirm a record against the platform, use the lookup for that platform above.
4. Report per platform: text, picture, created time, status, and any failed attempt with its error.

## Reading the platforms back

Filling `platform_record` needs a read-back after each posting window. Options (decision pending, #5197): (a) a GitHub job with platform API tokens, which needs developer apps and renewal of Meta tokens; (b) a scheduled Claude session that reads through the Buffer and Zapier connectors, which can already read all four platforms; (c) a Zapier write-back step, which the free plan's two-step limit does not allow. The heartbeat (#5159) should flag any day that has no `confirmed` or `not_eligible` record for a platform in the queue.

## Records for 2026-11-10 to 2026-11-12 (by hand)

These were built by hand on 2026-11-12 from the lookups above, as the first test of the recall procedure. The image hash is of the bytes the site served on 2026-11-12; the image size matches what Buffer recorded for each post. Times are UTC unless a field says New York.

| Date | X | Facebook | Instagram | Pinterest |
| --- | --- | --- | --- | --- |
| 2026-11-10 | confirmed 15:04:04 | confirmed 15:21:20 | confirmed 15:21:39 | confirmed 15:21:46 |
| 2026-11-11 | confirmed 15:03:59 | **missing** (hand-off 15:11:02) | not in queue | **missing** (hand-off 15:11:03) |
| 2026-11-12 | confirmed 15:04:07 | confirmed 15:13:55 | not eligible (photo too tall) | confirmed 15:14:02 |

Findings from filling the records in:

- On 2026-11-11 the ledger says `posted` for Facebook and Pinterest, but no matching photo post was found on either. The cause is not determined; Zapier's task history for that day would show it.
- A text-only Facebook post (the topic and a link, no picture) appeared on 2026-11-10, 11 and 12, 7 to 17 minutes before the real post or in place of it. It is not from the queue and is recorded under `anomalies`.
- The hand-off time is 2 to 11 minutes before the platform created time, so the ledger time is not the post time.
- X: Buffer returns its own post id and `sentAt`, not the tweet id or link.

### 2026-11-10-daily

```json
[
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-10-daily",
    "platform": "x",
    "version": 1,
    "scheduled_for": "2026-11-10T10:00:00-05:00",
    "text": "On June 3, 1932, Lou Gehrig hit four home runs in one game against the Philadelphia Athletics, the first player of the 20th century to do it.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "10384323d088c9f773570af15c49af4c3bd40859a34a1c5ec06c869149a07786",
    "photo": {
      "photo_id": 859,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-10-daily",
      "image_sha256": "c45b3d44ca254e3b33d3b59f850ab1ba9b6cdde3b79f9dfd8a9b5d63f4e5846a",
      "image_bytes": 379403,
      "width": 1024,
      "height": 768,
      "alt_text": "Black-and-white photo of four baseball players standing side by side in a ballpark. The two in the middle wear Yankees jerseys and the two on the ends wear jerseys with a large \"A\". The third player from the left holds a glove."
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-10T15:04:06Z",
        "by": "GitHub job \"Social Post to X\"",
        "outcome": "ok",
        "detail": "Buffer post created and sent via shareNow; ledger row written 15:04:06.404Z"
      }
    ],
    "platform_record": {
      "post_id": "6af33262a9f33a390a472cba",
      "url": null,
      "created_at_utc": "2026-11-10T15:04:04Z",
      "created_at_new_york": "2026-11-10T10:04:04-05:00"
    },
    "note": "X created time is Buffer sentAt 15:04:04.649Z; the tweet id and link are not returned by Buffer.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Buffer list_posts (dueAt window)",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-10-daily",
    "platform": "facebook",
    "version": 1,
    "scheduled_for": "2026-11-10T10:00:00-05:00",
    "text": "On June 3, 1932, Lou Gehrig hit four home runs in one game against the Philadelphia Athletics, the first player of the 20th century to do it.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "10384323d088c9f773570af15c49af4c3bd40859a34a1c5ec06c869149a07786",
    "photo": {
      "photo_id": 859,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-10-daily",
      "image_sha256": "c45b3d44ca254e3b33d3b59f850ab1ba9b6cdde3b79f9dfd8a9b5d63f4e5846a",
      "image_bytes": 379403,
      "width": 1024,
      "height": 768,
      "alt_text": "Black-and-white photo of four baseball players standing side by side in a ballpark. The two in the middle wear Yankees jerseys and the two on the ends wear jerseys with a large \"A\". The third player from the left holds a glove."
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-10T15:10:52Z",
        "by": "GitHub job \"Hand-off to Zapier\"",
        "outcome": "handed_off",
        "detail": "Issue #5181 opened; ledger recorded posted (hand-off)"
      }
    ],
    "platform_record": {
      "post_id": "103961431551844_1778988837440004",
      "url": "https://www.facebook.com/103961431551844/posts/1778988837440004",
      "created_at_utc": "2026-11-10T15:21:20Z",
      "created_at_new_york": "2026-11-10T10:21:20-05:00"
    },
    "handoff": {
      "issue_number": 5181,
      "opened_at_utc": "2026-11-10T15:10:52Z"
    },
    "anomalies": [
      {
        "kind": "unplanned_text_only_post",
        "platform_post_id": "103961431551844_1778974990774722",
        "created_at_utc": "2026-11-10T15:04:49Z",
        "text": "Four home runs in one game, June 3, 1932 + link (not from the queue)"
      }
    ],
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Zapier Facebook Pages \"New Post by You\" (page 103961431551844)",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-10-daily",
    "platform": "instagram",
    "version": 1,
    "scheduled_for": "2026-11-10T10:00:00-05:00",
    "text": "On June 3, 1932, Lou Gehrig hit four home runs in one game against the Philadelphia Athletics, the first player of the 20th century to do it.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "10384323d088c9f773570af15c49af4c3bd40859a34a1c5ec06c869149a07786",
    "photo": {
      "photo_id": 859,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-10-daily",
      "image_sha256": "c45b3d44ca254e3b33d3b59f850ab1ba9b6cdde3b79f9dfd8a9b5d63f4e5846a",
      "image_bytes": 379403,
      "width": 1024,
      "height": 768,
      "alt_text": "Black-and-white photo of four baseball players standing side by side in a ballpark. The two in the middle wear Yankees jerseys and the two on the ends wear jerseys with a large \"A\". The third player from the left holds a glove."
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-10T15:10:53Z",
        "by": "GitHub job \"Hand-off to Zapier\"",
        "outcome": "handed_off",
        "detail": "Issue #5182 opened; ledger recorded posted (hand-off)"
      }
    ],
    "platform_record": {
      "post_id": "18131064556881992",
      "url": "https://www.instagram.com/p/DfkN1nUF-x1/",
      "created_at_utc": "2026-11-10T15:21:39Z",
      "created_at_new_york": "2026-11-10T10:21:39-05:00"
    },
    "handoff": {
      "issue_number": 5182,
      "opened_at_utc": "2026-11-10T15:10:53Z"
    },
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Instagram Graph /media with since/until via Zapier raw GET",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-10-daily",
    "platform": "pinterest",
    "version": 1,
    "scheduled_for": "2026-11-10T10:00:00-05:00",
    "text": "On June 3, 1932, Lou Gehrig hit four home runs in one game against the Philadelphia Athletics, the first player of the 20th century to do it.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "10384323d088c9f773570af15c49af4c3bd40859a34a1c5ec06c869149a07786",
    "photo": {
      "photo_id": 859,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-10-daily",
      "image_sha256": "c45b3d44ca254e3b33d3b59f850ab1ba9b6cdde3b79f9dfd8a9b5d63f4e5846a",
      "image_bytes": 379403,
      "width": 1024,
      "height": 768,
      "alt_text": "Black-and-white photo of four baseball players standing side by side in a ballpark. The two in the middle wear Yankees jerseys and the two on the ends wear jerseys with a large \"A\". The third player from the left holds a glove."
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-10T15:10:55Z",
        "by": "GitHub job \"Hand-off to Zapier\"",
        "outcome": "handed_off",
        "detail": "Issue #5183 opened; ledger recorded posted (hand-off)"
      }
    ],
    "platform_record": {
      "post_id": "1041176007736463016",
      "url": "https://www.pinterest.com/pin/1041176007736463016/",
      "created_at_utc": "2026-11-10T15:21:46Z",
      "created_at_new_york": "2026-11-10T10:21:46-05:00"
    },
    "handoff": {
      "issue_number": 5183,
      "opened_at_utc": "2026-11-10T15:10:55Z"
    },
    "note": "Board 1041176076293290189; pin title is the topic.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Pinterest GET /v5/pins/<id> and \"New Pin\" via Zapier",
      "on": "2026-11-12"
    }
  }
]
```

### 2026-11-11-daily

```json
[
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-11-daily",
    "platform": "x",
    "version": 1,
    "scheduled_for": "2026-11-11T10:00:00-05:00",
    "text": "Lou Gehrig hit 23 career grand slams, a major league record until Alex Rodriguez passed him.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "e49c70ae3c522256be14a11f874f99e07dcc43ef5fdf1cf85a2ac2f7dca75ef5",
    "photo": {
      "photo_id": 860,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-11-daily",
      "image_sha256": "df833c0f54be646fc5e019cb97f81861c1010f60d13ac7cf18e1e6923c1822c8",
      "image_bytes": 1305210,
      "width": 1774,
      "height": 2272,
      "alt_text": "Black-and-white newspaper photo of baseball players at home plate, one raising a leg in a small kick toward another. The printed caption reads: \"Lou Gehrig congratulates Ruth with a little kick after the Babe had made his second homer.\""
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-11T15:04:00Z",
        "by": "GitHub job \"Social Post to X\"",
        "outcome": "ok",
        "detail": "Buffer post created and sent via shareNow; ledger row written 15:04:00.150Z"
      }
    ],
    "platform_record": {
      "post_id": "6af483db3b4d19e0b80f60cc",
      "url": null,
      "created_at_utc": "2026-11-11T15:03:59Z",
      "created_at_new_york": "2026-11-11T10:03:59-05:00"
    },
    "note": "X created time is Buffer sentAt 15:03:59.162Z; the tweet id and link are not returned by Buffer.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Buffer list_posts (dueAt window)",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-11-daily",
    "platform": "facebook",
    "version": 1,
    "scheduled_for": "2026-11-11T10:00:00-05:00",
    "text": "Lou Gehrig hit 23 career grand slams, a major league record until Alex Rodriguez passed him.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "e49c70ae3c522256be14a11f874f99e07dcc43ef5fdf1cf85a2ac2f7dca75ef5",
    "photo": {
      "photo_id": 860,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-11-daily",
      "image_sha256": "df833c0f54be646fc5e019cb97f81861c1010f60d13ac7cf18e1e6923c1822c8",
      "image_bytes": 1305210,
      "width": 1774,
      "height": 2272,
      "alt_text": "Black-and-white newspaper photo of baseball players at home plate, one raising a leg in a small kick toward another. The printed caption reads: \"Lou Gehrig congratulates Ruth with a little kick after the Babe had made his second homer.\""
    },
    "status": "missing",
    "attempts": [
      {
        "at_utc": "2026-11-11T15:11:02Z",
        "by": "GitHub job \"Hand-off to Zapier\"",
        "outcome": "handed_off",
        "detail": "Issue #5185 opened; ledger recorded posted (hand-off)"
      }
    ],
    "platform_record": null,
    "handoff": {
      "issue_number": 5185,
      "opened_at_utc": "2026-11-11T15:11:02Z"
    },
    "anomalies": [
      {
        "kind": "unplanned_text_only_post",
        "platform_post_id": "103961431551844_1780239783981576",
        "created_at_utc": "2026-11-11T15:09:16Z",
        "text": "23 career grand slams + link (not from the queue; no photo)"
      }
    ],
    "note": "No photo post with this text was found among the 9 most recent Page posts read on 2026-11-12. Cause not determined; Zapier task history for 2026-11-11 would show it.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Zapier Facebook Pages \"New Post by You\" (page 103961431551844)",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-11-daily",
    "platform": "pinterest",
    "version": 1,
    "scheduled_for": "2026-11-11T10:00:00-05:00",
    "text": "Lou Gehrig hit 23 career grand slams, a major league record until Alex Rodriguez passed him.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "e49c70ae3c522256be14a11f874f99e07dcc43ef5fdf1cf85a2ac2f7dca75ef5",
    "photo": {
      "photo_id": 860,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-11-daily",
      "image_sha256": "df833c0f54be646fc5e019cb97f81861c1010f60d13ac7cf18e1e6923c1822c8",
      "image_bytes": 1305210,
      "width": 1774,
      "height": 2272,
      "alt_text": "Black-and-white newspaper photo of baseball players at home plate, one raising a leg in a small kick toward another. The printed caption reads: \"Lou Gehrig congratulates Ruth with a little kick after the Babe had made his second homer.\""
    },
    "status": "missing",
    "attempts": [
      {
        "at_utc": "2026-11-11T15:11:03Z",
        "by": "GitHub job \"Hand-off to Zapier\"",
        "outcome": "handed_off",
        "detail": "Issue #5186 opened; ledger recorded posted (hand-off)"
      }
    ],
    "platform_record": null,
    "handoff": {
      "issue_number": 5186,
      "opened_at_utc": "2026-11-11T15:11:03Z"
    },
    "note": "No pin on board 1041176076293290189 was created between 2026-11-11 and 2026-11-12 among the 24 pins read. A pin on board 1041176076293604868 at 2026-11-11T11:26:49Z links to an Instagram post and is not from the queue. Cause not determined; Zapier task history would show it.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Pinterest GET /v5/pins/<id> and \"New Pin\" via Zapier",
      "on": "2026-11-12"
    }
  }
]
```

### 2026-11-12-daily

```json
[
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-12-daily",
    "platform": "x",
    "version": 1,
    "scheduled_for": "2026-11-12T10:00:00-05:00",
    "text": "On July 4, 1939, the Yankees retired Lou Gehrig's number 4, the first uniform number retired in major league baseball.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "a544635fe4d36e0eb466835287c6a9fb9fc54f26de76bb3384551d2343d241d0",
    "photo": {
      "photo_id": 864,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-12-daily",
      "image_sha256": "fe22aad5087af18efb0e499f835b4fef44268dbeb9d524e037c2524c9ea431d1",
      "image_bytes": 3287027,
      "width": 2424,
      "height": 3397,
      "alt_text": "Black-and-white printed portrait of Lou Gehrig in a cap and baseball jersey, smiling slightly. The page prints \"Henry Louis 'Lou' Gehrig. Idol of all American League fans and one of the greatest first basemen of all time. International News Photo.\""
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-12T15:04:08Z",
        "by": "GitHub job \"Social Post to X\"",
        "outcome": "ok",
        "detail": "Buffer post created and sent via shareNow; ledger row written 15:04:08.367Z"
      }
    ],
    "platform_record": {
      "post_id": "6af5d563df65abceb03c9a13",
      "url": null,
      "created_at_utc": "2026-11-12T15:04:07Z",
      "created_at_new_york": "2026-11-12T10:04:07-05:00"
    },
    "note": "X created time is Buffer sentAt 15:04:07.340Z; the tweet id and link are not returned by Buffer.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Buffer list_posts (dueAt window)",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-12-daily",
    "platform": "facebook",
    "version": 1,
    "scheduled_for": "2026-11-12T10:00:00-05:00",
    "text": "On July 4, 1939, the Yankees retired Lou Gehrig's number 4, the first uniform number retired in major league baseball.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "a544635fe4d36e0eb466835287c6a9fb9fc54f26de76bb3384551d2343d241d0",
    "photo": {
      "photo_id": 864,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-12-daily",
      "image_sha256": "fe22aad5087af18efb0e499f835b4fef44268dbeb9d524e037c2524c9ea431d1",
      "image_bytes": 3287027,
      "width": 2424,
      "height": 3397,
      "alt_text": "Black-and-white printed portrait of Lou Gehrig in a cap and baseball jersey, smiling slightly. The page prints \"Henry Louis 'Lou' Gehrig. Idol of all American League fans and one of the greatest first basemen of all time. International News Photo.\""
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-12T15:11:54Z",
        "by": "GitHub job \"Hand-off to Zapier\"",
        "outcome": "handed_off",
        "detail": "Issue #5188 opened; ledger recorded posted (hand-off)"
      }
    ],
    "platform_record": {
      "post_id": "103961431551844_1781498000522421",
      "url": "https://www.facebook.com/103961431551844/posts/1781498000522421",
      "created_at_utc": "2026-11-12T15:13:55Z",
      "created_at_new_york": "2026-11-12T10:13:55-05:00"
    },
    "handoff": {
      "issue_number": 5188,
      "opened_at_utc": "2026-11-12T15:11:54Z"
    },
    "anomalies": [
      {
        "kind": "unplanned_text_only_post",
        "platform_post_id": "103961431551844_1781489450523276",
        "created_at_utc": "2026-11-12T15:07:27Z",
        "text": "Number 4 retired, July 4, 1939 + link (not from the queue)"
      }
    ],
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Zapier Facebook Pages \"New Post by You\" (page 103961431551844)",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-12-daily",
    "platform": "pinterest",
    "version": 1,
    "scheduled_for": "2026-11-12T10:00:00-05:00",
    "text": "On July 4, 1939, the Yankees retired Lou Gehrig's number 4, the first uniform number retired in major league baseball.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "a544635fe4d36e0eb466835287c6a9fb9fc54f26de76bb3384551d2343d241d0",
    "photo": {
      "photo_id": 864,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-12-daily",
      "image_sha256": "fe22aad5087af18efb0e499f835b4fef44268dbeb9d524e037c2524c9ea431d1",
      "image_bytes": 3287027,
      "width": 2424,
      "height": 3397,
      "alt_text": "Black-and-white printed portrait of Lou Gehrig in a cap and baseball jersey, smiling slightly. The page prints \"Henry Louis 'Lou' Gehrig. Idol of all American League fans and one of the greatest first basemen of all time. International News Photo.\""
    },
    "status": "confirmed",
    "attempts": [
      {
        "at_utc": "2026-11-12T15:11:55Z",
        "by": "GitHub job \"Hand-off to Zapier\"",
        "outcome": "handed_off",
        "detail": "Issue #5189 opened; ledger recorded posted (hand-off)"
      }
    ],
    "platform_record": {
      "post_id": "1041176007736518085",
      "url": "https://www.pinterest.com/pin/1041176007736518085/",
      "created_at_utc": "2026-11-12T15:14:02Z",
      "created_at_new_york": "2026-11-12T10:14:02-05:00"
    },
    "handoff": {
      "issue_number": 5189,
      "opened_at_utc": "2026-11-12T15:11:55Z"
    },
    "note": "Board 1041176076293290189; pin title is the topic.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Pinterest GET /v5/pins/<id> and \"New Pin\" via Zapier",
      "on": "2026-11-12"
    }
  },
  {
    "schema": "social_post_evidence/1",
    "post_id": "2026-11-12-daily",
    "platform": "instagram",
    "version": 1,
    "scheduled_for": "2026-11-12T10:00:00-05:00",
    "text": "On July 4, 1939, the Yankees retired Lou Gehrig's number 4, the first uniform number retired in major league baseball.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com",
    "text_sha256": "a544635fe4d36e0eb466835287c6a9fb9fc54f26de76bb3384551d2343d241d0",
    "photo": {
      "photo_id": 864,
      "variant": "original",
      "image_url": "https://www.lougehrigfanclub.com/api/social/image/2026-11-12-daily",
      "image_sha256": "fe22aad5087af18efb0e499f835b4fef44268dbeb9d524e037c2524c9ea431d1",
      "image_bytes": 3287027,
      "width": 2424,
      "height": 3397,
      "alt_text": "Black-and-white printed portrait of Lou Gehrig in a cap and baseball jersey, smiling slightly. The page prints \"Henry Louis 'Lou' Gehrig. Idol of all American League fans and one of the greatest first basemen of all time. International News Photo.\""
    },
    "status": "not_eligible",
    "attempts": [],
    "platform_record": null,
    "note": "Photo 864 is 2424x3397 (ratio 0.71), outside Instagram's 4:5 to 1.91:1 limit, so the queue leaves Instagram off (#5173). No hand-off Issue was opened. Instagram media list for the 2026-11-12 window was empty.",
    "verified": {
      "by": "Claude Code (by hand, #5197)",
      "method": "Instagram Graph /media with since/until via Zapier raw GET",
      "on": "2026-11-12"
    }
  }
]
```

## Child Issues (proposed order)

1. Change the ledger status meaning (`posted` becomes `handed_off` for Zapier platforms) and add the evidence table.
2. The read-back step and the heartbeat check for a missing record.
3. The daily export to `data/social-audit/`.
4. Back-fill of 2026-11-04 to 2026-11-12 into D1 (a Production write; needs an explicit Go).
5. Weekly scorecard counts and the trend history (#5198), which read these statuses.
