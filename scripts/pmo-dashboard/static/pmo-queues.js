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
  return `<div class="queue-grid">${queues.map((queue) => `<article class="queue-card"><h2>${esc(queue.title)}</h2><p class="count">${esc(queue.count)}</p><p class="meta"><a href="${searchHref(queue.issueSearchUrl)}">Open issues on GitHub</a></p></article>`).join('')}</div>`;
}

fetch('dashboard-data.json')
  .then((response) => response.json())
  .then((data) => {
    const teams = data.teamQueues?.queues || [];
    const pmo = data.teamQueues?.pmoQueues || [];
    const teamsRow = teams.length
      ? `<section class="queue-row"><h2>Team queues</h2>${cardGrid(teams)}</section>`
      : '';
    const pmoRow = pmo.length
      ? `<section class="queue-row"><h2>PMO parent projects</h2>${cardGrid(pmo)}</section>`
      : '';
    const body = teamsRow || pmoRow
      ? `${teamsRow}${pmoRow}`
      : '<p class="empty">Team-queue counts are not available in this generated snapshot.</p>';
    document.getElementById('dashboard').innerHTML = `<p class="meta">Generated ${esc(new Date(data.generatedAt).toLocaleString())} from ${esc(data.repository)} GitHub Issues. Team tiles count open issues with exactly one approved team owner. PMO tiles count parent projects only: tracked equals Pipeline plus Active, and child tasks are omitted.</p>${body}`;
  })
  .catch((error) => {
    document.getElementById('dashboard').textContent = `Team-queue data could not be loaded: ${error.message}`;
  });
