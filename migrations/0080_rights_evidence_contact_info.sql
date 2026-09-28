-- 0080_rights_evidence_contact_info.sql
-- #4405: purely additive -- no existing column or CHECK constraint is
-- altered. Free-text "how to reach the copyright owner about this item"
-- (an email, a profile/contact-page URL, or a note that no direct contact
-- exists), captured alongside the rest of a rights_evidence row so the
-- owner-contact worklist (functions/_lib/rights-evidence-repository.ts's
-- listOwnerContactWorklist) can show source, copyright status as stated,
-- and contact information together, per row.

PRAGMA foreign_keys = ON;

ALTER TABLE rights_evidence ADD COLUMN contact_info TEXT;
