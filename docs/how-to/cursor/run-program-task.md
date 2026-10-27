---
Doc Type: How-To
Audience: AI
Authority Level: Procedure
Owns: Step-by-step Cursor procedure for executing one LGFC program task
Does Not Own: Task acceptance criteria or GitHub issue state changes
Canonical Reference: /docs/reference/pmo/lgfc-cursor-execution-contract.md
Related Issues: #1351
Last Reviewed: 2026-06-05
---

# Run a Program Task in Cursor

## Procedure

1. Confirm the active source issue.
2. Read the issue body and allowed files.
3. Read the Cursor execution contract.
4. Inspect only the files needed for the task.
5. Edit only files inside the allowlist.
6. Run the required validation commands.
7. Prepare a review packet for ChatGPT.
8. Open a PR only after ChatGPT or Bill authorizes PR creation.

## Stop Conditions

Stop and report instead of editing when:

- required files are outside the allowlist;
- a workflow/runtime change appears necessary but the task is docs-only;
- issue closure or relabeling is required;
- the task appears to duplicate another active issue;
- validation fails for a file touched by the task.

## Standard Validation Disclosure

When repo-wide validation fails because of pre-existing out-of-scope files, disclose:

```text
Repo-wide validation failed due to pre-existing out-of-scope file: <path>.
Changed-file validation passed.
```

Do not fix out-of-scope validation failures unless the active task authorizes it.
