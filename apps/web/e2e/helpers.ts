import { expect, type Page } from "@playwright/test";

export const API_ORIGIN = "http://localhost:4002/api/v1";
export const COOKIE_NAME = "inkhaus_session";

/** the keys wired to buttons on the fake consent screen - see packages/oidc-stub */
export type Account = "owner" | "staff" | "outsider" | "unverified" | "shopper" | "cancel";

/** the address packages/oidc-stub mints tokens for under the "shopper" key */
export const SHOPPER_EMAIL = "e2e-shopper@inkhaus.test";
/** the guest order apps/api/prisma/seed-e2e.ts files under that address */
export const SHOPPER_ORDER = "INK-900001";

/**
 * Walks the whole sign-in flow the way a shopper would: click the button, land
 * on the consent screen, pick an account, get redirected back. Nothing is
 * stubbed at the network layer.
 */
export async function signIn(page: Page, account: Account, startAt = "/sign-in") {
  await page.goto(startAt);
  await page.getByTestId("google-signin").click();
  await page.waitForURL(/\/o\/oauth2\/v2\/auth/);
  await page.getByTestId(`pick-${account}`).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/o/oauth2"));
}

export async function sessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === COOKIE_NAME) ?? null;
}

/** the raw session token, for hitting the API directly as that shopper */
export async function sessionToken(page: Page) {
  const cookie = await sessionCookie(page);
  expect(cookie, "expected a session cookie").not.toBeNull();
  return cookie!.value;
}
