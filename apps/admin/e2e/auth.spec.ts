import { expect, test } from "@playwright/test";

import { TEST_PRODUCT } from "./fixtures";
import {
  API_ORIGIN,
  COOKIE_NAME,
  findActionableOrder,
  openSignOutDialog,
  sessionCookie,
  sessionToken,
  signIn,
  signOut,
} from "./helpers";

test.describe("admin sign-in", () => {
  test("an anonymous visitor is sent to the login page, keeping where they were going", async ({
    page,
  }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    await expect(page.getByTestId("google-signin")).toBeVisible();
  });

  test("the login page offers Google only, and needs no client JavaScript", async ({ page }) => {
    await page.goto("/login");

    // the whole point of the change: no password path remains
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[name="email"]')).toHaveCount(0);

    // a plain form POST to the Route Handler, not a client-side action
    const form = page.getByTestId("google-form");
    await expect(form).toHaveAttribute("method", /post/i);
    await expect(form).toHaveAttribute("action", "/api/auth/google/start");

    // and it still works with scripting switched off entirely
    const noJs = await page.context().browser()!.newContext({ javaScriptEnabled: false });
    const bare = await noJs.newPage();
    await bare.goto("/login");
    await bare.getByTestId("google-signin").click();
    await bare.waitForURL(/\/o\/oauth2\/v2\/auth/);
    await expect(bare.getByTestId("pick-owner")).toBeVisible();
    await noJs.close();
  });

  test("an allowlisted account signs in and lands on the dashboard", async ({ page }) => {
    await signIn(page, "owner");

    await expect(page).toHaveURL(new RegExp("/$"));
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByTestId("current-user")).toContainText("owner");
    expect(await sessionCookie(page)).not.toBeNull();
  });

  test("the deep link that triggered the login is honoured afterwards", async ({ page }) => {
    await signIn(page, "owner", "/login?next=%2Fquotes");
    await expect(page).toHaveURL(/\/quotes$/);
  });

  test("a valid Google account that is NOT on the allowlist is refused", async ({ page }) => {
    await signIn(page, "outsider");

    await expect(page).toHaveURL(/\/login\?error=/);
    await expect(page.getByTestId("login-error")).toContainText("not allowed");
    expect(await sessionCookie(page), "a refused sign-in must leave no session").toBeNull();
  });

  test("an unverified Google email is refused even though the token is valid", async ({ page }) => {
    // the account is on the allowlist; only email_verified is false
    await signIn(page, "unverified");

    await expect(page).toHaveURL(/\/login\?error=/);
    expect(await sessionCookie(page)).toBeNull();
  });

  test("cancelling at the consent screen returns without a session", async ({ page }) => {
    await signIn(page, "cancel");

    await expect(page).toHaveURL(/\/login\?error=/);
    await expect(page.getByTestId("login-error")).toContainText("cancelled");
    expect(await sessionCookie(page)).toBeNull();
  });

  test("a tampered state parameter is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("google-signin").click();
    await page.waitForURL(/\/o\/oauth2\/v2\/auth/);

    // take the real code, then come back claiming a different state
    const link = await page.getByTestId("pick-owner").evaluate((el) => {
      const onclick = el.getAttribute("onclick") ?? "";
      return onclick.slice(onclick.indexOf("'") + 1, onclick.lastIndexOf("'"));
    });
    const forged = new URL(link);
    forged.searchParams.set("state", "not-the-state-we-issued");

    await page.goto(forged.toString());
    await expect(page).toHaveURL(/\/login\?error=/);
    await expect(page.getByTestId("login-error")).toContainText("expired");
    expect(await sessionCookie(page)).toBeNull();
  });

  test("a callback with no state cookie at all is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("google-signin").click();
    await page.waitForURL(/\/o\/oauth2\/v2\/auth/);
    const link = await page.getByTestId("pick-owner").evaluate((el) => {
      const onclick = el.getAttribute("onclick") ?? "";
      return onclick.slice(onclick.indexOf("'") + 1, onclick.lastIndexOf("'"));
    });

    // drop the flow cookies, as a forged link from another site would have
    await page.context().clearCookies();
    await page.goto(link);

    await expect(page).toHaveURL(/\/login\?error=/);
    expect(await sessionCookie(page)).toBeNull();
  });

  test("the session cookie is HttpOnly and invisible to page scripts", async ({ page }) => {
    await signIn(page, "owner");

    const cookie = await sessionCookie(page);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain(COOKIE_NAME);
  });

  test("the browser never talks to the API directly", async ({ page }) => {
    const direct: string[] = [];
    page.on("request", (req) => {
      if (req.url().startsWith("http://localhost:4001")) direct.push(req.url());
    });

    await signIn(page, "owner");
    await page.goto("/orders");
    await page.goto("/quotes");
    const quoteId = await page.getByTestId("quote-row").first().getAttribute("data-id");
    expect(quoteId, "no quote on the list - run db:seed:e2e").toBeTruthy();

    // An order, a quote and a product are the pages whose client leaves run
    // TanStack Query in the browser, so they are the ones that could regress
    // this. Wait for each client island to be interactive, not merely present,
    // or the check races the hydration.
    await page.goto(`/orders/${await findActionableOrder(await sessionToken(page))}`);
    await expect(page.getByTestId("status-select")).toBeEnabled();

    await page.goto(`/quotes/${quoteId}`);
    await expect(page.getByTestId("quote-note-save")).toBeEnabled();

    await page.goto(`/catalog/products/${TEST_PRODUCT}`);
    await expect(page.getByTestId("product-save")).toBeEnabled();

    expect(direct, "every API call must be server-to-server").toEqual([]);
  });

  test("signing out clears the cookie and revokes the token server side", async ({ page }) => {
    await signIn(page, "owner");
    const token = await sessionToken(page);

    await signOut(page);
    expect(await sessionCookie(page)).toBeNull();

    const res = await fetch(`${API_ORIGIN}/orders`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status, "the old token must be dead, not merely forgotten").toBe(401);
  });

  test("dismissing the sign-out confirmation leaves the session alone", async ({ page }) => {
    await signIn(page, "owner");
    await page.goto("/orders");
    const before = await sessionCookie(page);

    await openSignOutDialog(page);
    await page.getByTestId("sign-out-cancel").click();

    await expect(page.getByTestId("sign-out-dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/orders/);
    expect(await sessionCookie(page)).toEqual(before);
  });

  test("a session revoked while browsing takes effect on the next navigation", async ({ page }) => {
    await signIn(page, "owner");
    const token = await sessionToken(page);
    await page.goto("/orders");

    // revoke out of band, as an owner deactivating a colleague would
    await fetch(`${API_ORIGIN}/admin/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });

    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });
});
