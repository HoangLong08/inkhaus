import { NextResponse, type NextRequest } from "next/server";

import { adminApi } from "@/lib/api";
import { requireAdminApi } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { quotesQuerySchema } from "@/lib/schemas/params";

export const GET = route(async (request: NextRequest) => {
  await requireAdminApi();
  const params = quotesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  return NextResponse.json(await adminApi.quotes(params));
});
