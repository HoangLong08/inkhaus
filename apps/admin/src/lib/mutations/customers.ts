import "server-only";

import { adminApi, type CustomerDetail } from "@/lib/api";
import { HttpError } from "@/lib/api-guard";
import type { CustomerEditInput } from "@/lib/schemas/forms";

/**
 * A customer edit. `customers.edit`, checked by the route handler, is the whole
 * permission - no field is kept to one role. What is decided here is what an
 * edit may carry: the four fields of `customerEditInputSchema` and nothing else.
 * Email is the customer's identity - orders, designs, quotes and storefront
 * sign-in all hang off it - so the schema refuses it and the API refuses it
 * again.
 *
 * Only the fields the dialog actually changed are forwarded, and an edit that
 * names none is refused rather than sent upstream as a round trip that does
 * nothing.
 */
export async function applyCustomerEdit(
  id: string,
  input: CustomerEditInput,
): Promise<CustomerDetail> {
  const changed = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as CustomerEditInput;

  if (Object.keys(changed).length === 0) {
    throw new HttpError(400, "There is nothing to change.");
  }
  return adminApi.customers.update(id, changed);
}
