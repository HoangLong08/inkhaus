import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyStaffInvite } from "@/lib/mutations";
import { staffInviteInputSchema } from "@/lib/schemas/forms";

/**
 * The staff list, for the client cache to refetch after a change. The page
 * prefetches the same thing on the server; this is what an invalidation or a
 * window refocus reaches.
 */
export const GET = route(async () => {
  await requireCapability("staff.view");
  return NextResponse.json(await adminApi.staff.list());
});

/** invite: puts an address on the sign-in allowlist */
export const POST = route(async (request: Request) => {
  await requireCapability("staff.manage");
  const input = staffInviteInputSchema.parse(await request.json().catch(() => null));
  return NextResponse.json(await applyStaffInvite(input), { status: 201 });
});
