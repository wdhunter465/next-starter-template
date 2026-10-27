function escapeHtml(value) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

export function renderDashboard({ rows, generatedAt, lookbackDays, note }) {
	const body =
		rows.length === 0
			? '<p>No advisories in this window.</p>'
			: `<table>
<thead>
<tr>
<th>Time</th>
<th>Response Issue #</th>
<th>Advisory type</th>
<th>PR / Issue</th>
<th>Summary</th>
<th>Link</th>
</tr>
</thead>
<tbody>
${rows
	.map((row) => {
		const response = row.responseIssue ? `#${row.responseIssue}` : '';
		const parent = `${row.parentKind} #${row.parentNumber}`;
		return `<tr>
<td>${escapeHtml(row.time)}</td>
<td>${escapeHtml(response)}</td>
<td>${escapeHtml(row.type)}</td>
<td>${escapeHtml(parent)}</td>
<td>${escapeHtml(row.summary)}</td>
<td><a href="${escapeHtml(row.url)}">Open</a></td>
</tr>`;
	})
	.join('\n')}
</tbody>
</table>`;

	const noteBlock = note ? `<p>${escapeHtml(note)}</p>` : '';

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Advisory notifications</title>
</head>
<body>
<h1>Advisory notifications</h1>
<p>Newest first. Lookback: ${lookbackDays} days. Generated ${escapeHtml(generatedAt)}.</p>
<p>For Engineering, Operations, PMO Admin, and Governance.</p>
${noteBlock}
${body}
</body>
</html>
`;
}
