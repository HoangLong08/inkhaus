"use client";

import { NextIntlClientProvider } from "next-intl";

import type { Locale } from "./config";
import { intlMessageFallback, onIntlError } from "./errors";

/**
 * Mounted in (dash)/layout.tsx, NOT in the root layout - the same rule, and the
 * same reason, as `Providers`. The root layout also wraps /login, which is
 * deliberately and testably a server-only page with no "use client" anywhere in
 * its tree (AGENTS.md s6). /login translates with `await getTranslations()`
 * instead, and (print) does the same.
 *
 * It sits OUTSIDE `Providers` rather than inside it, which is what lets a
 * language switch keep the query cache: `router.refresh()` changes the
 * `messages` prop here, React reconciles `Providers` in place rather than
 * remounting it, and the `QueryClient` instance underneath survives.
 *
 * This wrapper exists at all only because `onError` and `getMessageFallback` are
 * functions: `locale`, `messages` and `timeZone` would cross the RSC boundary as
 * plain props, but a function cannot, so the two are re-attached here on the
 * client side of the line.
 */
export function IntlClientProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: React.ComponentProps<typeof NextIntlClientProvider>["messages"];
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
      onError={onIntlError}
      getMessageFallback={intlMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
