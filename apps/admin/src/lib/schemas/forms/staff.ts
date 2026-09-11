import { z } from "zod";

import { adminRoleSchema } from "../api";

/**
 * Staff invite and change input, shared by the form or control that collects
 * it and the route handler that receives it.
 *
 * The name limit mirrors `STAFF_NAME_MAX` in the API's staff.plan.ts. It is not
 * in @inkhaus/shared yet, which is the one place a limit should live - moving it
 * there is a Phase 2 change to a frozen package.
 */
export const STAFF_NAME_MAX = 120;

/**
 * The sentence the API refuses self-revocation with, so the disabled button's
 * tooltip and a hand-made request's 400 say the same thing.
 */
export const staffRevokeSelfMessage = "You cannot end your own sessions here — use Sign out.";

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
