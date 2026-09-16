import { IntlErrorCode, type IntlError } from "next-intl";

/**
 * What happens when a key is missing, on both sides of the RSC boundary.
 *
 * These two must be written once and wired twice. `locale`, `messages`,
 * `timeZone`, `now` and `formats` flow from `request.ts` down through
 * `NextIntlClientProvider` on their own; `onError` and `getMessageFallback` do
 * NOT, because they are functions and a function cannot cross the boundary as a
 * prop. So `request.ts` passes them for the server, and `IntlClientProvider`
 * passes the same two for the browser.
 */

/**
 * Dev throws, production logs.
 *
 * A missing key has to be loud somewhere, and the e2e suite is not that place:
 * it runs a production build, where `getMessageFallback` below renders
 * "Orders.title" instead of crashing, and a spec that matches on `data-testid`
 * sails straight past it. So the error overlay is the gate. `NODE_ENV` is
 * inlined into the client bundle, which is what makes this fire in the browser
 * as well as on the server.
 */
export function onIntlError(error: IntlError) {
  if (error.code === IntlErrorCode.MISSING_MESSAGE && process.env.NODE_ENV !== "production") {
    throw error;
  }
  console.error(`[admin i18n] ${error.code}: ${error.message}`);
}

/**
 * The key itself, never a blank cell. An operator reading "Orders.title" in a
 * table head knows to report it; an empty `<th>` looks like a layout bug and
 * gets filed as one.
 */
export function intlMessageFallback({ namespace, key }: { namespace?: string; key: string }) {
  return namespace ? `${namespace}.${key}` : key;
}
