import { NextResponse, type NextRequest } from "next/server";

import { adminApi } from "@/lib/api";
import { requireAdminApi } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { ordersQuerySchema } from "@/lib/schemas/params";

/**
 * The browser's way to read orders. It exists so client-side TanStack Query can
 * work without the browser ever holding a token or learning the API's address:
 * this runs on the Next server, reads the httpOnly session cookie, and calls the
 * API server to server. See AGENTS.md, "The BFF rule".
 */
export const GET = route(async (request: NextRequest) => {
  await requireAdminApi();
  const params = ordersQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  return NextResponse.json(await adminApi.orders(params));
});
