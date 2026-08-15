// Fail-closed publication transition checks for content_inventory writes.
// Encodes Program #2040 Task 006 checks A1–A7 plus S4/S9 on this write path.

export const PUBLICATION_CHECK_IDS = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "S4", "S9"] as const;

export type PublicationCheckId = (typeof PUBLICATION_CHECK_IDS)[number];

export const OPERATIONAL_STATES = [
  "draft",
  "staged",
  "reviewed",
  "approved",
  "scheduled",
  "published",
  "unpublished",
  "archived",
  "rejected",
] as const;

export type OperationalState = (typeof OPERATIONAL_STATES)[number];

export const INVENTORY_STATUSES = ["draft", "published", "archived"] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const PUBLICATION_ACTIONS = [
  "stage",
  "review",
  "reject",
  "approve",
  "publish",
  "unpublish",
  "archive",
  "return_to_draft",
  "rollback",
  "schedule",
  "pause_schedule",
  "cancel_schedule",
] as const;

export type PublicationAction = (typeof PUBLICATION_ACTIONS)[number];

export type ApprovalSnapshot = {
  approvedBy?: string | null;
  approvedAt?: string | null;
};

export type PublicationTransitionInput = {
  action: PublicationAction;
  currentInventoryStatus: InventoryStatus;
  operationalState: OperationalState;
  approvedBy?: string | null;
  approvedAt?: string | null;
  requestedApprovedBy?: string | null;
  requestedApprovedAt?: string | null;
  sourceName?: string | null;
  creditLine?: string | null;
  reason?: string | null;
  scheduledAt?: string | null;
  paused?: boolean;
  nowIso?: string;
  approvalSnapshot?: ApprovalSnapshot | null;
  rightsStatus?: string | null;
  privacyFlag?: string | null;
  requestedReviewer?: string | null;
};

export type PublicationTransitionSuccess = { ok: true };
export type PublicationTransitionFailure = {
  ok: false;
  checkId: PublicationCheckId;
  error: string;
};
export type PublicationTransitionResult = PublicationTransitionSuccess | PublicationTransitionFailure;

const FORBIDDEN_APPROVER_NAMES = new Set([
  "scheduler",
  "automation",
  "system",
  "bot",
  "ci",
  "cursor",
  "chatgpt",
]);

const ILLEGAL_PUBLISH_FROM = new Set<OperationalState>([
  "draft",
  "staged",
  "reviewed",
  "rejected",
  "unpublished",
  "archived",
]);

function fail(checkId: PublicationCheckId, error: string): PublicationTransitionFailure {
  return { ok: false, checkId, error };
}

function trim(value: unknown): string {
  return String(value ?? "").trim();
}

export function isInventoryStatus(value: unknown): value is InventoryStatus {
  return INVENTORY_STATUSES.includes(String(value || "") as InventoryStatus);
}

export function isPublicationAction(value: unknown): value is PublicationAction {
  return PUBLICATION_ACTIONS.includes(String(value || "") as PublicationAction);
}

export function isOperationalState(value: unknown): value is OperationalState {
  return OPERATIONAL_STATES.includes(String(value || "") as OperationalState);
}

export function inferPublicationAction(status: InventoryStatus): PublicationAction {
  if (status === "published") return "publish";
  if (status === "archived") return "archive";
  return "return_to_draft";
}

export function resolveOperationalState(
  inventoryStatus: InventoryStatus,
  storedOperationalState?: string | null,
): OperationalState {
  const stored = trim(storedOperationalState);
  if (isOperationalState(stored)) return stored;
  if (inventoryStatus === "published") return "published";
  if (inventoryStatus === "archived") return "unpublished";
  return "draft";
}

function hasNamedApproval(approvedBy?: string | null, approvedAt?: string | null): boolean {
  return trim(approvedBy).length > 0 && trim(approvedAt).length > 0;
}

function isForbiddenApprover(name: string): boolean {
  return FORBIDDEN_APPROVER_NAMES.has(name.toLowerCase());
}

function parseGateTimestamp(value: unknown): number | null {
  let dateStr = trim(value);
  if (!dateStr) return null;
  if (dateStr.length === 19 && !dateStr.includes("T")) {
    dateStr = `${dateStr.replace(" ", "T")}Z`;
  }
  const parsed = Date.parse(dateStr);
  return Number.isFinite(parsed) ? parsed : null;
}

function isExplicitUtcInstant(value: unknown): boolean {
  const dateStr = trim(value);
  if (!dateStr) return false;
  if (!/(Z|[+-]00:00)$/.test(dateStr)) return false;
  return parseGateTimestamp(dateStr) !== null;
}

export function evaluatePublicationTransition(
  input: PublicationTransitionInput,
): PublicationTransitionResult {
  const operationalState = input.operationalState;
  const action = input.action;
  const requestedApprover = trim(input.requestedApprovedBy);
  const requestedApprovedAt = trim(input.requestedApprovedAt);
  const reason = trim(input.reason);
  const sourceName = trim(input.sourceName);
  const creditLine = trim(input.creditLine);
  const rightsStatus = trim(input.rightsStatus);
  const privacyFlag = trim(input.privacyFlag);
  const requestedReviewer = trim(input.requestedReviewer);

  if (action === "stage") {
    if (operationalState !== "draft" && operationalState !== "reviewed") {
      return fail("A3", "A3: stage is only legal from draft or reviewed.");
    }
    return { ok: true };
  }

  if (action === "review") {
    if (operationalState !== "staged") {
      return fail("A3", "A3: review is only legal from staged.");
    }
    if (isForbiddenApprover(requestedReviewer)) {
      return fail("A5", "A5: automation must not write review or invent reviewer.");
    }
    if (!sourceName || !creditLine || !rightsStatus || rightsStatus === "unknown" || !privacyFlag) {
      return fail(
        "S4",
        "S4: reviewed requires source_name, credit_line, rights_status, and privacy_flag.",
      );
    }
    return { ok: true };
  }

  if (action === "reject") {
    if (operationalState !== "draft" && operationalState !== "staged" && operationalState !== "reviewed") {
      return fail("A3", "A3: reject from this slice is only legal from draft, staged, or reviewed.");
    }
    if (!reason) {
      return fail("S9", "S9: reject requires a recorded reason.");
    }
    return { ok: true };
  }

  if (action === "approve") {
    if (operationalState === "published") {
      return fail("A3", "A3: publish must be withdrawn before a new approval can be recorded.");
    }
    if (operationalState === "rejected") {
      return fail("A3", "A3: rejected records must return to draft before approval.");
    }
    if (!requestedApprover || !requestedApprovedAt) {
      return fail("A2", "A2: approved_by and approved_at are required to record approval.");
    }
    if (isForbiddenApprover(requestedApprover)) {
      return fail("A5", "A5: automation must not write approve or invent approved_by.");
    }
    return { ok: true };
  }

  if (action === "schedule") {
    if (operationalState !== "approved" && operationalState !== "scheduled") {
      return fail("A3", "A3: schedule is only legal from approved (or reschedule while scheduled).");
    }
    if (!hasNamedApproval(input.approvedBy, input.approvedAt)) {
      return fail("A2", "A2: approved_by and approved_at are required before schedule.");
    }
    if (isForbiddenApprover(trim(input.approvedBy))) {
      return fail("A5", "A5: automation must not write approve or invent approved_by.");
    }
    if (!isExplicitUtcInstant(input.scheduledAt)) {
      return fail("A4", "A4: scheduled_at must be an explicit UTC instant.");
    }
    if (!sourceName || !creditLine) {
      return fail("S4", "Published content_inventory records require source_name and credit_line.");
    }
    return { ok: true };
  }

  if (action === "pause_schedule") {
    if (operationalState !== "scheduled") {
      return fail("A3", "A3: pause is only legal while operational state is scheduled.");
    }
    if (!reason) {
      return fail("S9", "S9: pause requires a recorded reason.");
    }
    return { ok: true };
  }

  if (action === "cancel_schedule") {
    if (operationalState !== "scheduled") {
      return fail("A3", "A3: cancel schedule is only legal while operational state is scheduled.");
    }
    return { ok: true };
  }

  if (action === "rollback") {
    const snapshot = input.approvalSnapshot;
    const snapshotOk = hasNamedApproval(snapshot?.approvedBy, snapshot?.approvedAt);
    const newApprovalOk = hasNamedApproval(requestedApprover, requestedApprovedAt);
    if (!snapshotOk && !newApprovalOk) {
      return fail(
        "A7",
        "A7: rollback must not publish without an approval snapshot or a new approved_by / approved_at.",
      );
    }
    if (operationalState !== "unpublished" && operationalState !== "archived") {
      return fail("A3", "A3: rollback restore is only legal from unpublished or archived.");
    }
    const rollbackApprover = snapshotOk ? snapshot?.approvedBy : requestedApprover;
    if (isForbiddenApprover(trim(rollbackApprover))) {
      return fail("A5", "A5: automation must not write approve or invent approved_by.");
    }
    if (!sourceName || !creditLine) {
      return fail("S4", "Published content_inventory records require source_name and credit_line.");
    }
    return { ok: true };
  }

  if (action === "publish") {
    if (input.currentInventoryStatus === "published" && operationalState === "published") {
      return { ok: true };
    }

    if (operationalState === "unpublished" || operationalState === "archived") {
      return fail("A6", "A6: republish from unpublished requires a new approved step.");
    }

    if (ILLEGAL_PUBLISH_FROM.has(operationalState)) {
      return fail("A3", `A3: ${operationalState} → published is an illegal jump.`);
    }

    if (operationalState !== "approved" && operationalState !== "scheduled") {
      return fail(
        "A1",
        "A1: inventory status cannot become published unless operational state is approved or scheduled.",
      );
    }

    if (operationalState === "scheduled") {
      const fireAt = parseGateTimestamp(input.scheduledAt);
      const now = parseGateTimestamp(input.nowIso) ?? Date.now();
      if (fireAt === null || fireAt > now || input.paused === true) {
        return fail("A4", "A4: scheduler fire is refused before scheduled_at or while paused/held.");
      }
    }

    if (!hasNamedApproval(input.approvedBy, input.approvedAt)) {
      return fail("A2", "A2: approved_by and approved_at are required before publish.");
    }

    if (isForbiddenApprover(trim(input.approvedBy))) {
      return fail("A5", "A5: automation must not write approve or invent approved_by.");
    }

    if (!sourceName || !creditLine) {
      return fail("S4", "Published content_inventory records require source_name and credit_line.");
    }

    return { ok: true };
  }

  if (action === "unpublish" || action === "archive") {
    if (action === "unpublish" && input.currentInventoryStatus !== "published") {
      return fail("A3", "A3: unpublish is only legal from published.");
    }
    if (!reason) {
      return fail("S9", "S9: unpublish/archive requires a recorded reason.");
    }
    return { ok: true };
  }

  if (action === "return_to_draft") {
    if (input.currentInventoryStatus === "published" || operationalState === "published") {
      return fail("A3", "A3: published records must unpublish before returning to draft.");
    }
    return { ok: true };
  }

  return fail("A3", "A3: unsupported publication transition.");
}
