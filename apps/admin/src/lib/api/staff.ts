import { staffListSchema, staffMemberSchema, staffRevokeResultSchema } from "@/lib/schemas/api";
import type { StaffChangeInput, StaffInviteInput } from "@/lib/schemas/forms";

import { request } from "./core";

/**
 * `/admin/staff` calls - all owner-only. The assignee directory, which every
 * role reads, is `adminApi.lookups.staffDirectory`.
 */
export const staffApi = {
  /** every account, active first, plus the active-owner count */
  list: () => request("/admin/staff", { schema: staffListSchema }),

  invite: (input: StaffInviteInput) =>
    request("/admin/staff", {
      method: "POST",
      body: { email: input.email, role: input.role, ...(input.name ? { name: input.name } : {}) },
      schema: staffMemberSchema,
    }),

  update: (id: string, change: StaffChangeInput) =>
    request(`/admin/staff/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: change,
      schema: staffMemberSchema,
    }),

  revokeSessions: (id: string) =>
    request(`/admin/staff/${encodeURIComponent(id)}/sessions`, {
      method: "DELETE",
      schema: staffRevokeResultSchema,
    }),
};
