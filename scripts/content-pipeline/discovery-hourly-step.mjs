// Prints the query-plan step for the current UTC hour as GitHub Actions outputs (#5225).
// Usage: node scripts/content-pipeline/discovery-hourly-step.mjs [--at 2026-11-13T15:17:00Z]
// Writes key=value lines to $GITHUB_OUTPUT when set, and to stdout.
import { appendFileSync } from 'node:fs';
import { loadQueryPlan, stepForHour } from './discovery-query-plan.mjs';

const atIndex = process.argv.indexOf('--at');
const when = atIndex > -1 ? new Date(process.argv[atIndex + 1]) : new Date();
const step = stepForHour(loadQueryPlan(), when);
const lines = [
  `step_id=${step.id}`,
  `query=${step.query}`,
  `source=${step.source}`,
  `page=${step.page ?? 1}`,
  `date_end=${step.dateEnd ?? ''}`,
];
for (const line of lines) console.log(line);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
