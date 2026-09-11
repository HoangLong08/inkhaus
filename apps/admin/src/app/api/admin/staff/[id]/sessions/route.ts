import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyStaffRevoke } from "@/lib/mutations";
import { staffIdSchema } from "@/lib/schemas/forms";

/** sign a colleague out everywhere, without touching their access */
export const DELETE = route(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const [user, params] = await Promise.all([requireCapability("staff.manage"), ctx.params]);
    const id = staffIdSchema.parse(params.id);
    return NextResponse.json(await applyStaffRevoke(user, id));
  },
);
