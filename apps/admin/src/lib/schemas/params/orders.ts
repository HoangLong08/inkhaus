import { z } from "zod";

import { orderStatusSchema } from "../api";
import { pageParam, searchParam } from "./common";

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

const ordersQueryShape = z.object({
  q: searchParam,
  status: orderStatusSchema.optional().catch(undefined),
  page: pageParam,
});

/**
 * Every field has its own `.catch()`; the outer one only covers input that is
 * not an object at all, so `.parse()` still cannot throw.
 */
export const ordersQuerySchema = z
  .preprocess(legacyEmailToQ, ordersQueryShape)
  .catch(() => ordersQueryShape.parse({}));

export type OrdersQuery = z.infer<typeof ordersQuerySchema>;
