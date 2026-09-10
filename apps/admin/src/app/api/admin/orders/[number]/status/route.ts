import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyOrderStatus } from "@/lib/mutations";
import { orderStatusInputSchema } from "@/lib/schemas/forms";

/**
 * The second of the three places the rule is enforced: the UI hides moves staff
 * may not make, this refuses them with a 403 - `orders.advance` for the route,
 * `canSetStatus` inside applyOrderStatus for the value - and the API refuses
 * them again. All three are load-bearing; dropping any one of them is a
 * security change, not a refactor.
 */
export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ number: string }> }) => {
    const [user, { number }] = await Promise.all([
      requireCapability("orders.advance"),
      ctx.params,
    ]);
    const input = orderStatusInputSchema.parse(await request.json());
    return NextResponse.json(await applyOrderStatus(user, number, input));
  },
);
