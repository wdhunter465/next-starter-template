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

fetch('dashboard-data.json')
  .then((response) => response.json())
  .then((data) => {
    const queues = data.teamQueues?.queues || [];
    const cards = queues.length
      ? `<div class="queue-grid">${queues.map((queue) => `<article class="queue-card"><h2>${esc(queue.title)}</h2><p class="count">${esc(queue.count)}</p><p class="meta"><a href="${searchHref(queue.issueSearchUrl)}">Open issues on GitHub</a></p></article>`).join('')}</div>`
      : '<p class="empty">Team-queue counts are not available in this generated snapshot.</p>';
    document.getElementById('dashboard').innerHTML = `<p class="meta">Generated ${esc(new Date(data.generatedAt).toLocaleString())} from ${esc(data.repository)} GitHub Issues. Counts include only open issues with exactly one approved team owner. PMO Active and PMO Pipeline additionally require exactly one of pmo:active or pmo:pipeline.</p>${cards}`;
  })
  .catch((error) => {
    document.getElementById('dashboard').textContent = `Team-queue data could not be loaded: ${error.message}`;
  });
