import { CUSTOMER_NOTE_MAX } from "@inkhaus/shared/admin";
import { z } from "zod";

/**
 * The limits the API's UpdateCustomerDto validates with. The note's is shared;
 * the other three exist only in that DTO, so they are mirrored here by hand.
 */
export const CUSTOMER_NAME_MAX = 120;
export const CUSTOMER_PHONE_MAX = 40;
export const CUSTOMER_COMPANY_MAX = 120;

const text = (max: number, what: string) =>
  z.string().trim().max(max, `Keep the ${what} to ${max} characters or fewer.`);

/**
 * A customer edit, shared by the dialog that collects it and the route handler
 * that receives it. Every field is optional because the dialog sends only the
 * ones that changed - two people editing different fields of the same customer
 * must not undo each other. An empty string clears a field; the API stores it
 * as null.
 *
 * Strict, so a body that tries to carry `email` is a 400 here rather than a key
 * silently dropped: email is the customer's identity and is not editable.
 */
export const customerEditInputSchema = z.strictObject({
  name: text(CUSTOMER_NAME_MAX, "name").optional(),
  phone: text(CUSTOMER_PHONE_MAX, "phone number").optional(),
  company: text(CUSTOMER_COMPANY_MAX, "company").optional(),
  adminNote: text(CUSTOMER_NOTE_MAX, "note").optional(),
});

export type CustomerEditInput = z.infer<typeof customerEditInputSchema>;
