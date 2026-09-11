import {
  QUOTE_ASSIGNEE_KEYWORDS,
  QUOTE_FOLLOW_UP_FILTERS,
  QUOTE_SORTS,
} from "@inkhaus/shared/orders";
import { z } from "zod";

import type { Params } from "@/lib/url";

import { quoteStatusSchema } from "../api";
import { DEFAULT_PAGE_SIZE, limitParam, pageParam, searchParam } from "./common";

/**
 * A quote id as it arrives in a URL segment. Ids are cuids; anything else
 * cannot name a quote, so a page answers 404 and a route handler 400 without
 * asking the API.
 */
export const quoteIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);

/**
 * `/quotes`. Every field ends in its own `.catch()`: an unknown status or sort
 * is dropped, a junk page falls back to 1.
 *
 * `sort` stays undefined unless the URL sets it (the API's default is newest
 * first), so the links this page builds do not all grow a `sort=` for nothing.
 */
const quotesQueryShape = z.object({
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

/** the outer `.catch()` covers input that is not an object, so `.parse()` cannot throw */
export const quotesQuerySchema = quotesQueryShape.catch(() => quotesQueryShape.parse({}));

export type QuotesQuery = z.infer<typeof quotesQuerySchema>;

/**
 * The parsed params as the list's own links carry them, the default page size
 * left out: a status chip reads `/quotes?status=NEW`, not
 * `/quotes?status=NEW&limit=20`. Parsing either gives the same params back.
 */
export function quotesLinkParams(params: QuotesQuery): Params {
  return { ...params, limit: params.limit === DEFAULT_PAGE_SIZE ? undefined : params.limit };
}
