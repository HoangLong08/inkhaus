/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deliberately no PWA, no service worker and no image optimizer here. The
  // storefront is a customer-facing installable app; this is a staff tool on its
  // own origin, and every one of those features would be cost or cache to
  // reason about for no gain. See AGENTS.md before touching Next config.
  transpilePackages: ['@inkhaus/shared'],
};

export default nextConfig;
