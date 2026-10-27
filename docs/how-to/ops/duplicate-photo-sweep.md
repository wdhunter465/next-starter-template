---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How the published-photo near-duplicate sweep reports a pair and how a reviewed pair is remembered
Does Not Own: Removing, merging, or hiding a photo
Canonical Reference: /docs/how-to/ops/run-day2-monitoring-checks.md
Related Issues: #4707, #4705
Last Reviewed: 2026-10-26
---

# Duplicate photo sweep

## Purpose

Find published photos that look alike, including photos that have no stored hash, and ask a person to look at each new pair.

## Scope

Workflow: `.github/workflows/ops-duplicate-photo-sweep.yml` (daily at 12:47 UTC)

Script: `scripts/ops/duplicate-photo-sweep.mjs`

Reviewed pairs: `scripts/ops/duplicate-photo-reviewed.json`

The sweep reads `GET /api/photos` on `https://www.lougehrigfanclub.com` and downloads each public image address. It computes the perceptual hash from those bytes in memory. It does not write to Production, Backblaze, or D1.

A pair at distance 10 or less opens or updates one Issue, `OPS — Near-duplicate published photos`, labeled `team:operations` and `ops-exception`. The Issue names both ids, both file names, both sizes, the distance, and which copy is larger. Renditions of one original (the Club Home `medium` and `thumbnail` copies, for example) are one photo.

The hash is a signal. Two different photos of the same pose can be close. Do not remove, merge, or hide a photo because of this report.

## Procedure

1. Open the pair and look at both images.
2. If they are the same photo, decide the kept copy under a source Issue. This sweep does not make that change.
3. If the pair has been reviewed, add it to `scripts/ops/duplicate-photo-reviewed.json` by pull request:

```json
{ "ids": [855, 857], "note": "reviewed 2026-10-26" }
```

A pair in that file does not open another Issue.

## Rollback

Revert the pull request. The sweep stops. No Production state changes.
