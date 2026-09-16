import { loadRootEnv } from "@inkhaus/env";
import createNextIntlPlugin from "next-intl/plugin";

// There is no apps/admin/.env.local - the whole monorepo shares the one at the
// repo root. Values already in the environment win, which is what lets the e2e
// suite point this app at its fake Google without editing any file.
loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next holds a lockfile inside distDir and refuses a second `next dev` in the
  // same directory, so the e2e suite's own server needs its own build dir - a
  // dedicated port is not enough. Without this the suite cannot run at all
  // while a developer has `npm run dev` open, which is precisely when they
  // reach for it. Unset in normal dev, so that stays plain `.next`.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Deliberately no PWA, no service worker and no image optimizer here. The
  // storefront is a customer-facing installable app; this is a staff tool on its
  // own origin, and every one of those features would be cost or cache to
  // reason about for no gain. See AGENTS.md before touching Next config.
  transpilePackages: ['@inkhaus/shared'],
};

// The one sanctioned edit to this file for UI work (AGENTS.md s7). All the
// plugin does is alias `next-intl/config` to the request module below, so that
// getTranslations() and getLocale() can find it.
//
// The path is relative on purpose: under Turbopack the plugin refuses an
// absolute one. No `turbopack: {}` key is needed to go with it - the plugin
// spreads `config.turbopack` and writes its own `resolveAlias`, and on Next 16
// it takes that branch whether or not the TURBOPACK env var is set. It wires the
// webpack alias too, so `next build --webpack` still resolves.
export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
