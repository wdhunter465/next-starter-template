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
  'Anticipated Completion Date',
  'Data quality'
];
const exceptionColumns = [
  'Program / Project Name',
  'Issue #',
  'Labels',
  'Data-quality errors',
  'Required remediation',
  'Last updated'
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
const formatList = (values) => (Array.isArray(values) && values.length ? values.map((value) => esc(value)).join('<br>') : '—');
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : esc(date.toLocaleString());
};

function dataQualityHtml(row) {
  const errors = Array.isArray(row.dataQualityErrors) ? row.dataQualityErrors : [];
  const linked = Array.isArray(row.linkedTaskDataQuality) ? row.linkedTaskDataQuality : [];
  if (!errors.length && !linked.length) return '—';
  const parts = [];
  if (errors.length) {
    parts.push(`<span class="pill pill-warn">Metadata defect</span><div class="dq">${formatList(errors)}</div>`);
  }
  for (const task of linked) {
    const href = issueHref(task.issueUrl);
    parts.push(
      `<div class="dq dq-linked"><a href="${href}">Linked task #${esc(fmt(task.issueNumber))}</a>: ${formatList(task.dataQualityErrors)}</div>`
    );
  }
  return parts.join('');
}

function portfolioRowHtml(row, isChild = false) {
  const prefix = isChild ? '↳ ' : '';
  const childClass = isChild ? ' child-row' : '';
  const priority = row.priorityDisplay || row.priority || '';
  return `<tr class="${childClass.trim()}"><td><span class="row-prefix">${esc(prefix)}</span><a href="${issueHref(row.issueUrl)}">${esc(row.name || row.title || 'Unnamed PMO item')}</a><br><span class="pill">${esc(row.type || row.lifecycle || 'item')}</span></td><td><a href="${issueHref(row.issueUrl)}">#${esc(fmt(row.issueNumber))}</a></td><td>${esc(fmt(priority))}</td><td>${esc(fmt(row.status))}</td><td>${esc(pct(row.percentComplete))}</td><td>${esc(fmt(row.taskCount, '0'))}</td><td>${esc(fmt(row.tasksCompleted, '0'))}</td><td>${esc(fmt(row.ownerAgent, 'Pending Assignment'))}</td><td>${esc(fmt(row.description, ''))}</td><td>${esc(fmt(row.anticipatedCompletionDate, '—'))}</td><td>${dataQualityHtml(row)}</td></tr>`;
}

function exceptionRowHtml(row) {
  return `<tr><td><a href="${issueHref(row.issueUrl)}">${esc(row.name || row.title || 'Unnamed PMO item')}</a><br><span class="pill pill-warn">${esc(row.type || row.role || 'metadata')}</span></td><td><a href="${issueHref(row.issueUrl)}">#${esc(fmt(row.issueNumber))}</a></td><td>${formatList(row.labels)}</td><td>${formatList(row.dataQualityErrors)}</td><td>${formatList(row.requiredRemediation)}</td><td>${formatDate(row.updatedAt)}</td></tr>`;
}

function rowsHtml(row) {
  const parts = [portfolioRowHtml(row, false)];
  for (const child of row.children || []) parts.push(portfolioRowHtml(child, true));
  return parts.join('');
}

fetch('dashboard-data.json')
  .then((response) => response.json())
  .then((data) => {
    const modelNote = data.contractVersion === 'pmo-july-2026'
      ? ' PMO July 2026 contract.'
      : (data.trackingModel === 'pmo-label' ? ' PMO-label tracking.' : '');
    const book = data.currentBook || {};
    const bookNote = Number.isInteger(book.parentStandaloneCount)
      ? ` Current book: ${esc(fmt(book.parentStandaloneCount))} open parent/standalone records (${esc(fmt(book.activeCount))} Active, ${esc(fmt(book.pipelineCount))} Pipeline).`
      : '';
    const sections = views.map(([key, title]) => {
      const rows = data.views?.[key] || [];
      return `<section><h2>${esc(title)}</h2>${rows.length
        ? `<div class="table-wrap"><table><thead><tr>${portfolioColumns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => rowsHtml(row)).join('')}</tbody></table></div>`
        : `<p class="empty">No ${esc(title.toLowerCase())} rows are currently available.</p>`}</section>`;
    });
    const exceptions = data.dataQualityExceptions || [];
    if (exceptions.length) {
      sections.push(
        `<section><h2>Metadata defects</h2><p class="meta">These records are not a PMO lifecycle. They could not be placed in the current Active + Pipeline book, or they are orphan tasks missing a parent reference.</p><div class="table-wrap"><table><thead><tr>${exceptionColumns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${exceptions.map((row) => exceptionRowHtml(row)).join('')}</tbody></table></div></section>`
      );
    }
    document.getElementById('dashboard').innerHTML = `<p class="meta">Generated ${esc(new Date(data.generatedAt).toLocaleString())} from ${esc(data.repository)} GitHub Issues.${esc(modelNote)}${bookNote}</p>`
      + sections.join('');
  })
  .catch((error) => {
    document.getElementById('dashboard').textContent = `Dashboard data could not be loaded: ${error.message}`;
  });
