import "server-only";

import { staffChangeError, type StaffChangeErrorCode } from "@inkhaus/shared/admin";

import { adminApi, type AdminUser, type StaffMember, type StaffRevokeResult } from "@/lib/api";
import { HttpError } from "@/lib/api-guard";
import {
  staffRevokeSelfMessage,
  type StaffChangeInput,
  type StaffInviteInput,
} from "@/lib/schemas/forms";

/**
 * Staff writes with their authorization attached. The route handlers have
 * already checked `staff.manage`; what is left is the value-level rule no
 * route-level capability can express - who may change whom, and into what.
 *
 * The staff screen disables the controls `staffChangeError` refuses, so
 * reaching a refusal here means the request was hand-made or the screen was
 * stale. Refusing before the round trip gives that request the API's own
 * sentence with the API's own status. The API checks again inside a
 * Serializable transaction, and that is the check that actually protects the
 * table; this one reads a list that may be a moment old.
 */

/** mirrors the API: your own mistake, a conflict with the office's state, a permission */
const REFUSAL_STATUS: Record<StaffChangeErrorCode, number> = {
  SELF: 400,
  LAST_OWNER: 409,
  NOT_OWNER: 403,
};

export async function applyStaffInvite(input: StaffInviteInput): Promise<StaffMember> {
  // No value-level rule: an owner may invite either role, and the API answers
  // 409 for an address already on the list.
  return adminApi.staff.invite(input);
}

export async function applyStaffChange(
  user: AdminUser,
  id: string,
  change: StaffChangeInput,
): Promise<StaffMember> {
  // The whole list, because the rule needs the active-owner count as well as
  // the target. It is owner-only (`staff.view`) - the same people who hold
  // `staff.manage` - so whoever got past the route handler can read it.
  const { data, activeOwners } = await adminApi.staff.list();
  const target = data.find((member) => member.id === id);
  if (!target) throw new HttpError(404, "That staff account does not exist.");

  const refusal = staffChangeError(user, target, change, activeOwners);
  if (refusal) throw new HttpError(REFUSAL_STATUS[refusal.code], refusal.message);

  return adminApi.staff.update(id, change);
}

export async function applyStaffRevoke(user: AdminUser, id: string): Promise<StaffRevokeResult> {
  // Ending your own sessions from here would sign you out mid-request; the
  // sidebar's Sign out is the way to do that, and it asks first.
  if (id === user.id) throw new HttpError(400, staffRevokeSelfMessage);
  return adminApi.staff.revokeSessions(id);
}
