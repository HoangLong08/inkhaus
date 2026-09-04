'use strict';

/**
 * One `.env` for the whole monorepo.
 *
 * Every app used to keep its own file (`apps/api/.env`, `apps/web/.env.local`,
 * `apps/admin/.env.local`), which meant the Google client id had to be pasted
 * twice and the API port lived in a file the storefront could not see. This
 * module is the single reader: it finds the repo root and loads the `.env`
 * cascade sitting there, no matter which app's directory the process was
 * started from.
 *
 * Two rules it never breaks:
 *
 * 1. **A value already in `process.env` wins.** The real environment - a shell
 *    export, a Playwright `webServer.env`, a container's config - always beats
 *    a file on disk. That is what lets the e2e suite point one API process at a
 *    fake Google while the root `.env` still names the real one.
 * 2. **No `$VAR` expansion.** Next.js expands, Prisma and Nest do not, and
 *    `dotenv-expand` silently truncates any value with a bare `$` in it - a
 *    database password like `pa$$w` would arrive as `pa`. Losing a secret is a
 *    worse failure than losing a convenience, so values are taken literally.
 */

const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

/**
 * The root is the workspaces root, not merely "two directories up": that keeps
 * working if this package is ever hoisted, symlinked or moved. Walking from
 * `__dirname` rather than `process.cwd()` is the point - `next dev` runs with
 * its cwd inside `apps/web`, and a cwd walk would find the same root only by
 * luck.
 */
function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  for (;;) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (pkg && pkg.workspaces) return dir;
      } catch {
        // an unreadable or half-written package.json is not the root we want
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Next.js' cascade, minus the parts that only make sense inside Next. */
function envFileNames(nodeEnv) {
  return [
    `.env.${nodeEnv}.local`,
    // `.env.local` is deliberately skipped under test: a suite has to produce
    // the same result on every machine, and a developer's local overrides are
    // exactly what would stop it doing so. Same rule Next.js applies.
    nodeEnv === 'test' ? null : '.env.local',
    `.env.${nodeEnv}`,
    '.env',
  ].filter(Boolean);
}

/** memoised so the dozen entry points that call this do not re-read the disk */
let cache = null;

/**
 * @param {{ root?: string, nodeEnv?: string, force?: boolean, override?: boolean }} [options]
 * @returns {{ root: string | null, files: string[], parsed: Record<string, string>, applied: string[] }}
 */
function loadRootEnv(options = {}) {
  // Only a plain `loadRootEnv()` is worth remembering; any option makes the
  // call specific enough that a caller expects it to actually run.
  const memoisable = !options.root && !options.nodeEnv && !options.override;
  if (cache && memoisable && !options.force) return cache;

  const root = options.root
    ? path.resolve(options.root)
    : (findRepoRoot(__dirname) ?? findRepoRoot(process.cwd()));

  const result = { root, files: [], parsed: {}, applied: [] };

  // No root means this is a deployment artifact rather than a checkout - the
  // API's `dist/` copied into a container, say. There is nothing to read, and
  // the real environment is expected to carry the configuration.
  if (!root) {
    if (memoisable) cache = result;
    return result;
  }

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';

  for (const name of envFileNames(nodeEnv)) {
    const file = path.join(root, name);

    let contents;
    try {
      contents = fs.readFileSync(file, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'EISDIR') {
        console.error(`[@inkhaus/env] could not read ${file}: ${err.message}`);
      }
      continue;
    }

    result.files.push(file);

    // Earlier files in the cascade are the more specific ones, so the first
    // definition of a key wins and later files only fill gaps.
    for (const [key, value] of Object.entries(dotenv.parse(contents))) {
      if (!(key in result.parsed)) result.parsed[key] = value;
    }
  }

  for (const [key, value] of Object.entries(result.parsed)) {
    if (!options.override && process.env[key] !== undefined) continue;
    process.env[key] = value;
    result.applied.push(key);
  }

  if (memoisable) cache = result;
  return result;
}

/** test seam - drops the memo so a suite can load a different root */
function resetRootEnvCache() {
  cache = null;
}

module.exports = { loadRootEnv, findRepoRoot, resetRootEnvCache };
