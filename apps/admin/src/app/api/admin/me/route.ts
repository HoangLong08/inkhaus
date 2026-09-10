import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/api-guard";
import { route } from "@/lib/api-response";

/** who the browser is talking as; the client cache seeds itself from this */
export const GET = route(async () => NextResponse.json(await requireAdminApi()));
