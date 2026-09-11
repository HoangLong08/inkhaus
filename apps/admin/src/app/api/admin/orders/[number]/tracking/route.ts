import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { setOrderTracking } from "@/lib/mutations";
import { orderNumberParamSchema, orderTrackingInputSchema } from "@/lib/schemas/forms";

/** add or correct tracking without moving the order */
export const PUT = route(
  async (request: Request, ctx: { params: Promise<{ number: string }> }) => {
    await requireCapability("orders.tracking");
    const { number } = orderNumberParamSchema.parse(await ctx.params);
    const input = orderTrackingInputSchema.parse(await request.json().catch(() => undefined));
    return NextResponse.json(await setOrderTracking(number, input));
  },
);
