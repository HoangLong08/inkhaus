import "server-only";

import { canSetStatus } from "@inkhaus/shared/orders";

import { adminApi, type AdminUser, type BulkQuote, type Order } from "./api";
import { HttpError } from "./api-guard";
import type { OrderStatusInput, QuoteStatusInput } from "./schemas/forms";

/**
 * Every write the back office can make, with its authorization attached.
 *
 * These live apart from the route handlers that call them so the rule and the
 * transport are not the same file. Anything that ever needs a second way in - a
 * server action, a CLI, a webhook - calls this rather than reimplementing the
 * check, which is how the UI's dropdown and the server's refusal stay the same
 * decision rather than two that happen to agree today.
 */

/**
 * Cancelling or refunding is a money decision, not a production step. The order
 * detail page already hides these from staff, so reaching here as staff means
 * the request was hand-made; refuse before the round trip. The API refuses too -
 * that is the check that actually protects the data, and this one exists so a
 * forged request gets a clear 403 instead of a confusing upstream error.
 */
export async function applyOrderStatus(
  user: AdminUser,
  number: string,
  input: OrderStatusInput,
): Promise<Order> {
  if (!canSetStatus(user.role, input.status)) {
    throw new HttpError(403, `Only an owner can move an order to ${input.status}.`);
  }
  return adminApi.setOrderStatus(number, input.status, input.note || undefined);
}

/** No role rule: triaging a quote is not a money decision and never was. */
export async function applyQuoteStatus(
  id: string,
  input: QuoteStatusInput,
): Promise<BulkQuote> {
  return adminApi.setQuoteStatus(id, input.status);
}
