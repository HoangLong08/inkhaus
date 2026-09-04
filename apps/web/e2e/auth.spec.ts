import { expect, test } from "@playwright/test";

import {
  API_ORIGIN,
  COOKIE_NAME,
  SHOPPER_EMAIL,
  SHOPPER_ORDER,
  sessionCookie,
  sessionToken,
  signIn,
} from "./helpers";

test.describe("storefront sign-in", () => {
  test("a stranger opening /account is sent to sign-in and back again afterwards", async ({
    page,
  }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount/);
    await expect(page.getByTestId("google-signin")).toBeVisible();

    await page.getByTestId("google-signin").click();
    await page.waitForURL(/\/o\/oauth2\/v2\/auth/);
    await page.getByTestId("pick-shopper").click();
    await expect(page).toHaveURL(/\/account$/);
  });

  test("the sign-in page offers Google only, and needs no client JavaScript", async ({ page }) => {
    await page.goto("/sign-in");

    // there is no password anywhere in this system
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    // a plain form POST to the Route Handler, not a client-side action.
    // By test id, not `locator("form")`: the site footer carries a newsletter
    // form on every page, this one included.
    const form = page.getByTestId("signin-form");
    await expect(form).toHaveAttribute("method", /post/i);
    await expect(form).toHaveAttribute("action", "/api/auth/google/start");

    // and it still works with scripting switched off entirely
    const noJs = await page.context().browser()!.newContext({ javaScriptEnabled: false });
    const bare = await noJs.newPage();
    await bare.goto("/sign-in");
    await bare.getByTestId("google-signin").click();
    await bare.waitForURL(/\/o\/oauth2\/v2\/auth/);
    await expect(bare.getByTestId("pick-shopper")).toBeVisible();
    await noJs.close();
  });

  test("any valid Google account may sign in - customers are not an allowlist", async ({ page }) => {
    // the same account the back office refuses outright
    await signIn(page, "outsider");

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByTestId("account-email")).toHaveText("not-on-the-list@gmail.com");
    expect(await sessionCookie(page)).not.toBeNull();
  });

  test("an unverified Google email is refused even though the token is valid", async ({ page }) => {
    await signIn(page, "unverified");

    await expect(page).toHaveURL(/\/sign-in\?error=/);
    await expect(page.getByTestId("signin-error")).toContainText("verified");
    expect(await sessionCookie(page), "a refused sign-in must leave no session").toBeNull();
  });

  test("cancelling at the consent screen returns without a session", async ({ page }) => {
    await signIn(page, "cancel");

    await expect(page).toHaveURL(/\/sign-in\?error=/);
    await expect(page.getByTestId("signin-error")).toContainText("cancelled");
    expect(await sessionCookie(page)).toBeNull();
  });

  test("a tampered state parameter is rejected", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByTestId("google-signin").click();
    await page.waitForURL(/\/o\/oauth2\/v2\/auth/);

    // take the real code, then come back claiming a different state
    const link = await pickLink(page, "shopper");
    const forged = new URL(link);
    forged.searchParams.set("state", "not-the-state-we-issued");

    await page.goto(forged.toString());
    await expect(page).toHaveURL(/\/sign-in\?error=/);
    await expect(page.getByTestId("signin-error")).toContainText("expired");
    expect(await sessionCookie(page)).toBeNull();
  });

  test("a callback with no state cookie at all is rejected", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByTestId("google-signin").click();
    await page.waitForURL(/\/o\/oauth2\/v2\/auth/);
    const link = await pickLink(page, "shopper");

    // drop the flow cookies, as a forged link from another site would have
    await page.context().clearCookies();
    await page.goto(link);

    await expect(page).toHaveURL(/\/sign-in\?error=/);
    expect(await sessionCookie(page)).toBeNull();
  });

  test("an authorization code is single use", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByTestId("google-signin").click();
    await page.waitForURL(/\/o\/oauth2\/v2\/auth/);
    const link = await pickLink(page, "shopper");

    await page.goto(link);
    await expect(page).toHaveURL(/\/account$/);

    // replaying the same callback URL must not mint a second session
    await page.context().clearCookies();
    await page.goto(link);
    await expect(page).toHaveURL(/\/sign-in\?error=/);
    expect(await sessionCookie(page)).toBeNull();
  });

  test("the session cookie is HttpOnly and invisible to page scripts", async ({ page }) => {
    await signIn(page, "shopper");

    const cookie = await sessionCookie(page);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain(COOKIE_NAME);
  });

  test("the session token never reaches the browser, even through /api/auth/session", async ({
    page,
  }) => {
    await signIn(page, "shopper");
    const token = await sessionToken(page);

    const body = await page.evaluate(() => fetch("/api/auth/session").then((r) => r.text()));
    expect(body).toContain(SHOPPER_EMAIL);
    expect(body, "the profile may cross to the client, the credential may not").not.toContain(
      token,
    );
  });

  test("signing out clears the cookie and revokes the token server side", async ({ page }) => {
    await signIn(page, "shopper");
    const token = await sessionToken(page);

    await page.getByTestId("sign-out").click();
    await page.waitForURL((url) => url.pathname === "/");
    expect(await sessionCookie(page)).toBeNull();

    const res = await fetch(`${API_ORIGIN}/orders/mine`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status, "the old token must be dead, not merely forgotten").toBe(401);
  });

  test("a session revoked out of band takes effect on the next navigation", async ({ page }) => {
    await signIn(page, "shopper");
    const token = await sessionToken(page);

    await fetch(`${API_ORIGIN}/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });

    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("a storefront token is not a back office token", async ({ page }) => {
    // "owner" is a seeded OWNER in admin_users, so this is the strongest form
    // of the claim: even the right person's shop session must not open the till
    await signIn(page, "owner");
    const token = await sessionToken(page);

    const res = await fetch(`${API_ORIGIN}/orders`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status, "a customer session must not list every order").toBe(401);
  });
});

test.describe("the account page", () => {
  test("shows orders placed as a guest under the same address", async ({ page }) => {
    await signIn(page, "shopper");

    const orders = page.getByTestId("account-orders");
    await expect(orders).toBeVisible();
    await expect(orders.getByRole("link", { name: new RegExp(SHOPPER_ORDER) })).toBeVisible();
  });

  test("an order links through to its own status page", async ({ page }) => {
    await signIn(page, "shopper");
    await page.getByTestId("account-orders").getByRole("link").first().click();

    await expect(page).toHaveURL(new RegExp(`/orders/${SHOPPER_ORDER}$`));
  });

  test("a shopper with no history is told so rather than shown an error", async ({ page }) => {
    await signIn(page, "outsider");

    await expect(page.getByText("Nothing here yet")).toBeVisible();
    await expect(page.getByTestId("account-orders")).toHaveCount(0);
  });

  test("one shopper cannot see another's orders", async ({ page }) => {
    await signIn(page, "outsider");
    const token = await sessionToken(page);

    const res = await fetch(`${API_ORIGIN}/orders/mine`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as { data: { number: string }[] };
    expect(body.data.map((o) => o.number)).not.toContain(SHOPPER_ORDER);
  });

  test("/orders/mine refuses an anonymous caller", async () => {
    const res = await fetch(`${API_ORIGIN}/orders/mine`);
    expect(res.status).toBe(401);
  });

  test('"mine" is a route, not an order number', async () => {
    // the guard must answer before the :number handler ever sees the word
    const res = await fetch(`${API_ORIGIN}/orders/mine`);
    expect(res.status, "404 here would mean :number matched first").not.toBe(404);
  });
});

/** the callback URL behind one consent-screen button, without clicking it */
async function pickLink(page: import("@playwright/test").Page, account: string) {
  return page.getByTestId(`pick-${account}`).evaluate((el) => {
    const onclick = el.getAttribute("onclick") ?? "";
    return onclick.slice(onclick.indexOf("'") + 1, onclick.lastIndexOf("'"));
  });
}
