-- 0096_email_verification_5112.sql
-- #5112: verify a new member's email address with a single-use link before they can sign in.
--
-- Product Authority direction (2026-11-06): joining must not drop the new member into the member
-- area. They are sent to a check-your-email page; the emailed link verifies the address, signs them
-- in, and shows a welcome page before the member area.
--
--   members.email_verified_at   NULL = the address has not been verified; set when the link is used.
--   email_verification_tokens   one row per emailed link. Only the SHA-256 of the token is stored.
--                               A token works once and expires (expires_at, 24 hours after it is issued).
--
-- Every member that exists when this migration runs is marked verified (their email_verified_at is
-- their created_at), so no existing member is locked out. Members who joined before this change
-- were never asked to verify; only members who join after it are.
--
-- Reverse this migration with:
--   DROP TABLE email_verification_tokens;
--   (the members.email_verified_at column stays; SQLite cannot drop a column without a rebuild)

ALTER TABLE members ADD COLUMN email_verified_at TEXT;

-- A join request with no member row (login created the row on first sign-in) becomes a member row first.
INSERT OR IGNORE INTO members (email, role)
SELECT lower(email), 'member' FROM join_requests WHERE COALESCE(TRIM(email), '') != '';

UPDATE members SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_email
  ON email_verification_tokens (email, created_at);
