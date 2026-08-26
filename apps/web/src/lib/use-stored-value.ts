"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage as a React external store.
 *
 * The naive version of this — read it in an effect, push it into state — makes
 * the first client render disagree with the server HTML unless it is guarded,
 * and sets state from an effect body either way. `useSyncExternalStore` is the
 * primitive built for exactly this: the server snapshot is null, the client
 * snapshot arrives with hydration, and nothing renders twice by accident.
 *
 * Snapshots are cached because getSnapshot runs on every render and must return
 * a value that is `Object.is`-stable, which a fresh `localStorage.getItem` call
 * happens to be for strings but not for anything parsed.
 */

const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<() => void>>();
let wired = false;

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

/** other tabs write too — one document-level listener serves every key */
function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("storage", (e) => {
    if (e.key === null) {
      // localStorage.clear() elsewhere
      const keys = [...cache.keys()];
      cache.clear();
      keys.forEach(notify);
      return;
    }
    cache.delete(e.key);
    notify(e.key);
  });
}

function read(key: string): string | null {
  if (!cache.has(key)) {
    try {
      cache.set(key, localStorage.getItem(key));
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) ?? null;
}

export function writeStoredValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or quota — the in-memory copy still serves this session */
  }
  cache.set(key, value);
  notify(key);
}

export function useStoredValue(key: string): string | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      wire();
      const set = listeners.get(key) ?? new Set<() => void>();
      listeners.set(key, set);
      set.add(onChange);
      return () => set.delete(onChange);
    },
    [key],
  );

  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}
