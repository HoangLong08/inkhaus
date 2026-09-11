import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { addOrderNote } from "@/lib/mutations";
import { orderNoteInputSchema, orderNumberParamSchema } from "@/lib/schemas/forms";

/** an internal note - staff only, never shown to the customer */
export const POST = route(
  async (request: Request, ctx: { params: Promise<{ number: string }> }) => {
    await requireCapability("orders.note");
    const { number } = orderNumberParamSchema.parse(await ctx.params);
    const input = orderNoteInputSchema.parse(await request.json().catch(() => undefined));
    return NextResponse.json(await addOrderNote(number, input));
  },
);
