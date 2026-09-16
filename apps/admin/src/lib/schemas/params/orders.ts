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

/**
 * The columns `/orders` lets you hide, in the order they render.
 *
 * `number` is deliberately not in this list. That cell holds the link whose
 * `::after` is stretched over the whole row, so hiding it would leave the row
 * unclickable - and a column that cannot be named in `?cols=` cannot be hidden by
 * a hand-typed URL either. That is a stronger guarantee than a disabled checkbox.
 */
export const ORDER_COLUMNS = ["status", "customer", "units", "total", "placed"] as const;
export type OrderColumn = (typeof ORDER_COLUMNS)[number];

/**
 * `?cols=total,status` - which columns are shown. Unknown names are dropped and
 * the result is canonicalised into `ORDER_COLUMNS` order, so `?cols=total,status`
 * and `?cols=status,total` are one URL rather than two.
 *
 * Absent, empty or all-junk means every column: a `?cols=` that hid everything
 * would be a blank table with no way back except editing the address bar.
 */
const colsParam = z
  .string()
  .transform((raw) => {
    const asked = new Set(raw.split(",").map((name) => name.trim()));
    const kept = ORDER_COLUMNS.filter((column) => asked.has(column));
    return kept.length > 0 ? kept : [...ORDER_COLUMNS];
  })
  .catch(() => [...ORDER_COLUMNS]);

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
  /** display only - never sent to the API, see `lib/api/orders.ts` */
  cols: colsParam,
});

/**
 * You cannot hide the column the list is sorted by: the rows would be ordered by
 * something invisible, with no header left to flip it back. Enforced here rather
 * than only in the menu, because the menu is not the only way to write a URL.
 */
function keepSortedColumn(params: z.infer<typeof ordersQueryShape>) {
  const field = params.sort.replace(/_(asc|desc)$/, "");
  const hideable = (ORDER_COLUMNS as readonly string[]).includes(field);
  if (!hideable || params.cols.includes(field as OrderColumn)) return params;

  return {
    ...params,
    cols: ORDER_COLUMNS.filter((column) => params.cols.includes(column) || column === field),
  };
}

/**
 * Every field has its own `.catch()`; the outer one only covers input that is
 * not an object at all, so `.parse()` still cannot throw.
 */
export const ordersQuerySchema = z
  .preprocess(legacyEmailToQ, ordersQueryShape.transform(inOrder).transform(keepSortedColumn))
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
    // Also load-bearing for the type: `...params` spreads `cols` as an array,
    // which is not a ParamValue. Narrowing it here is what makes this a `Params`
    // at all - and it keeps `/orders` clean when every column is shown.
    cols: params.cols.length === ORDER_COLUMNS.length ? undefined : params.cols.join(","),
  };
}
