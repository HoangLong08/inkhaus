import path from 'node:path';

import { loadRootEnv } from '@inkhaus/env';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 drops `package.json#prisma`, and a config file also turns off
 * Prisma's implicit .env loading - hence the explicit load here. It reads the
 * repo-root .env rather than an apps/api/.env, which is also what puts
 * DATABASE_URL in front of the seed processes Prisma spawns: they inherit this
 * process' environment.
 */
loadRootEnv();

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
