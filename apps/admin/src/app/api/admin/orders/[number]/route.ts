import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireAdminApi } from "@/lib/api-guard";
import { route } from "@/lib/api-response";

/** `params` is a Promise in Next 16, in route handlers as well as in pages. */
export const GET = route(
  async (_request: Request, ctx: { params: Promise<{ number: string }> }) => {
    const [, { number }] = await Promise.all([requireAdminApi(), ctx.params]);
    return NextResponse.json(await adminApi.order(number));
  },
);
