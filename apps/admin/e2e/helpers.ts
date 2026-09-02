import { expect, type Page } from "@playwright/test";

export const API_ORIGIN = "http://localhost:4001/api/v1";
export const COOKIE_NAME = "inkhaus_admin";

/** the keys wired to buttons on the fake consent screen - see fake-google.mjs */
export type Account = "owner" | "staff" | "outsider" | "unverified" | "cancel";

/**
 * Walks the whole sign-in flow the way a person would: click the button, land
 * on the consent screen, pick an account, get redirected back. Nothing is
 * stubbed at the network layer.
 */
export async function signIn(page: Page, account: Account, startAt = "/login") {
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

/** the raw session token, for hitting the API directly as that user */
export async function sessionToken(page: Page) {
  const cookie = await sessionCookie(page);
  expect(cookie, "expected a session cookie").not.toBeNull();
  return cookie!.value;
}

/** an order sitting in PENDING_PAYMENT, which every transition test starts from */
export async function findActionableOrder(token: string) {
  const res = await fetch(`${API_ORIGIN}/orders?status=PENDING_PAYMENT&limit=1`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.ok, `order lookup failed: ${res.status}`).toBe(true);
  const body = (await res.json()) as { data: { number: string }[] };
  expect(body.data.length, "seed a PENDING_PAYMENT order first").toBeGreaterThan(0);
  return body.data[0].number;
}
