// Shared top navigation for the three repository report pages (#4976):
// PMO dashboard, Team queues and Scorecard. One list, used by every page, so
// the links cannot drift apart.

export const NAV_PLACEHOLDER = '<!--REPORT-NAV-->';

export const REPORT_PAGES = [
  { id: 'book', href: './', label: 'PMO dashboard' },
  { id: 'queues', href: './queues.html', label: 'Team queues' },
  { id: 'scorecard', href: './scorecard.html', label: 'Scorecard' },
];

export function renderReportNav(currentId) {
  const links = REPORT_PAGES.map((page) => {
    const current = page.id === currentId ? ' aria-current="page"' : '';
    return `<a href="${page.href}"${current}>${page.label}</a>`;
  });
  return `<nav class="page-nav" aria-label="Report pages">${links.join('')}</nav>`;
}

export function applyReportNav(html, currentId) {
  if (!html.includes(NAV_PLACEHOLDER)) {
    throw new Error(`Report page template for "${currentId}" is missing ${NAV_PLACEHOLDER}`);
  }
  return html.replace(NAV_PLACEHOLDER, renderReportNav(currentId));
}
