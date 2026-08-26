"use client";

import { useEffect, useState } from "react";
import { useSerwist } from "@serwist/turbopack/react";
import { RotateCw } from "lucide-react";

/**
 * The service worker installs new builds but parks them in `waiting` rather
 * than claiming the page (see skipWaiting: false in app/sw.ts). Nothing changes
 * under a half-finished design until the user says so here.
 */
export default function UpdateToast() {
  const { serwist } = useSerwist();
  const [waiting, setWaiting] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setWaiting(true);
    // fires once the new worker has actually taken over - reloading before this
    // just serves the old build again
    const onControlling = () => window.location.reload();
    serwist.addEventListener("waiting", onWaiting);
    serwist.addEventListener("controlling", onControlling);
  }, [serwist]);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full border hairline bg-paper px-3 py-2 shadow-lg"
    >
      <span className="pl-2 text-[13px] text-ink/70">A new version is ready.</span>
      <button
        type="button"
        disabled={reloading}
        onClick={() => {
          setReloading(true);
          serwist?.messageSkipWaiting();
        }}
        className="flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-ink disabled:opacity-60"
      >
        <RotateCw size={13} className={reloading ? "animate-spin" : undefined} aria-hidden />
        {reloading ? "Updating" : "Reload"}
      </button>
    </div>
  );
}
