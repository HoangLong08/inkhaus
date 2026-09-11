import { ORDER_SORTS, type OrderSort } from "@inkhaus/shared/orders";
import { z } from "zod";

import type { Params } from "@/lib/url";

import { orderStatusSchema } from "../api";
import { DEFAULT_PAGE_SIZE, isoDayParam, limitParam, pageParam, searchParam } from "./common";

/** newest placed first, drafts last - what `/orders` shows before anyone clicks a header */
export const DEFAULT_ORDER_SORT: OrderSort = "placed_desc";

/**
 * `/orders` used to filter on `?email=`, and the API validated it with
 * `@IsEmail` - so every keystroke of a half-typed address was a 400 and a
 * segment error. `q` is free text the API matches against the order number,
 * email and names instead.
 *
 * Old links and bookmarks still carry `?email=`; it is read as `q` when `q`
 * itself is absent, and dropped from the parsed result either way.
 */
function legacyEmailToQ(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const params = raw as Record<string, unknown>;
  if ((params.q === undefined || params.q === "") && params.email !== undefined) {
    return { ...params, q: params.email };
  }
  return raw;
}

/**
 * A range typed backwards is still the same days. Swapped here, because the API
 * answers an inverted range with a 400 and the page would show its error
 * boundary for what is plainly a slip.
 */
function inOrder<T extends { from?: string; to?: string }>(params: T): T {
  return params.from && params.to && params.from > params.to
    ? { ...params, from: params.to, to: params.from }
    : params;
}

const ordersQueryShape = z.object({
  q: searchParam,
  status: orderStatusSchema.optional().catch(undefined),
  /** placed on or after, UTC; a draft counts by the day it was created */
  from: isoDayParam,
  /** placed on or before, UTC */
  to: isoDayParam,
  sort: z.enum(ORDER_SORTS).catch(DEFAULT_ORDER_SORT),
  limit: limitParam,
  page: pageParam,
});

/**
 * Every field has its own `.catch()`; the outer one only covers input that is
 * not an object at all, so `.parse()` still cannot throw.
 */
export const ordersQuerySchema = z
  .preprocess(legacyEmailToQ, ordersQueryShape.transform(inOrder))
  .catch(() => ordersQueryShape.parse({}));

export type OrdersQuery = z.infer<typeof ordersQuerySchema>;

/**
 * The parsed params as the list's own links carry them, defaults left out: a
 * status chip reads `/orders?status=PAID` rather than
 * `/orders?status=PAID&sort=placed_desc&limit=20`. Parsing either gives the same
 * params back, so this is only about the URL a person reads and shares.
 */
export function ordersLinkParams(params: OrdersQuery): Params {
  return {
    ...params,
    sort: params.sort === DEFAULT_ORDER_SORT ? undefined : params.sort,
    limit: params.limit === DEFAULT_PAGE_SIZE ? undefined : params.limit,
  };
}
