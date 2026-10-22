-- #4593: record whether permission evidence carries a condition, and treat any
-- condition as a denial. Credit or attribution wording is not a condition;
-- that stays in usage_basis = 'free_use_credit'. The person recording the
-- evidence decides which field the wording belongs in. No backfill.

ALTER TABLE rights_evidence ADD COLUMN has_conditions INTEGER NOT NULL DEFAULT 0
  CHECK (has_conditions IN (0, 1));
ALTER TABLE rights_evidence ADD COLUMN conditions_text TEXT;

-- A condition (territory, duration, usage limit, or similar) is a denial.
CREATE TRIGGER IF NOT EXISTS trg_rights_evidence_has_conditions_insert
BEFORE INSERT ON rights_evidence
WHEN NEW.has_conditions = 1 AND NEW.usage_decision <> 'deny'
BEGIN
  SELECT RAISE(ABORT, 'conditional evidence must have usage_decision deny');
END;

CREATE TRIGGER IF NOT EXISTS trg_rights_evidence_has_conditions_update
BEFORE UPDATE ON rights_evidence
WHEN NEW.has_conditions = 1 AND NEW.usage_decision <> 'deny'
BEGIN
  SELECT RAISE(ABORT, 'conditional evidence must have usage_decision deny');
END;

-- Conditional evidence cannot support final_status = 'permitted'.
CREATE TRIGGER IF NOT EXISTS trg_content_items_conditions_block_permitted_insert
BEFORE INSERT ON content_items
WHEN NEW.final_status = 'permitted' AND EXISTS (
  SELECT 1 FROM rights_evidence
  WHERE content_item_id = NEW.id AND has_conditions = 1
)
BEGIN
  SELECT RAISE(ABORT, 'conditional evidence cannot support final_status permitted');
END;

CREATE TRIGGER IF NOT EXISTS trg_content_items_conditions_block_permitted_update
BEFORE UPDATE ON content_items
WHEN NEW.final_status = 'permitted' AND EXISTS (
  SELECT 1 FROM rights_evidence
  WHERE content_item_id = NEW.id AND has_conditions = 1
)
BEGIN
  SELECT RAISE(ABORT, 'conditional evidence cannot support final_status permitted');
END;

CREATE TRIGGER IF NOT EXISTS trg_rights_evidence_conditions_block_permitted_insert
BEFORE INSERT ON rights_evidence
WHEN NEW.has_conditions = 1 AND EXISTS (
  SELECT 1 FROM content_items
  WHERE id = NEW.content_item_id AND final_status = 'permitted'
)
BEGIN
  SELECT RAISE(ABORT, 'conditional evidence cannot support final_status permitted');
END;

CREATE TRIGGER IF NOT EXISTS trg_rights_evidence_conditions_block_permitted_update
BEFORE UPDATE ON rights_evidence
WHEN NEW.has_conditions = 1 AND EXISTS (
  SELECT 1 FROM content_items
  WHERE id = NEW.content_item_id AND final_status = 'permitted'
)
BEGIN
  SELECT RAISE(ABORT, 'conditional evidence cannot support final_status permitted');
END;
