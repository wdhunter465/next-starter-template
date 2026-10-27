---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Procedure for preparing an implementation plan for the LGFC orchestration tier
Does Not Own: Orchestration state contracts; routing configuration; product design
Canonical Reference: /docs/reference/architecture/orchestration-model.md
Related Issues: #1449, #4776
Last Reviewed: 2026-10-26
---

# Create an Orchestrated Implementation Plan

## Steps

1. Create a Markdown file under `/docs/ops/implementation-plans/`.
2. Add the required front matter:

   ```yaml
   ---
   Doc Type: Implementation Plan
   Status: production-ready
   Project: <project-name>
   Owner: PMO
   Execution Mode: orchestrated
   ---
   ```

3. Add one task section per executable unit:

   ```markdown
   ## Task 001 — <short title>

   Type: repository | website | governance | docs | recovery
   Agent: codex | cursor | copilot | ChatGPT
   Priority: 1
   Depends On: none | Task 000
   Allowed Files:
   - path/example
   Acceptance Criteria:
   - exact measurable result
   Validation:
   - exact command or review requirement
   ```

4. Add a **Dependency Map** section before marking a launched program plan
   `production-ready`. For each task or checkpoint, record predecessor,
   successor, stage-before-merge (`yes` / `no`), halt condition, and resume
   condition. See
   `/docs/reference/pmo/lgfc-program-queue-and-dependency-map.md`.
5. Keep each task to one objective and one primary agent.
6. List every file the agent may touch in `Allowed Files`.
7. Keep validation explicit enough for a reviewer or workflow to run without interpretation.
8. Commit the plan to `main` only after it is ready for issue creation.

## Notes

- `Status: production-ready` is the activation switch for issue creation.
- After the issue factory runs, it changes the plan status to `issues-created`.
- The first produced task enters `status:queued`; later tasks enter `status:blocked`.
- Route task types and agent choices must match `/.github/orchestrator-routing.json`.
- The state model is defined in `/docs/reference/architecture/orchestration-model.md`.
