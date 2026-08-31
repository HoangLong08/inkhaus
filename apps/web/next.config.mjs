import { withSerwist } from "@serwist/turbopack";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    // Product photography is local and committed, so every variant is billed as
    // a Vercel image transformation the first time it is requested. One format
    // instead of the webp+avif default halves that, and the trimmed width lists
    // cut it again. `quality` is deliberately never set anywhere in the app:
    // Next 16 defaults `images.qualities` to [75], and a second value would be
    // a second cached variant of every image for no visible gain.
    formats: ['image/webp'],
    deviceSizes: [640, 828, 1080, 1440, 1920],
    imageSizes: [96, 128, 256, 384],
    minimumCacheTTL: 2678400, // 31 days
    // panic switch: serve the files as-is if the optimizer ever misbehaves in
    // production. They are already downloaded pre-sized, so the cost is small.
    unoptimized: process.env.IMAGES_UNOPTIMIZED === '1',
  },
  // workspace package shipped as compiled CJS + d.ts from packages/shared
  transpilePackages: ['@inkhaus/shared'],
};

// only adds esbuild to serverExternalPackages - the service worker itself is
// built by the route handler at app/serwist/[path], not by a bundler plugin,
// which is what keeps `next build --turbopack` working.
export default withSerwist(nextConfig);
