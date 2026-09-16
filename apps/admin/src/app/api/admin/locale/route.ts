import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/i18n/config";
import { requireAdminApi } from "@/lib/api-guard";
import { route } from "@/lib/api-response";
import { localeInputSchema } from "@/lib/schemas/forms";

/**
 * The one write that sets the language cookie.
 *
 * `requireAdminApi()` rather than `requireCapability()`: like /me, this is about
 * the viewer rather than about a feature, and there is no capability that could
 * sensibly gate "reads the app in Vietnamese".
 *
 * proxy.ts needs no change for this. A PUT under /api/admin/ passes its CSRF
 * gate on `Sec-Fetch-Site: same-origin` and its content-type gate on
 * `application/json`, which is exactly what client-api/core.ts sends.
 *
 * PUT because setting a preference is idempotent. The response echoes what was
 * set so `call()` has a body to parse rather than a 204 it would have to
 * special-case.
 */
export const PUT = route(async (request: Request) => {
  await requireAdminApi();

  const { locale } = localeInputSchema.parse(await request.json().catch(() => null));

  (await cookies()).set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);

  return NextResponse.json({ locale });
});
