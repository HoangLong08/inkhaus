import { loadRootEnv } from "@inkhaus/env";
import { defineConfig, devices } from "@playwright/test";

// DATABASE_URL and CHROME_PATH come from the repo-root .env like everything
// else. Every other value below is set per web server on purpose: the suite
// needs a fake Google and dedicated ports, which is precisely what must NOT be
// written into a file a developer also runs `npm run dev` from.
loadRootEnv();

/**
 * Real Chromium, real redirects, real signed JWTs - only the issuer is local.
 * See packages/oidc-stub for why Google itself cannot be in the loop.
 *
 * Dedicated ports throughout, so a run never fights the dev servers a developer
 * already has open on 4000/4321/4322.
 */
const FAKE_GOOGLE_PORT = 4399;
const API_PORT = 4001;
const ADMIN_PORT = 4323;

const FAKE_GOOGLE = `http://localhost:${FAKE_GOOGLE_PORT}`;
export const ADMIN_ORIGIN = `http://localhost:${ADMIN_PORT}`;
export const API_ORIGIN = `http://localhost:${API_PORT}/api/v1`;

const CLIENT_ID = "inkhaus-e2e-client";

/** sign-ins allowed per minute while testing; the production default is 10 */
export const LOGIN_RATE_LIMIT = 40;

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://inkhaus:inkhaus@localhost:5432/inkhaus?schema=public";

/**
 * Both apps run in development mode on purpose, and not only for speed: the
 * OIDC overrides these tests depend on are refused when NODE_ENV is production,
 * and a production build would also mark the session cookie `Secure`, which a
 * browser will not store over plain http on localhost. Testing the production
 * bundle is what `npm run build` is for.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false, // the suite shares one database
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",

  // The admin dev server now compiles Radix, react-hook-form and TanStack
  // Query on the first navigation into each route, which lands squarely in
  // the first test that visits it.
  timeout: 45_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: ADMIN_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Reuse an installed Chrome when CHROME_PATH is set, matching the
        // convention in apps/web/scripts/*.mjs; otherwise Playwright's own
        // Chromium, which is already cached on this machine.
        ...(process.env.CHROME_PATH
          ? { launchOptions: { executablePath: process.env.CHROME_PATH } }
          : {}),
      },
    },
  ],

  webServer: [
    {
      command: "node ../../packages/oidc-stub/fake-google.mjs",
      port: FAKE_GOOGLE_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      env: {
        FAKE_GOOGLE_PORT: String(FAKE_GOOGLE_PORT),
        FAKE_GOOGLE_ISSUER: FAKE_GOOGLE,
        FAKE_GOOGLE_CLIENT_ID: CLIENT_ID,
        FAKE_GOOGLE_APP_NAME: "INKHAUS Back Office",
      },
    },
    {
      command: "node ../api/dist/main.js",
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      env: {
        NODE_ENV: "test",
        // API_PORT, not PORT: the API reads API_PORT first, and the root .env
        // this config just loaded already has one. Setting only PORT here would
        // leave the suite's API on 4000, fighting whatever dev server is there.
        API_PORT: String(API_PORT),
        DATABASE_URL,
        CORS_ORIGIN: ADMIN_ORIGIN,
        ADMIN_SESSION_TTL_HOURS: "12",
        // The suite signs in far more often in a minute than a person would,
        // and the production default of 10 throttles it half way through. The
        // limit itself is still covered - see the throttling test, which reads
        // this same number.
        ADMIN_LOGIN_RATE_LIMIT: String(LOGIN_RATE_LIMIT),
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_ISSUER: FAKE_GOOGLE,
        GOOGLE_JWKS_URL: `${FAKE_GOOGLE}/.well-known/jwks.json`,
      },
    },
    {
      command: `npx next dev -p ${ADMIN_PORT}`,
      port: ADMIN_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      timeout: 180_000,
      env: {
        NODE_ENV: "development",
        // Its own build dir, not just its own port: Next's dev lockfile lives
        // in distDir, so sharing `.next` with a running `npm run dev` makes the
        // second server exit rather than start. See next.config.mjs.
        //
        // Side effect worth knowing: Next rewrites the generated `next-env.d.ts`
        // to point at whichever distDir last ran, so a run leaves that one file
        // dirty. The next `npm run dev` points it back. Do not commit it aimed
        // at `.next-e2e` - that path is gitignored and would fail `typecheck`
        // on a checkout that has never run this suite.
        NEXT_DIST_DIR: ".next-e2e",
        API_INTERNAL_URL: API_ORIGIN,
        SESSION_COOKIE_NAME: "inkhaus_admin",
        ADMIN_PUBLIC_URL: ADMIN_ORIGIN,
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: "inkhaus-e2e-secret",
        GOOGLE_AUTH_ENDPOINT: `${FAKE_GOOGLE}/o/oauth2/v2/auth`,
        GOOGLE_TOKEN_ENDPOINT: `${FAKE_GOOGLE}/token`,
      },
    },
  ],
});
