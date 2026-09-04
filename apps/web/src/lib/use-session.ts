"use client";

import { useEffect, useState } from "react";

export type SessionCustomer = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

/**
 * Who the browser is signed in as, asked once per mount.
 *
 * Deliberately not a zustand store like the cart: there is nothing to mutate
 * here and nothing to persist. The answer comes from an HttpOnly cookie the
 * page cannot read, so the only way to know is to ask the server - and the
 * only way to change it is to sign in or out, both of which are full
 * navigations that remount this anyway.
 *
 * `loading` is exposed for callers that need it; the header does not, because
 * it renders a correct link either way.
 */
/**
 * The one request in flight right now, shared by every caller that asks while
 * it is still open.
 *
 * Three components want the session on a checkout page - the header button, the
 * checkout form, sometimes the order lookup - and they all mount in the same
 * tick, which without this is three identical round trips. Only the *pending*
 * promise is shared, never a settled one: a resolved cache would have to be
 * invalidated on sign-out, and a header still showing someone's avatar after
 * they signed out is a worse bug than a spare fetch.
 *
 * Deliberately not aborted on unmount either. An AbortController per caller
 * would have the first component to unmount cancel the request the other two
 * are still waiting on.
 */
let inflight: Promise<SessionCustomer | null> | null = null;

function fetchSession() {
  inflight ??= fetch("/api/auth/session", { credentials: "same-origin" })
    .then((res) => (res.ok ? res.json() : { customer: null }))
    .then((body: { customer: SessionCustomer | null }) => body.customer)
    // offline, or the server is mid-restart - "not signed in" is the right
    // thing to draw either way
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useSession() {
  const [customer, setCustomer] = useState<SessionCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;

    fetchSession().then((result) => {
      if (!live) return;
      setCustomer(result);
      setLoading(false);
    });

    return () => {
      live = false;
    };
  }, []);

  return { customer, loading };
}
