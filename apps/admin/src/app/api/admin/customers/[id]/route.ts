import { NextResponse } from "next/server";

import { adminApi } from "@/lib/api";
import { requireCapability } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { applyCustomerEdit } from "@/lib/mutations";
import { customerEditInputSchema } from "@/lib/schemas/forms";
import { customerIdSchema } from "@/lib/schemas/params";

type Ctx = { params: Promise<{ id: string }> };

/** the profile's client leaves refetch through here after an edit */
export const GET = route(async (_request: Request, ctx: Ctx) => {
  const [, params] = await Promise.all([requireCapability("customers.view"), ctx.params]);
  const id = customerIdSchema.parse(params.id);
  return NextResponse.json(await adminApi.customers.get(id));
});

/**
 * The BFF third of the rule: the profile hides the edit button without
 * `customers.edit`, this refuses it with a 403, and the API refuses it again.
 * A body that is not JSON at all reaches the schema as `undefined` and is a 400
 * like any other malformed edit, rather than a SyntaxError reported as a 500.
 */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const [, params] = await Promise.all([requireCapability("customers.edit"), ctx.params]);
  const id = customerIdSchema.parse(params.id);
  const input = customerEditInputSchema.parse(await request.json().catch(() => undefined));
  return NextResponse.json(await applyCustomerEdit(id, input));
});
