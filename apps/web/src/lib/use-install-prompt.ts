"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "inkhaus:install-dismissed";

/* -------- dismissal, as a module-level store --------
 * Shared so the studio's contextual prompt and the header's menu entry agree
 * without either owning the other, and readable through useSyncExternalStore
 * so nothing has to setState out of an effect just to learn its own state. */

let dismissedCache: boolean | null = null;
const dismissListeners = new Set<() => void>();

function getDismissed() {
  if (dismissedCache === null) {
    try {
      dismissedCache = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // private windows throw on access, not just on write
      dismissedCache = false;
    }
  }
  return dismissedCache;
}

function subscribeDismissed(onChange: () => void) {
  dismissListeners.add(onChange);
  return () => void dismissListeners.delete(onChange);
}

function markDismissed() {
  dismissedCache = true;
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* dismissal just won't be remembered */
  }
  dismissListeners.forEach((l) => l());
}

/* -------- environment -------- */

const neverChanges = () => () => {};

function subscribeDisplayMode(onChange: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const readStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS predates display-mode and still only reports this
  (navigator as { standalone?: boolean }).standalone === true;

const readIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  // server snapshots are the "show nothing" answers, so the server HTML and the
  // first client render agree and only the real value causes an update
  const isStandalone = useSyncExternalStore(subscribeDisplayMode, readStandalone, () => true);
  const isIOS = useSyncExternalStore(neverChanges, readIOS, () => false);
  const dismissed = useSyncExternalStore(subscribeDismissed, getDismissed, () => true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // hold onto it: once the default mini-infobar is prevented, this event is
      // the only way back to a real install dialog
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // the event is single-use whatever the answer
    setDeferred(null);
    if (outcome === "dismissed") markDismissed();
    return outcome === "accepted";
  }, [deferred]);

  return {
    /** Chrome/Edge fired beforeinstallprompt, so a real dialog is available */
    canInstall: !isStandalone && deferred !== null,
    /** Safari never fires that event - the only route is Share > Add to Home Screen */
    needsManualInstall: !isStandalone && isIOS && deferred === null,
    isStandalone,
    dismissed,
    dismiss: markDismissed,
    install,
  };
}
