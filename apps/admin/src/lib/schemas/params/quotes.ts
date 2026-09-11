import {
  QUOTE_ASSIGNEE_KEYWORDS,
  QUOTE_FOLLOW_UP_FILTERS,
  QUOTE_SORTS,
} from "@inkhaus/shared/orders";
import { z } from "zod";

import { quoteStatusSchema } from "../api";
import { limitParam, pageParam, searchParam } from "./common";

/**
 * A quote id as it arrives in a URL segment. Ids are cuids; anything else
 * cannot name a quote, so a page answers 404 and a route handler 400 without
 * asking the API.
 */
export const quoteIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);

/**
 * `/quotes`. Every field ends in its own `.catch()`, so `.parse()` cannot throw:
 * an unknown status or sort is dropped, a junk page falls back to 1.
 *
 * `sort` stays undefined unless the URL sets it (the API's default is newest
 * first), so the links this page builds do not all grow a `sort=` for nothing.
 */
export const quotesQuerySchema = z.object({
  q: searchParam,
  status: quoteStatusSchema.optional().catch(undefined),
  assignee: z
    .union([z.enum(QUOTE_ASSIGNEE_KEYWORDS), quoteIdSchema])
    .optional()
    .catch(undefined),
  followUp: z.enum(QUOTE_FOLLOW_UP_FILTERS).optional().catch(undefined),
  sort: z.enum(QUOTE_SORTS).optional().catch(undefined),
  page: pageParam,
  limit: limitParam,
});

export type QuotesQuery = z.infer<typeof quotesQuerySchema>;
