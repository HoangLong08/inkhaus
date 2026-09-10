import { z } from "zod";

import { orderStatusSchema, quoteStatusSchema } from "./api";

/**
 * URL state, parsed once and then trusted.
 *
 * Every field ends in `.catch()`, which is what preserves the behaviour these
 * pages already had: a hand-typed `?status=lol` renders the unfiltered list
 * rather than throwing, because an unknown value would be a 400 from the API's
 * validation pipe and a 500 page is a poor answer to a typo. `.catch()` must be
 * outermost or it never sees the failure it is there to absorb.
 *
 * Consequence worth knowing: neither schema below can throw, so pages call
 * `.parse()` with no try/catch. Next can also hand a repeated key over as a
 * string[]; that fails the inner check and lands on the fallback too.
 *
 * The BFF route handlers parse the same shapes off their own query string, so a
 * hand-made client request is normalised identically instead of 400ing.
 */

export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  status: orderStatusSchema.optional().catch(undefined),
  email: z.string().trim().min(1).max(200).optional().catch(undefined),
});

export const quotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  status: quoteStatusSchema.optional().catch(undefined),
});

export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
export type QuotesQuery = z.infer<typeof quotesQuerySchema>;
