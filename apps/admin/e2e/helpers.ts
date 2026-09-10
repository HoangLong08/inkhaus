import { expect, type Page } from "@playwright/test";

export const API_ORIGIN = "http://localhost:4001/api/v1";
export const COOKIE_NAME = "inkhaus_admin";

/** the keys wired to buttons on the fake consent screen - see packages/oidc-stub */
export type Account = "owner" | "staff" | "outsider" | "unverified" | "shopper" | "cancel";

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

/**
 * Sign-out moved into the sidebar's user menu when the app adopted shadcn's
 * sidebar-07 shell. It is a Radix DropdownMenu, so the item is not merely
 * hidden - it does not exist in the DOM until the trigger is clicked, and its
 * role is `menuitem`, not `button`. The item now only opens an AlertDialog,
 * which is a second portal: nothing signs out until `sign-out-confirm`.
 */
export async function signOut(page: Page) {
  await openSignOutDialog(page);
  await page.getByTestId("sign-out-confirm").click();
  await page.waitForURL(/\/login/);
}

/** the half of sign-out before the point of no return, for tests about the dialog itself */
export async function openSignOutDialog(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("sign-out-dialog")).toBeVisible();
}

/**
 * The labels of the status transitions the current user is offered.
 *
 * The control is a Radix Select, not a native <select>: the trigger is a button
 * and the options live in a portal that only exists while it is open, as
 * `[role="option"]` rather than `<option>`. Escape at the end releases the
 * scroll lock, so a caller can keep interacting with the page.
 */
export async function allowedTransitions(page: Page) {
  await page.getByTestId("status-select").click();
  await expect(page.getByTestId("status-option").first()).toBeVisible();
  const labels = await page.getByTestId("status-option").allTextContents();
  await page.keyboard.press("Escape");
  return labels.map((label) => label.trim());
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
