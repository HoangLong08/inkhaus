import type en from "../../messages/en.json";

/**
 * The shape of a catalogue, and the subset the browser is allowed to hold.
 *
 * (dash) is `force-dynamic` - load-bearing, see AGENTS.md s7 - so EVERY
 * navigation re-streams whatever `NextIntlClientProvider` is holding. A bare
 * provider ships the entire catalogue on every page change, which is why
 * (dash)/layout.tsx passes `pick(messages, CHROME_NAMESPACES)` from day one and
 * a page that needs its own namespace nests a second provider instead.
 */

export type Messages = typeof en;

export type Namespace = keyof Messages;

/** `lodash/pick` for one level, without the dependency */
export function pick<K extends Namespace>(
  messages: Messages,
  keys: readonly K[],
): Pick<Messages, K> {
  const out = {} as Pick<Messages, K>;
  for (const key of keys) {
    if (key in messages) out[key] = messages[key];
  }
  return out;
}

/**
 * The chrome, and nothing else: what the sidebar, the breadcrumb, the header,
 * the user menu and the segment error boundary need, plus the four code tables
 * that a status badge anywhere in a client leaf reads.
 *
 * `Errors` is in here because (dash)/error.tsx renders INSIDE this layout, and
 * therefore inside this provider. `global-error.tsx` and (print)/error.tsx do
 * not - they replace the root layout - and stay English by decision.
 */
export const CHROME_NAMESPACES = [
  "Common",
  "Status",
  "Role",
  "Carrier",
  "PrintMethod",
  "Nav",
  "Breadcrumb",
  "Chrome",
  "Errors",
] as const satisfies readonly Namespace[];

/**
 * What a page hands its own nested `IntlClientProvider`.
 *
 * Nested providers do NOT merge - the inner one replaces the outer - so a page
 * that mounts its own has to carry the chrome back in beside its own
 * namespaces, or every `StatusBadge`, breadcrumb and sidebar label inside that
 * subtree renders as its own key. That is a silent failure in a production
 * build, where `getMessageFallback` prints "Nav.section.orders" rather than
 * throwing, and every e2e spec matches on `data-testid` and sails past it.
 *
 * So the spread is not left to each call site to remember. Pass only what the
 * page adds; the chrome is not optional and is never a parameter.
 *
 *     <IntlClientProvider locale={locale} messages={pageMessages(messages, "Colors")}>
 *
 * A page whose every string is read by a Server Component needs none of this -
 * `getTranslations` reads the full catalogue server side and ships nothing.
 * This is only for a page with a client leaf of its own.
 */
export function pageMessages<K extends Namespace>(
  messages: Messages,
  ...added: readonly K[]
): Pick<Messages, (typeof CHROME_NAMESPACES)[number] | K> {
  return pick(messages, [...CHROME_NAMESPACES, ...added]);
}
