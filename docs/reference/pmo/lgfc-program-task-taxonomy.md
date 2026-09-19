---
Doc Type: Reference
Audience: Human + AI
Authority Level: Operational Authority
Owns: LGFC task types, ownership boundaries, and task-to-issue mapping rules
Does Not Own: Individual task acceptance criteria or issue state mutations
Canonical Reference: /docs/reference/pmo/lgfc-program-portfolio-model.md
Related Issues: #1335, #1351, #4174
Last Reviewed: 2026-09-19
---

# LGFC Program Task Taxonomy

## Purpose

Define common task classes so implementers and **PMO Admin** use the same execution language.

## Task Classes

| Type | Meaning | Typical owner | Output |
|---|---|---|---|
| governance | Rules, queue, authority, PMO structure | PMO Admin | docs and issue protocol |
| ci | CI documentation, workflow inventory, evidence | Implementation / Operations | docs PR, no runtime unless authorized |
| website | shipped-site reconciliation and product docs | Implementation / Operations | docs PR or bounded app PR |
| docs | DIATAXIS mapping and documentation health | Implementation / Operations | docs PR |
| ops | monitoring, runtime surface, operational evidence | Implementation / Operations | docs/report PR |
| review | synthesis and launch-gate decision | PMO Admin | report and issue comments |

## Task Shape

A valid task has:

- one source issue;
- one bounded file allowlist;
- one implementation PR;
- explicit validation commands;
- explicit closeout rules;
- no hidden child task sequence unless the source issue says it is an umbrella.

## singular task vs umbrella issue

| issue shape | Creates child tasks? | Example |
|---|---:|---|
| program umbrella issue | Yes, through approved plan | #1335 |
| Task issue | No | #1339, #1340 |
| maintenance umbrella issue | Later, after launch gate | #1058 |
| Legacy/stale issue | No; close or supersede with evidence | #1009, #1011 |

## Rule

Do not infer that a large task is an umbrella. If the issue title/body does not explicitly authorize child issue creation, treat it as a singular executable task.

## Program 1 Task Sequence

Program 1 task issues are already created:

```text
#1339 → #1340 → #1341 → #1342 → #1343 → #1344 → #1345 → #1346
```

Implementation remains serial unless PMO rules authorize read-only parallel research.
