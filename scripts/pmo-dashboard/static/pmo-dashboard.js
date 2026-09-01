const views = [
  ['activePrograms', 'Active Programs'],
  ['pmoPipeline', 'PMO Pipeline'],
  ['completedPrograms', 'Completed Programs'],
  ['incomplete', 'Data-quality exceptions']
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
const incompleteColumns = [
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
const pctTitle = (row) => {
  const taskCount = Number(row.taskCount);
  const tasksCompleted = Number(row.tasksCompleted);
  if (typeof row.percentComplete === 'number' && Number.isFinite(row.percentComplete) && Number.isFinite(taskCount) && taskCount > 0) {
    const completed = Number.isFinite(tasksCompleted) ? tasksCompleted : 0;
    return `${row.percentComplete}% complete (${completed} of ${taskCount} valid linked pmo:task Issues)`;
  }
  return 'No valid linked pmo:task Issues counted for this parent (missing parent reference, incomplete metadata, or none linked). percentComplete is null when taskCount is 0. See data-quality exceptions and docs/how-to/pmo/pmo-dashboard.md.';
};
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

function portfolioRowHtml(row, isChild = false) {
  const prefix = isChild ? '↳ ' : '';
  const childClass = isChild ? ' child-row' : '';
  const priority = row.priorityDisplay || row.priority || '';
  return `<tr class="${childClass.trim()}"><td><span class="row-prefix">${esc(prefix)}</span><a href="${issueHref(row.issueUrl)}">${esc(row.name || row.title || 'Unnamed PMO item')}</a><br><span class="pill">${esc(row.type || row.lifecycle || 'item')}</span></td><td><a href="${issueHref(row.issueUrl)}">#${esc(fmt(row.issueNumber))}</a></td><td>${esc(fmt(priority))}</td><td>${esc(fmt(row.status))}</td><td title="${esc(pctTitle(row))}">${esc(pct(row.percentComplete))}</td><td title="Count of valid linked pmo:task Issues">${esc(fmt(row.taskCount, '0'))}</td><td title="Valid linked pmo:task Issues with pmo:closed">${esc(fmt(row.tasksCompleted, '0'))}</td><td>${esc(fmt(row.ownerAgent, 'Pending Assignment'))}</td><td>${esc(fmt(row.description, ''))}</td><td>${esc(fmt(row.anticipatedCompletionDate, '—'))}</td></tr>`;
}

function incompleteRowHtml(row) {
  return `<tr><td><a href="${issueHref(row.issueUrl)}">${esc(row.name || row.title || 'Unnamed PMO item')}</a><br><span class="pill">${esc(row.type || 'data-quality')}</span></td><td><a href="${issueHref(row.issueUrl)}">#${esc(fmt(row.issueNumber))}</a></td><td>${formatList(row.labels)}</td><td>${formatList(row.dataQualityErrors)}</td><td>${formatList(row.requiredRemediation)}</td><td>${formatDate(row.updatedAt)}</td></tr>`;
}

function rowsHtml(row, viewKey) {
  if (viewKey === 'incomplete') return incompleteRowHtml(row);
  const parts = [portfolioRowHtml(row, false)];
  for (const child of row.children || []) parts.push(portfolioRowHtml(child, true));
  return parts.join('');
}

function sectionNote(viewKey, rows) {
  if (viewKey === 'incomplete') {
    return rows.length
      ? '<p class="note"><strong>Not a portfolio lifecycle.</strong> Active, Pipeline, and Completed are the only PMO portfolio sections. This list is an administrative data-quality exception surface. Rows here are excluded from parent task rollups until metadata is corrected. Prefer <code>node scripts/pmo-dashboard/reconcile-task-child-labels.mjs</code> (dry-run, then <code>--apply</code>) for label/lifecycle defects; parent references must still be fixed on the Issue.</p>'
      : '';
  }
  const zeroTaskParents = rows.filter((row) => !(Number(row.taskCount) > 0)).length;
  if (!rows.length || !zeroTaskParents) return '';
  return `<p class="note">${zeroTaskParents} of ${rows.length} row(s) show <strong>N/A / 0 / 0</strong> for % Complete / # of Tasks / # of Tasks Completed because they have no valid linked <code>pmo:task</code> Issues (or linked tasks remain in the data-quality exception list). Expected until child Issues carry <code>pmo:task</code>, a parent reference, and a single lifecycle label.</p>`;
}

fetch('dashboard-data.json')
  .then((response) => response.json())
  .then((data) => {
    const modelNote = data.contractVersion === 'pmo-july-2026'
      ? ' PMO July 2026 contract.'
      : (data.trackingModel === 'pmo-label' ? ' PMO-label tracking.' : '');
    document.getElementById('dashboard').innerHTML = `<p class="meta">Generated ${esc(new Date(data.generatedAt).toLocaleString())} from ${esc(data.repository)} GitHub Issues.${esc(modelNote)}</p>`
      + views.map(([key, title]) => {
        const rows = data.views?.[key] || [];
        const columns = key === 'incomplete' ? incompleteColumns : portfolioColumns;
        return `<section><h2>${esc(title)}</h2>${sectionNote(key, rows)}${rows.length
          ? `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => rowsHtml(row, key)).join('')}</tbody></table></div>`
          : `<p class="empty">No ${esc(title.toLowerCase())} rows are currently available.</p>`}</section>`;
      }).join('');
  })
  .catch((error) => {
    document.getElementById('dashboard').textContent = `Dashboard data could not be loaded: ${error.message}`;
  });
