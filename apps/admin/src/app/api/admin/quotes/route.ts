import { NextResponse, type NextRequest } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { quotesQuerySchema } from "@/lib/schemas/params";

/** the quote list, filtered exactly as `/quotes` parses its URL */
export const GET = route(async (request: NextRequest) => {
  await requireCapability("quotes.manage");
  const params = quotesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  return NextResponse.json(await adminApi.quotes.list(params));
});
