-- 0063_chatterbox_participant_auth.sql
-- #3794 (Chatterbox self-hosted room-actor design): per-participant
-- credential binding, fixing Jules's #3579 JULES-1 finding (every endpoint
-- trusted a caller-asserted participant_key under one shared admin token,
-- with no binding between the authenticated credential and the identity it
-- acts as).
--
-- credential_hash stores a SHA-256 hex digest of a per-participant bearer
-- token, never the token itself. A participant with no credential_hash has
-- no direct credential yet and can only be acted for through the separately
-- scoped bridge-relay path (functions/_lib/chatterbox-auth.ts) — this is a
-- deliberately safer default than every route sharing one token, not a new
-- gap: the bridge relay's self-declared trust model already exists and is
-- unchanged by this migration.
--
-- Development-only for this package, same precedent as 0050 and 0062.

PRAGMA foreign_keys = ON;

ALTER TABLE chatterbox_participants ADD COLUMN credential_hash TEXT;

-- Two participants must never share a credential; NULL (no credential yet)
-- is exempt so existing/relay-only participants are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chatterbox_participants_credential_hash
  ON chatterbox_participants(credential_hash)
  WHERE credential_hash IS NOT NULL;
