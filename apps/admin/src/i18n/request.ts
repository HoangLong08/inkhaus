import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE, pickLocale, type Locale } from "./config";
import { intlMessageFallback, onIntlError } from "./errors";

/**
 * The one place the locale is decided, once per request.
 *
 * `next.config.mjs` points `createNextIntlPlugin` at this file, and everything
 * else - `getTranslations()` in a Server Component, `getLocale()` in the root
 * layout, `getMessages()` in (dash)/layout.tsx - reads what it returns.
 *
 * There is no proxy involvement and no `[locale]` segment: see `config.ts`.
 * `cookies()` is async in Next 16, which is why this callback is too.
 */

/**
 * A static map, not `import(`../../messages/${locale}.json`)`. The template form
 * compiles to a context module that pulls in whatever matches the pattern; this
 * one is exhaustive over `Locale` at compile time, so adding a locale to
 * `LOCALES` fails to typecheck until its catalogue exists.
 */
const MESSAGES = {
  en: () => import("../../messages/en.json"),
  vi: () => import("../../messages/vi.json"),
} satisfies Record<Locale, () => Promise<{ default: unknown }>>;

export default getRequestConfig(async () => {
  // The cookie is attacker-controlled input like any other. `pickLocale` is the
  // whole validation story: anything not in LOCALES is English.
  const locale = pickLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: (await MESSAGES[locale]()).default,

    // Decision: only words are translated. Numbers, money and dates stay en-US /
    // USD / UTC and are formatted by lib/format.ts, which this never touches.
    // `timeZone` is set anyway so that if a formatter ever does run through
    // next-intl it agrees with lib/format.ts rather than with the machine's zone
    // - the hydration rule in AGENTS.md s4. The key convention (s9) forbids ICU
    // formatting functions in a message, which is what keeps that hypothetical.
    timeZone: "UTC",

    onError: onIntlError,
    getMessageFallback: intlMessageFallback,
  };
});
