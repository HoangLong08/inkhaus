"use client";

import { useEffect, useState } from "react";

/**
 * Browser connectivity, as an effect rather than an initial-state read.
 *
 * navigator.onLine is unavailable during SSR and differs between server and
 * client, so the first render always claims online and the truth arrives on
 * mount. That also means no hydration mismatch.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
