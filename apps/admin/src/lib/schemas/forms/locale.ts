import { z } from "zod";

import { LOCALES } from "@/i18n/config";

/**
 * The language switch, shared by the toggle that sends it and the route handler
 * that receives it.
 *
 * `LOCALES` is the one list (src/i18n/config.ts); retyping "en" | "vi" here is
 * how the two drift. The value ends up in a Set-Cookie, so an unrecognised one
 * is a 400 rather than a cookie nobody can read back - request.ts would fall
 * back to English and the operator would think the toggle was broken.
 */
export const localeInputSchema = z.object({
  locale: z.enum(LOCALES),
});

/** the handler answers with what it set, so the client has something to parse */
export const localeResultSchema = localeInputSchema;

export type LocaleInput = z.infer<typeof localeInputSchema>;
