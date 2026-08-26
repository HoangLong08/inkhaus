/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  // workspace package shipped as compiled CJS + d.ts from packages/shared
  transpilePackages: ['@inkhaus/shared'],
};
export default nextConfig;
