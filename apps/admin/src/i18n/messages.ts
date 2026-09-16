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
