import { withSerwist } from "@serwist/turbopack";

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  // workspace package shipped as compiled CJS + d.ts from packages/shared
  transpilePackages: ['@inkhaus/shared'],
};

// only adds esbuild to serverExternalPackages - the service worker itself is
// built by the route handler at app/serwist/[path], not by a bundler plugin,
// which is what keeps `next build --turbopack` working.
export default withSerwist(nextConfig);
