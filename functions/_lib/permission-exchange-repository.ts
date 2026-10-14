// #4526: D1 archive of permission correspondence. Retained forever.
// Messages are append-only. This module never sends email.

export const PERMISSION_EXCHANGE_STATUSES = [
  'requested',
  'granted',
  'denied',
  'conditional',
  'no_response',
  'closed',
] as const;

export type PermissionExchangeStatus = (typeof PERMISSION_EXCHANGE_STATUSES)[number];

export class PermissionExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionExchangeError';
  }
}

export function assertExchangeStatus(status: string): PermissionExchangeStatus {
  if (!(PERMISSION_EXCHANGE_STATUSES as readonly string[]).includes(status)) {
    throw new PermissionExchangeError(`status must be one of ${PERMISSION_EXCHANGE_STATUSES.join(', ')}`);
  }
  return status as PermissionExchangeStatus;
}

type ExchangeInput = {
  sourceDomain: string;
  sourceName?: string;
  rightsHolder?: string;
  scopeRequested: string;
  urlsListed?: string[];
  status?: PermissionExchangeStatus;
  creditWording?: string;
  conditionsText?: string;
  reviewer?: string;
};

export async function findOpenExchangeForSource(db: any, sourceDomain: string): Promise<{ id: number; status: string } | null> {
  const row = await db
    .prepare(
      `SELECT id, status FROM permission_exchanges
       WHERE source_domain = ? AND status NOT IN ('closed')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(sourceDomain)
    .first();
  return row ? { id: Number(row.id), status: String(row.status) } : null;
}

export async function recordPermissionExchange(db: any, input: ExchangeInput): Promise<number> {
  const domain = input.sourceDomain.trim().toLowerCase();
  if (!domain) throw new PermissionExchangeError('source_domain is required');
  if (!input.scopeRequested.trim()) throw new PermissionExchangeError('scope_requested is required');
  const existing = await findOpenExchangeForSource(db, domain);
  if (existing) {
    throw new PermissionExchangeError(
      `source ${domain} already has exchange ${existing.id} (${existing.status}); link the new asset to it instead of starting another request`,
    );
  }
  const status = input.status ?? 'requested';
  assertExchangeStatus(status);
  const result = await db
    .prepare(
      `INSERT INTO permission_exchanges (
        source_domain, source_name, rights_holder, scope_requested, urls_listed,
        status, credit_wording, conditions_text, reviewer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      domain,
      input.sourceName ?? null,
      input.rightsHolder ?? null,
      input.scopeRequested.trim(),
      JSON.stringify(input.urlsListed ?? []),
      status,
      input.creditWording ?? null,
      input.conditionsText ?? null,
      input.reviewer ?? null,
    )
    .run();
  return Number(result.meta?.last_row_id ?? result.meta?.lastRowId);
}

export async function appendPermissionMessage(
  db: any,
  input: {
    exchangeId: number;
    direction: 'outbound' | 'inbound';
    sentOrReceivedAt: string;
    body: string;
    subject?: string;
    sender?: string;
    recipientsTo?: string;
    recipientsCc?: string;
    recipientsBcc?: string;
    messageId?: string;
    threadId?: string;
    inReplyTo?: string;
    attachmentB2Keys?: string[];
  },
): Promise<number> {
  if (input.direction !== 'outbound' && input.direction !== 'inbound') {
    throw new PermissionExchangeError('direction must be outbound or inbound');
  }
  if (!input.body.trim()) throw new PermissionExchangeError('body is required');
  const exchange = await db.prepare('SELECT id FROM permission_exchanges WHERE id = ?').bind(input.exchangeId).first();
  if (!exchange) throw new PermissionExchangeError(`exchange ${input.exchangeId} does not exist`);
  const result = await db
    .prepare(
      `INSERT INTO permission_messages (
        exchange_id, direction, sent_or_received_at, subject, body, sender,
        recipients_to, recipients_cc, recipients_bcc, message_id, thread_id,
        in_reply_to, attachment_b2_keys
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.exchangeId,
      input.direction,
      input.sentOrReceivedAt,
      input.subject ?? null,
      input.body,
      input.sender ?? null,
      input.recipientsTo ?? null,
      input.recipientsCc ?? null,
      input.recipientsBcc ?? null,
      input.messageId ?? null,
      input.threadId ?? null,
      input.inReplyTo ?? null,
      JSON.stringify(input.attachmentB2Keys ?? []),
    )
    .run();
  return Number(result.meta?.last_row_id ?? result.meta?.lastRowId);
}

export async function linkAssetToExchange(
  db: any,
  input: { exchangeId: number; contentItemId: number; rightsEvidenceId?: number },
): Promise<void> {
  const exchange = await db.prepare('SELECT id FROM permission_exchanges WHERE id = ?').bind(input.exchangeId).first();
  if (!exchange) throw new PermissionExchangeError(`exchange ${input.exchangeId} does not exist`);
  const item = await db.prepare('UPDATE content_items SET permission_exchange_id = ? WHERE id = ?').bind(input.exchangeId, input.contentItemId).run();
  if (Number(item.meta?.changes ?? 0) !== 1) {
    throw new PermissionExchangeError(`content item ${input.contentItemId} does not exist`);
  }
  if (input.rightsEvidenceId != null) {
    const evidence = await db
      .prepare('UPDATE rights_evidence SET exchange_id = ? WHERE id = ? AND content_item_id = ?')
      .bind(input.exchangeId, input.rightsEvidenceId, input.contentItemId)
      .run();
    if (Number(evidence.meta?.changes ?? 0) !== 1) {
      throw new PermissionExchangeError(`rights evidence ${input.rightsEvidenceId} does not belong to content item ${input.contentItemId}`);
    }
  }
}
