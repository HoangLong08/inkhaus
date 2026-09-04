import { loadRootEnv } from '@inkhaus/env';

/**
 * Side-effect module, imported first by `main.ts`.
 *
 * It has to run before anything else is imported, not just before Nest boots:
 * `config/configuration.ts` computes `isProd` at module scope and
 * `admin-auth.controller.ts` reads its rate limit inside a decorator, which is
 * evaluated the moment the class is loaded. Both happen while the import graph
 * is still being walked - long before `ConfigModule.forRoot` would get a turn.
 */
loadRootEnv();
