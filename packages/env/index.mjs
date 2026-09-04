// The implementation is CommonJS because most of its callers are: NestJS'
// compiled output, ts-node running the Prisma seeds, and Playwright's config
// transform. This wrapper is what `next.config.mjs` and the `scripts/*.mjs`
// helpers import - one module either way, so the memo inside is shared.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const impl = require('./index.cjs');

export const loadRootEnv = impl.loadRootEnv;
export const findRepoRoot = impl.findRepoRoot;
export const resetRootEnvCache = impl.resetRootEnvCache;

export default impl;
