-- #4526: permission correspondence archive. Retained forever (Product Authority, 2026-10-14).
-- Development first. Production apply needs an explicit Go and the privacy-page check.
-- Nothing here sends email. A person records messages Product Authority already sent or received.
--
-- content_items.permission_exchange_id and rights_evidence.exchange_id already exist (0084)
-- without a foreign key. SQLite cannot add a foreign key to an existing column without
-- rebuilding those tables. This migration indexes them. The repository refuses a link
-- when the exchange id does not exist.

CREATE TABLE IF NOT EXISTS permission_exchanges (
  id INTEGER PRIMARY KEY,
  source_domain TEXT NOT NULL,
  source_name TEXT,
  rights_holder TEXT,
  scope_requested TEXT NOT NULL,
  urls_listed TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'granted', 'denied', 'conditional', 'no_response', 'closed')),
  credit_wording TEXT,
  conditions_text TEXT,
  reviewer TEXT,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count >= 1),
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_permission_exchanges_source
  ON permission_exchanges(source_domain, created_at DESC);

CREATE TABLE IF NOT EXISTS permission_messages (
  id INTEGER PRIMARY KEY,
  exchange_id INTEGER NOT NULL REFERENCES permission_exchanges(id),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  sent_or_received_at TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  sender TEXT,
  recipients_to TEXT,
  recipients_cc TEXT,
  recipients_bcc TEXT,
  message_id TEXT,
  thread_id TEXT,
  in_reply_to TEXT,
  attachment_b2_keys TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_permission_messages_exchange
  ON permission_messages(exchange_id, sent_or_received_at);

CREATE INDEX IF NOT EXISTS idx_content_items_permission_exchange
  ON content_items(permission_exchange_id)
  WHERE permission_exchange_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rights_evidence_exchange
  ON rights_evidence(exchange_id)
  WHERE exchange_id IS NOT NULL;

-- Append-only. A stored message is the audit record and is never edited or removed.
CREATE TRIGGER IF NOT EXISTS trg_permission_messages_no_update
BEFORE UPDATE ON permission_messages
BEGIN
  SELECT RAISE(ABORT, 'permission messages are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_permission_messages_no_delete
BEFORE DELETE ON permission_messages
BEGIN
  SELECT RAISE(ABORT, 'permission messages are append-only');
END;
