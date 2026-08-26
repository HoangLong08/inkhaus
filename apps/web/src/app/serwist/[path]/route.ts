import { createSerwistRoute } from "@serwist/turbopack";

// Serwist's own example shells out to `git rev-parse HEAD` for this. Vercel
// builds from a shallow clone and the build container has no usable .git, so
// read the SHA Vercel already exports and fall back to a per-build uuid.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    // The whole storefront renders from compile-time constants in
    // @inkhaus/shared, so every one of these is genuinely usable offline.
    // /products/[slug] is left out on purpose - eight detail pages is a lot of
    // precache for pages defaultCache picks up on first visit anyway.
    additionalPrecacheEntries: [
      { url: "/", revision },
      { url: "/products", revision },
      { url: "/design", revision },
      { url: "/bulk", revision },
      { url: "/how-it-works", revision },
      { url: "/~offline", revision },
    ],
  });
