const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

function searchHref(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : '#';
  } catch {
    return '#';
  }
}

function cardGrid(queues) {
  if (!queues.length) return '';
  return `<div class="queue-grid">${queues.map((queue) => `<article class="queue-card"><h3>${esc(queue.title)}</h3><p class="count">${esc(queue.count)}</p><p class="meta"><a href="${searchHref(queue.issueSearchUrl)}">Open issues on GitHub</a></p></article>`).join('')}</div>`;
}

function totalBanner(data) {
  const total = data.teamQueues?.totalOpenIssues;
  if (!Number.isInteger(total)) return '';
  const href = searchHref(data.teamQueues?.totalOpenIssuesUrl);
  return `<section class="queue-row total-open"><h2>Repository open issues</h2><div class="queue-grid"><article class="queue-card queue-card-total"><h3>Total open</h3><p class="count">${esc(total)}</p><p class="meta"><a href="${href}">All open issues on GitHub</a></p></article></div></section>`;
}

function breakoutSection(data) {
  const b = data.teamQueues?.breakout;
  if (!b || !Number.isInteger(b.totalOpenIssues)) return '';
  const rows = [
    ['Operations', b.operations],
    ['Engineering', b.engineering],
    ['Governance', b.governance],
    ['PMO parents', b.pmoParents],
    ['PMO child / task', b.pmoTasks],
    ['Other / unassigned', b.other]
  ];
  const sum = rows.reduce((n, [, c]) => n + (Number.isInteger(c) ? c : 0), 0);
  const match = sum === b.totalOpenIssues;
  const note = match
    ? 'Breakout categories are mutually exclusive and sum to total open issues.'
    : `Breakout sum (${sum}) does not match total (${b.totalOpenIssues}); regenerate or verify live Issues.`;
  const list = rows
    .map(([label, count]) => `<li><span class="breakout-label">${esc(label)}</span> <span class="breakout-count">${esc(count)}</span></li>`)
    .join('');
  return `<section class="queue-row breakout"><h2>Assignment breakout</h2><p class="meta">${esc(note)}</p><ul class="breakout-list">${list}</ul></section>`;
}

fetch('dashboard-data.json')
  .then((response) => response.json())
  .then((data) => {
    const teams = data.teamQueues?.queues || [];
    const pmo = data.teamQueues?.pmoQueues || [];
    const other = data.teamQueues?.otherQueue ? [data.teamQueues.otherQueue] : [];
    const teamsRow = teams.length
      ? `<section class="queue-row"><h2>Team queues</h2>${cardGrid(teams)}</section>`
      : '';
    const pmoRow = pmo.length
      ? `<section class="queue-row"><h2>PMO parent projects</h2>${cardGrid(pmo)}</section>`
      : '';
    const otherRow = other.length
      ? `<section class="queue-row"><h2>Other / unassigned</h2>${cardGrid(other)}</section>`
      : '';
    const body = teamsRow || pmoRow || otherRow
      ? `${totalBanner(data)}${teamsRow}${pmoRow}${otherRow}${breakoutSection(data)}`
      : '<p class="empty">Team-queue counts are not available in this generated snapshot.</p>';
    document.getElementById('dashboard').innerHTML = `<p class="meta">Generated ${esc(new Date(data.generatedAt).toLocaleString())} from ${esc(data.repository)} GitHub Issues. Total open issues is the repository-wide open issue count (PRs excluded). Team tiles count standalone work only. Project children (a parent link or pmo:task) are omitted here and counted on the dashboard. The assignment breakout still accounts for every open Issue.</p>${body}`;
  })
  .catch((error) => {
    document.getElementById('dashboard').textContent = `Team-queue data could not be loaded: ${error.message}`;
  });
