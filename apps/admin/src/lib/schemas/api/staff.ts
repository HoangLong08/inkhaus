import { z } from "zod";

import { adminRoleSchema } from "./core";

/**
 * `/admin/staff` response shapes. The assignee directory
 * (`staffDirectorySchema`) lives in `lookups.ts`: every role reads that one,
 * while everything here is owner-only.
 */

export const staffMemberSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: adminRoleSchema,
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  deactivatedAt: z.string().nullable(),
  /** null for the seed's bootstrap owners */
  invitedBy: z
    .object({ id: z.string(), name: z.string().nullable(), email: z.string() })
    .nullable(),
  /** unexpired sessions - the devices a deactivation would sign out */
  activeSessions: z.number().int(),
  /** the row of whoever is looking - the one they may not demote or deactivate */
  isSelf: z.boolean(),
});

/** `GET /admin/staff` - every account, and the count `staffChangeError` needs */
export const staffListSchema = z.object({
  data: z.array(staffMemberSchema),
  activeOwners: z.number().int(),
});

/** `DELETE /admin/staff/:id/sessions` */
export const staffRevokeResultSchema = z.object({ revoked: z.number().int() });

export type StaffMember = z.infer<typeof staffMemberSchema>;
export type StaffList = z.infer<typeof staffListSchema>;
export type StaffRevokeResult = z.infer<typeof staffRevokeResultSchema>;
