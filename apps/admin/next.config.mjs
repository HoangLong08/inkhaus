import { loadRootEnv } from "@inkhaus/env";

// There is no apps/admin/.env.local - the whole monorepo shares the one at the
// repo root. Values already in the environment win, which is what lets the e2e
// suite point this app at its fake Google without editing any file.
loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deliberately no PWA, no service worker and no image optimizer here. The
  // storefront is a customer-facing installable app; this is a staff tool on its
  // own origin, and every one of those features would be cost or cache to
  // reason about for no gain. See AGENTS.md before touching Next config.
  transpilePackages: ['@inkhaus/shared'],
};

export default nextConfig;
