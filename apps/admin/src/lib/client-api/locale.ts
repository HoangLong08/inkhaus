import type { Locale } from "@/i18n/config";
import { localeResultSchema } from "@/lib/schemas/forms";

import { call, json } from "./core";

/**
 * The language switch, through /api/admin/locale.
 *
 * PUT, because setting a preference is idempotent - pressing "Tiếng Việt" twice
 * is one state, not two. A route handler rather than a Server Action for the
 * reason AGENTS.md s4 gives for the other writes: the control is a Radix
 * DropdownMenu, which submits nothing with JavaScript off, so an action would be
 * a second authorization path no test reaches.
 */
export const localeClient = {
  set: (locale: Locale) => call("/locale", localeResultSchema, json("PUT", { locale })),
};
