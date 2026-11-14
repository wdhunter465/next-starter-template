const views = [
  ['activePrograms', 'Active Programs'],
  ['pmoPipeline', 'PMO Pipeline']
];
const portfolioColumns = [
  'Program / Project Name',
  'Issue #',
  'Priority',
  'Status',
  '% Complete',
  '# of Tasks',
  '# of Tasks Completed',
  'Owner / Agent',
  'Program Description',
  'Anticipated Completion Date'
];
const fmt = (value, fallback = '') => (value === null || value === undefined || value === '' ? fallback : String(value));
const esc = (value) => fmt(value, '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));
const pct = (value) => (typeof value === 'number' && Number.isFinite(value) ? `${value}%` : 'N/A');
const issueHref = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : '#';
  } catch {
    return '#';
  }
};

function portfolioRowHtml(row, isChild = false) {
  const prefix = isChild ? '↳ ' : '';
  const childClass = isChild ? ' child-row' : '';
  const priority = row.priorityDisplay || row.priority || '';
  return `<tr class="${childClass.trim()}"><td><span class="row-prefix">${esc(prefix)}</span><a href="${issueHref(row.issueUrl)}">${esc(row.name || row.title || 'Unnamed PMO item')}</a><br><span class="pill">${esc(row.type || row.lifecycle || 'item')}</span></td><td><a href="${issueHref(row.issueUrl)}">#${esc(fmt(row.issueNumber))}</a></td><td>${esc(fmt(priority))}</td><td>${esc(fmt(row.status))}</td><td>${esc(pct(row.percentComplete))}</td><td>${esc(fmt(row.taskCount, '0'))}</td><td>${esc(fmt(row.tasksCompleted, '0'))}</td><td>${esc(fmt(row.ownerAgent, 'Pending Assignment'))}</td><td>${esc(fmt(row.description, ''))}</td><td>${esc(fmt(row.anticipatedCompletionDate, '—'))}</td></tr>`;
}

function rowsHtml(row) {
  return portfolioRowHtml(row, false);
}

fetch('dashboard-data.json')
  .then((response) => response.json())
  .then((data) => {
    const modelNote = data.contractVersion === 'pmo-july-2026'
      ? ' PMO July 2026 contract.'
      : (data.trackingModel === 'pmo-label' ? ' PMO-label tracking.' : '');
    const book = data.currentBook || {};
    const bookNote = Number.isInteger(book.activeCount)
      ? ` Active projects: ${esc(fmt(book.activeCount))}. Pipeline projects: ${esc(fmt(book.pipelineCount))}. Open child Issues: ${esc(fmt(book.openChildCount, '0'))}. Closed child Issues: ${esc(fmt(book.closedChildCount, '0'))}.`
      : '';
    const sections = views.map(([key, title]) => {
      const rows = data.views?.[key] || [];
      return `<section><h2>${esc(title)}</h2>${rows.length
        ? `<div class="table-wrap"><table><thead><tr>${portfolioColumns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => rowsHtml(row)).join('')}</tbody></table></div>`
        : `<p class="empty">No ${esc(title.toLowerCase())} rows are currently available.</p>`}</section>`;
    });
    document.getElementById('dashboard').innerHTML = `<p class="meta">Generated ${esc(new Date(data.generatedAt).toLocaleString())} from ${esc(data.repository)} GitHub Issues.${esc(modelNote)}${bookNote}</p>`
      + sections.join('');
  })
  .catch((error) => {
    document.getElementById('dashboard').textContent = `Dashboard data could not be loaded: ${error.message}`;
  });
