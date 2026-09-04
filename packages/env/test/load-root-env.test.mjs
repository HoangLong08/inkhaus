import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { findRepoRoot, loadRootEnv, resetRootEnvCache } from '../index.mjs';

/** a throwaway monorepo on disk, so nothing here depends on the real one */
function makeFakeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkhaus-env-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
  fs.mkdirSync(path.join(root, 'apps', 'web'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps', 'web', 'package.json'), JSON.stringify({ name: 'web' }));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), contents);
  }
  return root;
}

const TOUCHED = /^(TEST_|NODE_ENV$)/;

describe('loadRootEnv', () => {
  let before;
  const roots = [];

  beforeEach(() => {
    before = { ...process.env };
    resetRootEnvCache();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (TOUCHED.test(key) && !(key in before)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(before)) {
      if (TOUCHED.test(key)) process.env[key] = value;
    }
    resetRootEnvCache();
    while (roots.length) fs.rmSync(roots.pop(), { recursive: true, force: true });
  });

  const fakeRoot = (files) => {
    const root = makeFakeRoot(files);
    roots.push(root);
    return root;
  };

  it('reads .env from the root and puts it on process.env', () => {
    const root = fakeRoot({ '.env': 'TEST_A=one\nTEST_B=two\n' });

    const result = loadRootEnv({ root });

    assert.equal(process.env.TEST_A, 'one');
    assert.equal(process.env.TEST_B, 'two');
    assert.deepEqual(result.applied.sort(), ['TEST_A', 'TEST_B']);
    assert.equal(result.root, root);
  });

  it('never overwrites a value that is already in the environment', () => {
    const root = fakeRoot({ '.env': 'TEST_A=from-file\n' });
    process.env.TEST_A = 'from-shell';

    const result = loadRootEnv({ root });

    assert.equal(process.env.TEST_A, 'from-shell');
    assert.deepEqual(result.applied, []);
    // the file value is still reported, it just was not applied
    assert.equal(result.parsed.TEST_A, 'from-file');
  });

  it('treats an empty string in the environment as set, not as missing', () => {
    // Playwright and Docker both pass empty strings for "leave this off"; the
    // API reads `GOOGLE_ISSUER=''` as "use Google", and a file must not undo it.
    const root = fakeRoot({ '.env': 'TEST_ISSUER=https://accounts.google.com\n' });
    process.env.TEST_ISSUER = '';

    loadRootEnv({ root });

    assert.equal(process.env.TEST_ISSUER, '');
  });

  it('overrides only when asked to', () => {
    const root = fakeRoot({ '.env': 'TEST_A=from-file\n' });
    process.env.TEST_A = 'from-shell';

    loadRootEnv({ root, override: true });

    assert.equal(process.env.TEST_A, 'from-file');
  });

  it('lets the more specific file in the cascade win', () => {
    const root = fakeRoot({
      '.env': 'TEST_A=base\nTEST_B=base\nTEST_C=base\n',
      '.env.development': 'TEST_A=dev\nTEST_B=dev\n',
      '.env.local': 'TEST_A=local\n',
    });

    loadRootEnv({ root, nodeEnv: 'development' });

    assert.equal(process.env.TEST_A, 'local');
    assert.equal(process.env.TEST_B, 'dev');
    assert.equal(process.env.TEST_C, 'base');
  });

  it('ignores .env.local under test so a suite runs the same everywhere', () => {
    const root = fakeRoot({
      '.env': 'TEST_A=base\n',
      '.env.local': 'TEST_A=local\n',
      '.env.test': 'TEST_A=test\n',
    });

    loadRootEnv({ root, nodeEnv: 'test' });

    assert.equal(process.env.TEST_A, 'test');
  });

  it('takes values literally - a $ in a password survives', () => {
    // dotenv-expand would turn `pa$$w` into `pa`. Losing a secret quietly is
    // exactly the failure this loader is written to avoid.
    const root = fakeRoot({
      '.env': 'TEST_URL=postgresql://u:pa$$w@localhost:5432/db?schema=public\nTEST_REF=$TEST_URL\n',
    });

    loadRootEnv({ root });

    assert.equal(process.env.TEST_URL, 'postgresql://u:pa$$w@localhost:5432/db?schema=public');
    assert.equal(process.env.TEST_REF, '$TEST_URL');
  });

  it('is a no-op when there are no env files at all', () => {
    const root = fakeRoot({});

    const result = loadRootEnv({ root });

    assert.deepEqual(result.files, []);
    assert.deepEqual(result.applied, []);
  });

  it('is a no-op outside a checkout instead of throwing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkhaus-noroot-'));
    roots.push(dir);

    // no package.json with `workspaces` anywhere above a temp dir
    const result = loadRootEnv({ root: dir });

    assert.deepEqual(result.files, []);
    assert.deepEqual(result.applied, []);
  });

  it('memoises a plain call on the real repo but re-reads when forced', () => {
    // An explicit root is never memoised, so the memo can only be exercised
    // against the actual monorepo. Loading it here is safe: the loader never
    // overwrites anything already set, and this is the same file every app in
    // the repo reads anyway.
    const first = loadRootEnv();
    const second = loadRootEnv();
    assert.equal(first, second, 'the same result object should come back');
    assert.ok(first.root, 'the monorepo root should have been found');

    const forced = loadRootEnv({ force: true });
    assert.notEqual(first, forced, 'force should produce a fresh read');
    assert.equal(forced.root, first.root);
  });
});

describe('findRepoRoot', () => {
  it('walks up to the workspaces root, not to the first package.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'inkhaus-find-'));
    try {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
      const nested = path.join(root, 'apps', 'api', 'prisma');
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(root, 'apps', 'api', 'package.json'), JSON.stringify({ name: 'api' }));

      assert.equal(fs.realpathSync(findRepoRoot(nested)), fs.realpathSync(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('finds this repo from its own directory', () => {
    const root = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
    assert.ok(root, 'the monorepo root should be findable from packages/env');
    assert.ok(fs.existsSync(path.join(root, 'packages', 'env', 'index.cjs')));
  });

  it('returns null rather than throwing when there is no root', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkhaus-none-'));
    try {
      assert.equal(findRepoRoot(dir), null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
