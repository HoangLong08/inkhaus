import { staffListSchema, staffMemberSchema, staffRevokeResultSchema } from "@/lib/schemas/api";
import type { StaffChangeInput, StaffInviteInput } from "@/lib/schemas/forms";

import { call, json } from "./core";

/** browser calls for the staff screen, through /api/admin/staff */
export const staffClient = {
  list: () => call("/staff", staffListSchema),

  invite: (input: StaffInviteInput) => call("/staff", staffMemberSchema, json("POST", input)),

  update: (id: string, change: StaffChangeInput) =>
    call(`/staff/${encodeURIComponent(id)}`, staffMemberSchema, json("PATCH", change)),

  revokeSessions: (id: string) =>
    call(`/staff/${encodeURIComponent(id)}/sessions`, staffRevokeResultSchema, json("DELETE")),
};
