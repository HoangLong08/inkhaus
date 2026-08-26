import path from 'node:path';
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 drops `package.json#prisma`, and a config file also turns off
 * Prisma's implicit .env loading - hence the explicit `dotenv/config` import.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
