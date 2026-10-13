// Publishing gate for content_inventory reads (#4569, child of #4523; builds on #4528).
//
// With the gate on, a published story is selected, rotated or shown only when its linked
// content_items records (content_items.content_inventory_id) that are active (not superseded, not
// deleted) are all final_status = 'permitted'. A story with no linked record, or with a linked
// record that is not_permitted or for_admin_review, is not shown. If active_content_items or its
// columns are missing, the gated query fails, so nothing is shown.
//
// Off by default. Turning it on in Production needs Product Authority's explicit Go on #4569:
// change CONTENT_PERMISSION_GATE_ENABLED below in its own PR.

import { isUsableOnWebsite } from './content-permission-status';

export const CONTENT_PERMISSION_GATE_ENABLED = false;

function inventoryIdRef(alias?: string): string {
  return alias ? `${alias}.id` : 'content_inventory.id';
}

/**
 * The story's effective final_status: NULL with no linked active record, otherwise 'permitted'
 * only if every linked active record is permitted, else one of the non-permitted statuses.
 */
export function effectiveFinalStatusSql(alias?: string): string {
  return `(SELECT CASE
       WHEN COUNT(*) = 0 THEN NULL
       WHEN SUM(CASE WHEN aci.final_status = 'permitted' THEN 0 ELSE 1 END) = 0 THEN 'permitted'
       ELSE MIN(CASE WHEN aci.final_status = 'permitted' THEN NULL ELSE aci.final_status END)
     END
     FROM active_content_items aci
     WHERE aci.content_inventory_id = ${inventoryIdRef(alias)} AND aci.deleted_at IS NULL)`;
}

export function buildPermissionGate(enabled: boolean) {
  return {
    /** SQL condition on a content_inventory row; empty string when the gate is off. */
    permissionGateWhere(alias?: string): string {
      return enabled ? `${effectiveFinalStatusSql(alias)} = 'permitted'` : '';
    },
    /** Extra select column carrying the story's effective final_status; empty string when off. */
    permissionStatusSelect(alias?: string): string {
      return enabled ? `, ${effectiveFinalStatusSql(alias)} AS permission_final_status` : '';
    },
    /** Second check at selection, on rows read with permissionStatusSelect. */
    passesPermissionGate(row: { permission_final_status?: unknown }): boolean {
      return !enabled || isUsableOnWebsite(row.permission_final_status as string | null | undefined);
    },
  };
}

export const { permissionGateWhere, permissionStatusSelect, passesPermissionGate } =
  buildPermissionGate(CONTENT_PERMISSION_GATE_ENABLED);
