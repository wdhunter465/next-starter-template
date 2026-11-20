const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

function issueHref(base, number) {
  try {
    const url = new URL(`${base}${number}`);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : '#';
  } catch {
    return '#';
  }
}

function rowHtml(base, row) {
  const state = (row.state || []).map((label) => `<span class="pill">${esc(label)}</span>`).join(' ');
  const claim = (row.claim || []).map(esc).join(', ');
  const parent = row.parent ? ` <span class="meta">parent #${esc(row.parent)}</span>` : '';
  const goLive = row.goLive ? ' <span class="pill">go-live-2027</span>' : '';
  return `<tr><td><a href="${issueHref(base, row.number)}">#${esc(row.number)}</a></td><td>${esc(row.title)}${parent}${goLive}</td><td>${esc(row.priority || '')}</td><td>${state}</td><td>${claim}</td></tr>`;
}

function tableHtml(base, rows) {
  if (!rows.length) return '<p class="empty">No open Issues in this queue.</p>';
  return `<div class="table-wrap"><table><thead><tr><th>Issue</th><th>Title</th><th>Priority</th><th>State</th><th>Claim</th></tr></thead><tbody>${rows.map((row) => rowHtml(base, row)).join('')}</tbody></table></div>`;
}

function numberList(base, numbers) {
  if (!numbers.length) return 'none';
  return numbers.map((n) => `<a href="${issueHref(base, n)}">#${esc(n)}</a>`).join(', ');
}

function accountingHtml(base, a) {
  const note = a.balanced
    ? 'Listed rows plus project children equal the open Issue count.'
    : 'Accounting does not balance: regenerate or verify live Issues.';
  return `<section class="queue-row"><h2>Accounting</h2><p class="meta">${esc(note)}</p><ul class="breakout-list"><li><span class="breakout-label">Open Issues</span> <span class="breakout-count">${esc(a.totalOpenIssues)}</span></li><li><span class="breakout-label">Listed above</span> <span class="breakout-count">${esc(a.listed)}</span></li><li><span class="breakout-label">Project children</span> <span class="breakout-count">${esc(a.projectChildren)}</span></li><li><span class="breakout-label">Not placed in a queue</span> <span class="breakout-count">${esc(a.unplaced)}</span></li></ul><p class="meta">Not placed in a queue: ${numberList(base, a.unplacedIssues || [])}</p><p class="meta">No team label: ${numberList(base, a.noTeamLabel)}</p><p class="meta">More than one team label: ${numberList(base, a.multipleTeamLabels)}</p><p class="meta">Project children carrying a team label: ${numberList(base, a.projectChildrenWithTeamLabel)}</p></section>`;
}

function goLiveHtml(base, v) {
  if (!v) return '';
  const u = v.unbucketed || [];
  const note = u.length
    ? 'Issues listed below are neither go-live nor held or waiting; each needs a go-live label, a hold or wait label, or closure.'
    : 'Every listed Issue is go-live or in the deferred bucket.';
  return `<section class="queue-row"><h2>Go-live view</h2><p class="meta">${esc(note)}</p><ul class="breakout-list"><li><span class="breakout-label">Go-live (go-live-2027)</span> <span class="breakout-count">${esc(v.goLive)}</span></li><li><span class="breakout-label">Deferred (held or waiting)</span> <span class="breakout-count">${esc(v.deferred)}</span></li><li><span class="breakout-label">Neither</span> <span class="breakout-count">${esc(u.length)}</span></li></ul><p class="meta">Neither: ${numberList(base, u)}</p></section>`;
}

fetch('dashboard-data.json')
  .then((response) => response.json())
  .then((data) => {
    const w = data.queueWorklist;
    if (!w || !Array.isArray(w.queues)) {
      document.getElementById('dashboard').innerHTML = '<p class="empty">The queue worklist is not available in this generated snapshot.</p>';
      return;
    }
    const base = w.issueUrlBase || '';
    const banner = w.interrupt && w.interrupt.length
      ? `<section class="queue-row"><h2>Operations interrupt</h2>${tableHtml(base, w.interrupt)}</section>`
      : '<section class="queue-row"><h2>Operations interrupt</h2><p class="empty">No actionable Operations Issue.</p></section>';
    const sections = w.queues
      .map((queue) => `<section class="queue-row"><h2>${esc(queue.title)} (${esc(queue.rows.length)})</h2>${tableHtml(base, queue.rows)}</section>`)
      .join('');
    document.getElementById('dashboard').innerHTML = `<p class="meta">Generated ${esc(new Date(data.generatedAt).toLocaleString())} from ${esc(data.repository)} GitHub Issues.</p>${banner}${sections}${goLiveHtml(base, w.goLiveView)}${accountingHtml(base, w.accounting)}`;
  })
  .catch((error) => {
    document.getElementById('dashboard').textContent = `Queue worklist data could not be loaded: ${error.message}`;
  });
