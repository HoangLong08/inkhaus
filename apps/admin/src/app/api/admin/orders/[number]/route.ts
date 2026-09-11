import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { orderNumberParamSchema } from "@/lib/schemas/forms";

/** `params` is a Promise in Next 16, in route handlers as well as in pages. */
export const GET = route(
  async (_request: Request, ctx: { params: Promise<{ number: string }> }) => {
    await requireCapability("orders.view");
    const { number } = orderNumberParamSchema.parse(await ctx.params);
    return NextResponse.json(await adminApi.order.get(number));
  },
);
