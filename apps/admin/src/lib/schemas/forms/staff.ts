import { STAFF_NAME_MAX, STAFF_REVOKE_SELF_MESSAGE } from "@inkhaus/shared/admin";
import { z } from "zod";

import { adminRoleSchema } from "../api";

/**
 * Staff invite and change input, shared by the form or control that collects
 * it and the route handler that receives it.
 *
 * The name limit and the self-revocation sentence are the shared constants the
 * API validates and refuses with. They are re-exported here under the names
 * the staff screen already imports, not copied.
 */
export { STAFF_NAME_MAX };

/**
 * The sentence the API refuses self-revocation with, so the disabled button's
 * tooltip and a hand-made request's 400 say the same thing.
 */
export const staffRevokeSelfMessage = STAFF_REVOKE_SELF_MESSAGE;

const nameField = z
  .string()
  .trim()
  .max(STAFF_NAME_MAX, `Keep the name to ${STAFF_NAME_MAX} characters or fewer.`);

export const staffInviteInputSchema = z.object({
  // Trimmed and lower-cased before the format check, which is exactly how the
  // API stores it and how sign-in compares it - "Jo@Example.com " is the same
  // person as "jo@example.com", and a row stored any other way is one nobody
  // could ever sign in as.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter the full Google account address, like name@example.com.")),
  name: nameField.optional(),
  role: z.enum(adminRoleSchema.options, { message: "Pick a role." }),
});

export type StaffInviteInput = z.infer<typeof staffInviteInputSchema>;

/** `PATCH /api/admin/staff/:id` - a field left out is left alone */
export const staffChangeInputSchema = z
  .object({
    name: nameField.nullable().optional(),
    role: adminRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (change) =>
      change.name !== undefined || change.role !== undefined || change.isActive !== undefined,
    { message: "Nothing to change." },
  );

export type StaffChangeInput = z.infer<typeof staffChangeInputSchema>;

/** a staff id as it arrives in a route segment: an opaque database id, never a path */
export const staffIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "That is not a staff account id.");
