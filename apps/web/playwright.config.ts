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
 * Dedicated ports throughout, and a different set from the back office suite's,
 * so the two can run one after another - or at the same time - without either
 * one's servers answering the other's requests.
 */
const FAKE_GOOGLE_PORT = 4398;
const API_PORT = 4002;
const WEB_PORT = 4324;

const FAKE_GOOGLE = `http://localhost:${FAKE_GOOGLE_PORT}`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
export const API_ORIGIN = `http://localhost:${API_PORT}/api/v1`;

const CLIENT_ID = "inkhaus-e2e-client";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://inkhaus:inkhaus@localhost:5432/inkhaus?schema=public";

/**
 * Both the API and the storefront run in development mode on purpose, and not
 * only for speed: the OIDC overrides these tests depend on are refused when
 * NODE_ENV is production, and a production build would also mark the session
 * cookie `Secure`, which a browser will not store over plain http on localhost.
 * Testing the production bundle is what `npm run build` is for.
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

  timeout: 45_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: WEB_ORIGIN,
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
        FAKE_GOOGLE_APP_NAME: "INKHAUS",
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
        // Unlike the back office, the storefront DOES call this API from the
        // browser - the catalogue and checkout do - so its origin needs a grant.
        CORS_ORIGIN: WEB_ORIGIN,
        CUSTOMER_SESSION_TTL_DAYS: "30",
        // the suite signs in far more often in a minute than a shopper would
        CUSTOMER_LOGIN_RATE_LIMIT: "60",
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_ISSUER: FAKE_GOOGLE,
        GOOGLE_JWKS_URL: `${FAKE_GOOGLE}/.well-known/jwks.json`,
      },
    },
    {
      command: `npx next dev -p ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      timeout: 180_000,
      env: {
        NODE_ENV: "development",
        API_INTERNAL_URL: API_ORIGIN,
        NEXT_PUBLIC_API_URL: API_ORIGIN,
        // the redirect URI is derived from this, so it has to be the port the
        // suite actually serves on
        NEXT_PUBLIC_SITE_URL: WEB_ORIGIN,
        WEB_SESSION_COOKIE_NAME: "inkhaus_session",
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: "inkhaus-e2e-secret",
        GOOGLE_AUTH_ENDPOINT: `${FAKE_GOOGLE}/o/oauth2/v2/auth`,
        GOOGLE_TOKEN_ENDPOINT: `${FAKE_GOOGLE}/token`,
      },
    },
  ],
});
