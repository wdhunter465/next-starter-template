---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Steps to prove that the Club Home sections rotate without repeats, and to watch a rotation on a non-Production database
Does Not Own: The rotation scoring rules, the decision to schedule edition regeneration, the size of the story pool, or any Production write
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #4900, #4901, #4414
Last Reviewed: 2026-10-26
---

# Verify Club Home rotation

## Purpose

Show that the Club Home "newspaper" (lead story, story rail, archive spotlight, featured photo) keeps changing, shows no story twice in one edition, and uses every eligible story before it leans on repeats.

## Run the simulation

1. Run `npm ci` once, then `npx vitest run tests/club-home-rotation-cycle-simulation.test.ts`.
2. The test applies the repository migrations to an in-memory database, seeds pools of 8, 12 and 16 stories, regenerates editions day by day and checks each rule below. All tests must pass.

| Rule checked | What a failure means |
| --- | --- |
| No story appears twice in one edition | A zone is repeating another zone's story |
| Each regeneration changes the active edition and its content | The homepage is not refreshing |
| Every primary story gets the lead within a few editions, and no lead repeats three editions running | The lead story is stuck |
| Every eligible story is shown within a few editions and usage stays balanced | Part of the pool is never used |
| Each placed story gets `last_featured` and `usage_count` | Cooldown and fairness have no data to work with |
| A pool smaller than the zones need still renders | A small pool breaks the page |

## Watch a rotation without touching Production

1. Use a Development or Preview database, never Production `lgfc_lite`. Seed it with published `club_home` stories (the pilot pack in `seed/content/club-home-pilot-pack.json` is one source).
2. As an admin on that environment, call `POST /api/admin/editorial/club-home-edition-regenerate` and open the Club Home page.
3. Repeat the call. Each call builds a new edition and activates it. `POST /api/admin/editorial/club-home-edition-rollback` returns to a previous edition.
4. Compare the stories shown after each call. Stories you have not seen should appear before earlier ones come back.

Regenerating on Production is a Production write and needs Product Authority's Go.

## Limits to know

- Editions change only when regeneration is called. Nothing schedules it today (#4900). Scheduling it is a separate Production decision.
- Each story placed gets a 14-day hard cooldown. Seven slots a day use up a small pool quickly: avoiding any repeat inside the cooldown at one edition a day takes about 100 eligible stories. With a smaller pool the page still renders, and the oldest-shown stories return first. A weekly edition needs about 14.
- Production had four stories allowed on Club Home on 2026-10-26. Growing the pool is tracked on #4901.
