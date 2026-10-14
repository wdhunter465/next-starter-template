// GET/POST /api/admin/permission-exchanges
// Records permission correspondence Product Authority already sent or received.
// Does not send email. requireAdmin. #4526.

import { requireAdmin } from '../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../_lib/d1';
import {
  PermissionExchangeError,
  appendPermissionMessage,
  findOpenExchangeForSource,
  linkAssetToExchange,
  recordPermissionExchange,
} from '../../../_lib/permission-exchange-repository';

export const onRequestGet = async (context: any): Promise<Response> => {
  const deny = await requireAdmin(context.request, context.env);
  if (deny) return deny;
  const d1 = requireD1(context.env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);
  const domain = new URL(context.request.url).searchParams.get('source_domain')?.trim().toLowerCase() || '';
  if (!domain) return jsonResponse({ ok: false, error: 'source_domain is required' }, 400);
  const exchange = await findOpenExchangeForSource(d1.db, domain);
  return jsonResponse({ ok: true, exchange }, 200);
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const deny = await requireAdmin(context.request, context.env);
  if (deny) return deny;
  const d1 = requireD1(context.env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid JSON' }, 400);
  }
  try {
    if (body.action === 'message') {
      const id = await appendPermissionMessage(d1.db, {
        exchangeId: Number(body.exchange_id),
        direction: body.direction,
        sentOrReceivedAt: String(body.sent_or_received_at || ''),
        body: String(body.body || ''),
        subject: body.subject,
        sender: body.sender,
        recipientsTo: body.recipients_to,
        recipientsCc: body.recipients_cc,
        recipientsBcc: body.recipients_bcc,
        messageId: body.message_id,
        threadId: body.thread_id,
        inReplyTo: body.in_reply_to,
        attachmentB2Keys: body.attachment_b2_keys,
      });
      return jsonResponse({ ok: true, message_id: id }, 201);
    }
    if (body.action === 'link') {
      await linkAssetToExchange(d1.db, {
        exchangeId: Number(body.exchange_id),
        contentItemId: Number(body.content_item_id),
        rightsEvidenceId: body.rights_evidence_id == null ? undefined : Number(body.rights_evidence_id),
      });
      return jsonResponse({ ok: true }, 200);
    }
    const id = await recordPermissionExchange(d1.db, {
      sourceDomain: String(body.source_domain || ''),
      sourceName: body.source_name,
      rightsHolder: body.rights_holder,
      scopeRequested: String(body.scope_requested || ''),
      urlsListed: body.urls_listed,
      status: body.status,
      creditWording: body.credit_wording,
      conditionsText: body.conditions_text,
      reviewer: body.reviewer,
    });
    return jsonResponse({ ok: true, exchange_id: id }, 201);
  } catch (error) {
    if (error instanceof PermissionExchangeError) return jsonResponse({ ok: false, error: error.message }, 400);
    throw error;
  }
};
