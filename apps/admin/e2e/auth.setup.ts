import { expect, test as setup } from "@playwright/test";

import { OWNER_STATE, STAFF_STATE, sessionCookie, signIn, type Account } from "./helpers";

/**
 * Signs in once per role and saves the browser state, so the specs that are
 * about something other than signing in can start signed in:
 *
 *   test.use({ storageState: OWNER_STATE })
 *
 * Two sign-ins per run instead of one or two per test - which matters, because
 * the API limits sign-ins per minute (see zz-rate-limit.spec.ts).
 *
 * The specs that are ABOUT signing in - auth, rbac, ui, zz-rate-limit - still
 * walk the flow themselves and never read these files.
 */
const ROLES: [Account, string][] = [
  ["owner", OWNER_STATE],
  ["staff", STAFF_STATE],
];

for (const [account, statePath] of ROLES) {
  setup(`sign in as ${account}`, async ({ page }) => {
    await signIn(page, account);

    await expect(page.getByTestId("user-menu")).toBeVisible();
    expect(await sessionCookie(page), "sign-in left no session cookie").not.toBeNull();

    await page.context().storageState({ path: statePath });
  });
}
