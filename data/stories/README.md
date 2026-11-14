# Story batches (#5244)

A batch is one JSON file in this folder, loaded into the D1 story inventory as **pending (`draft`) rows only** by the
workflow `OPS: Story batch load` (`.github/workflows/ops-story-batch-load.yml`). See
`docs/how-to/ops/load-a-story-batch.md`. `example-batch.json` shows the shape and is never loaded.

Rules enforced by the loader (`scripts/ci/story_batch_load.mjs`):

- A story marked `three_source_verified` lists at least three distinct source URLs. Anything else is `unverified`
  and is loaded with a note that it needs the three-source check before approval.
- A story that excerpts a book carries `excerpt_of` (work, author, page when known), and its `credit_line` names the
  author and work (and the page when given). For Jonathan Eig's *Luckiest Man* the credit is required.
- Rows are never published by the loader. Approval is a separate step.
