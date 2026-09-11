import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyOrderStatus } from "@/lib/mutations";
import { orderNumberParamSchema, orderStatusInputSchema } from "@/lib/schemas/forms";

/**
 * The second of the three places the rule is enforced: the UI hides moves staff
 * may not make, this refuses them with a 403 - `orders.advance` for the route,
 * `canSetStatus` inside applyOrderStatus for the value - and the API refuses
 * them again. All three are load-bearing; dropping any one of them is a
 * security change, not a refactor.
 */
export const PATCH = route(
  async (request: Request, ctx: { params: Promise<{ number: string }> }) => {
    const user = await requireCapability("orders.advance");
    const { number } = orderNumberParamSchema.parse(await ctx.params);
    // a body that is not JSON at all parses as nothing, and zod says why in a 400
    const input = orderStatusInputSchema.parse(await request.json().catch(() => undefined));
    return NextResponse.json(await applyOrderStatus(user, number, input));
  },
);
