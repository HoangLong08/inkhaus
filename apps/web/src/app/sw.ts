import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Deliberately NOT the Serwist template defaults.
  //
  // /design lazy-loads the 311 KB fabric.js chunk with `await import("fabric")`
  // on mount. If a new worker skipped waiting and claimed the page mid-session,
  // the running build's chunk could be purged from precache before the studio
  // asked for it - a ChunkLoadError on top of unsaved artwork. Instead the new
  // worker parks in `waiting` and UpdateToast lets the user pick the moment.
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: [
    {
      // defaultCache caps fonts at maxEntries: 4. next/font self-hosts three
      // Google families here, which is 12 woff2 files - eight of them would be
      // evicted and offline text would fall back to system fonts.
      matcher: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
      handler: new StaleWhileRevalidate({
        cacheName: "static-font-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 365 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
