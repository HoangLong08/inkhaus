"use client";

import { SerwistProvider } from "@serwist/turbopack/react";

export default function ServiceWorker({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      // SerwistProvider defaults this to true, which installs an `online`
      // listener that calls location.reload(). On /design that means a phone
      // flickering between cell and wifi throws away whatever is on the canvas.
      // The service worker already serves fresh content on the next navigation.
      reloadOnOnline={false}
      // dev builds make defaultCache NetworkOnly anyway; registering there only
      // buys stale-worker confusion during hot reloads
      disable={process.env.NODE_ENV === "development"}
    >
      {children}
    </SerwistProvider>
  );
}
