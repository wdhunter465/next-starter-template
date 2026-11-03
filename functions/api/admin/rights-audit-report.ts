// GET /api/admin/rights-audit-report?domain=loc.gov&as_of=2026-11-03&format=csv|json
// Read-only, share-safe rights audit report (#5059). requireAdmin. Never writes to D1.

import { requireAdmin } from '../../_lib/auth';
import { jsonResponse, requireD1 } from '../../_lib/d1';
import {
  RIGHTS_AUDIT_COLUMNS,
  RightsAuditQueryError,
  buildRightsAuditReport,
  parseRightsAuditQuery,
  rightsAuditCsv,
  rightsAuditFilename,
} from '../../_lib/rights-audit-report';

const NO_STORE = 'private, no-store';

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const params = new URL(request.url).searchParams;
  const format = (params.get('format') || 'csv').trim().toLowerCase();
  if (format !== 'csv' && format !== 'json') {
    return jsonResponse({ ok: false, error: 'format must be csv or json' }, 400);
  }

  let query;
  try {
    query = parseRightsAuditQuery(params.get('domain'), params.get('as_of'));
  } catch (error) {
    if (error instanceof RightsAuditQueryError) return jsonResponse({ ok: false, error: error.message }, 400);
    throw error;
  }

  try {
    const report = await buildRightsAuditReport(d1.db, query);
    const filename = rightsAuditFilename(query, format);
    const headers = {
      'Cache-Control': NO_STORE,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Report-Truncated': report.truncated ? 'true' : 'false',
    };

    if (format === 'json') {
      return new Response(
        JSON.stringify({
          ok: true,
          domain: query.domain,
          as_of: query.asOf,
          generated_at: new Date().toISOString(),
          truncated: report.truncated,
          columns: RIGHTS_AUDIT_COLUMNS,
          rows: report.rows,
        }),
        { status: 200, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } },
      );
    }

    return new Response(rightsAuditCsv(report.rows), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
    });
  } catch (error) {
    console.error('rights audit report error:', error);
    return jsonResponse({ ok: false, error: 'Report failed.' }, 500);
  }
};
