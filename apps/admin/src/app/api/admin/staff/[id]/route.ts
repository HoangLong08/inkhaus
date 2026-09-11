import { NextResponse } from "next/server";

import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyStaffChange } from "@/lib/mutations";
import { staffChangeInputSchema, staffIdSchema } from "@/lib/schemas/forms";

/**
 * Role, active flag and name. The second of three places the staff rules are
 * enforced: the screen disables what `staffChangeError` refuses, this refuses
 * it again - `staff.manage` for the route, `staffChangeError` inside
 * applyStaffChange for the value - and the API refuses it a third time inside
 * a Serializable transaction.
 */
export const PATCH = route(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const [user, params] = await Promise.all([requireCapability("staff.manage"), ctx.params]);
  const id = staffIdSchema.parse(params.id);
  const change = staffChangeInputSchema.parse(await request.json());
  return NextResponse.json(await applyStaffChange(user, id, change));
});
