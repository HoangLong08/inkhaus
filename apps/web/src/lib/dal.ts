import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { accountApi, ApiError, type Customer } from "./server-api";
import { readToken } from "./session";

/**
 * The real check on who is asking.
 *
 * A cookie being present proves nothing - it may name a session the API has
 * since expired or revoked - so this asks. Wrapped in React's `cache` so a page
 * and the components inside it hitting this in the same render cost one round
 * trip, not several.
 *
 * Unlike the back office there is no `proxy.ts` doing an optimistic pre-check:
 * the storefront is public, only /account is personalised, and a proxy matcher
 * over every product page would opt the whole catalogue out of being static.
 */
export const getCustomer = cache(async (): Promise<Customer | null> => {
  const token = await readToken();
  if (!token) return null;

  try {
    return await accountApi.me(token);
  } catch (err) {
    // 401 means the session was revoked or expired, and a signed-out shopper is
    // a normal state on a storefront rather than an error. An API that is down
    // reads the same way here - the catalogue still renders, just anonymously.
    if (!(err instanceof ApiError)) throw err;
    return null;
  }
});

/** use in any page that must not render for a stranger */
export async function requireCustomer(next = "/account") {
  const customer = await getCustomer();
  if (!customer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return customer;
}
