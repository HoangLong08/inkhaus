import type { AdminRole, Prisma } from '@prisma/client';

/**
 * What a staff change writes and what the log says about it, decided apart from
 * Prisma and HTTP so the rules read as rules. Whether a change is ALLOWED is
 * `staffChangeError`'s question (in @inkhaus/shared, so the staff screen can ask
 * it too); StaffService asks that first, then this, then writes.
 */

/** the API's limit on a display name; the admin's forms validate the same number */
export const STAFF_NAME_MAX = 120;

/** `admin_audit_logs.entity` for every staff entry */
export const STAFF_AUDIT_ENTITY = 'admin_user';

/**
 * The form sign-in compares against: AdminAuthService trims and lower-cases the
 * address Google sends, so a row stored any other way is one nobody can ever
 * sign in as.
 */
export function normalizeStaffEmail(email: string) {
  return email.trim().toLowerCase();
}

/** the parts of a staff row a change can touch */
export type StaffState = { name: string | null; role: AdminRole; isActive: boolean };

export type StaffChange = { name?: string | null; role?: AdminRole; isActive?: boolean };

export type StaffAuditAction = 'staff.update' | 'staff.deactivate' | 'staff.reactivate';

export type StaffPlan = {
  data: Prisma.AdminUserUpdateInput;
  action: StaffAuditAction;
  /** only a deactivation ends sessions, and in the same transaction as the flag */
  endSessions: boolean;
  /** just the fields that change, as they were and as they will be */
  before: Partial<StaffState>;
  after: Partial<StaffState>;
};

/**
 * What to write for `change` against `current`, or null when nothing would
 * change - a field sent with the value it already has is not a change, and
 * leaves no audit entry behind.
 *
 * - a blank name clears it; Google fills it in again on the next sign-in
 * - deactivating stamps `deactivatedAt` and ends every session; reactivating
 *   clears the stamp and has no sessions to touch
 * - one audit entry per request, named for its weightiest part: a request that
 *   demotes and deactivates is a deactivation
 */
export function planStaffChange(
  current: StaffState,
  change: StaffChange,
  now: Date,
): StaffPlan | null {
  const data: Prisma.AdminUserUpdateInput = {};
  const before: Partial<StaffState> = {};
  const after: Partial<StaffState> = {};

  if (change.name !== undefined) {
    const name = change.name?.trim() || null;
    if (name !== current.name) {
      before.name = current.name;
      after.name = name;
      data.name = name;
    }
  }

  if (change.role !== undefined && change.role !== current.role) {
    before.role = current.role;
    after.role = change.role;
    data.role = change.role;
  }

  if (change.isActive !== undefined && change.isActive !== current.isActive) {
    before.isActive = current.isActive;
    after.isActive = change.isActive;
    data.isActive = change.isActive;
    data.deactivatedAt = change.isActive ? null : now;
  }

  if (Object.keys(data).length === 0) return null;

  const action: StaffAuditAction =
    after.isActive === false
      ? 'staff.deactivate'
      : after.isActive === true
        ? 'staff.reactivate'
        : 'staff.update';

  return { data, action, endSessions: after.isActive === false, before, after };
}

/** the one line an audit entry carries, e.g. "Deactivated jo@inkhaus.test and ended 2 sessions" */
export function summarizeStaffChange(email: string, plan: StaffPlan, sessionsEnded = 0): string {
  const parts: string[] = [];
  if (plan.after.role !== undefined) {
    parts.push(`role ${String(plan.before.role).toLowerCase()} → ${plan.after.role.toLowerCase()}`);
  }
  if ('name' in plan.after) {
    parts.push(plan.after.name ? `name "${plan.after.name}"` : 'name cleared');
  }
  const detail = parts.length ? ` (${parts.join(', ')})` : '';

  switch (plan.action) {
    case 'staff.deactivate':
      return `Deactivated ${email}${detail} and ended ${plural(sessionsEnded, 'session')}`;
    case 'staff.reactivate':
      return `Reactivated ${email}${detail}`;
    default:
      return `Changed ${email}: ${parts.join(', ')}`;
  }
}

export function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
