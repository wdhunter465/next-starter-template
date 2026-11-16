---
Doc Type: How-to
Audience: Human + AI
Authority Level: Supporting
Owns: How the outage and failed-deploy alert email is switched on, what it sends, and what it never sends
Does Not Own: Which events count as alerts (decision 3 of #4657), the uptime probe targets, or the GitHub Issues the alerts also open
Canonical Reference: /docs/ops/reports/launch-monitoring-gap-review.md
Related Issues: #4687, #4657
Last Reviewed: 2026-11-16
---

# Switching on the outage and failed-deploy alert email

## Purpose

Alerts used to reach GitHub only. Decision 3 of #4657 (Product Authority, 2026-10-19) limits email alerts to two events: an **outage** (the site uptime probe failing on two runs in a row) and a **failed Production deploy**. Nothing else sends. The code is in place and does nothing until the three settings below exist.

## What it sends

- **Outage:** on the second failing probe run in a row (the probe runs every 30 minutes), one email, then a note on the open outage Issue so later failing runs do not send again. A recovery sends nothing.
- **Failed deploy:** one email when the failed-deploy Issue is first opened. Later failures on the same open Issue only add comments.
- Both are sent by `scripts/ops/alert-email.mjs`, which refuses any other kind of alert. A send failure never fails the job; the GitHub Issue stays the record.

## Procedure

1. Product Authority chooses the recipients (Bill and the Operations holder) and a sender address on a domain MailChannels may send for.
2. Set the repository variables `ALERT_EMAIL_TO` (comma-separated addresses) and `ALERT_EMAIL_FROM`.
3. Add the repository secret `ALERT_MAILCHANNELS_API_KEY` (a MailChannels send key). Product Authority adds the secret in repository settings, or asks Claude Code for the secure credential form; it is never pasted into an Issue or chat.
4. Test it once without waiting for an outage: run the **OPS — Site Uptime Probe** workflow while a probe target is deliberately failing, or ask Claude Code to run the sender script against a test address. Confirm the email arrives and the mail app is set to notify loudly for that sender.
5. To switch it off, delete the secret or the `ALERT_EMAIL_TO` variable. The alerts then go back to GitHub only.

## Not covered

A true phone push (for example a push service) would replace the send step in `scripts/ops/alert-email.mjs` and leave the triggers unchanged. That is a separate choice and a new secret.
