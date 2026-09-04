import { expect, test } from "@playwright/test";

import { SHOPPER_EMAIL, signIn } from "./helpers";

test.describe("the header account button", () => {
  test("points at /account whether or not anyone is signed in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("account-button")).toHaveAttribute("href", "/account");

    await signIn(page, "shopper");
    await page.goto("/");
    await expect(page.getByTestId("account-button")).toHaveAttribute("href", "/account");
  });

  test("labels itself with the signed-in address once the session resolves", async ({ page }) => {
    await signIn(page, "shopper");
    await page.goto("/");

    await expect(page.getByTestId("account-button")).toHaveAttribute(
      "aria-label",
      `Account — ${SHOPPER_EMAIL}`,
    );
  });

  test("says 'Sign in' to a stranger", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("account-button")).toHaveAttribute("aria-label", "Sign in");
  });

  test("the home page never calls the API from the browser with a credential", async ({ page }) => {
    await signIn(page, "shopper");

    const authed: string[] = [];
    page.on("request", (req) => {
      const auth = req.headers()["authorization"];
      if (auth) authed.push(`${req.method()} ${req.url()}`);
    });

    await page.goto("/");
    await page.goto("/account");

    expect(authed, "no browser request may carry a bearer token").toEqual([]);
  });
});

test.describe("checkout", () => {
  test("prefills the email and name of a signed-in shopper", async ({ page }) => {
    await signIn(page, "shopper");
    await addFirstProductToCart(page);

    await page.goto("/checkout");
    await expect(page.locator("#email")).toHaveValue(SHOPPER_EMAIL);
    await expect(page.locator("#name")).toHaveValue("E2E Shopper");
  });

  test("never overwrites an address the shopper typed themselves", async ({ page }) => {
    await signIn(page, "shopper");
    await addFirstProductToCart(page);

    await page.goto("/checkout");
    await page.locator("#email").fill("gifts@somewhere-else.test");

    // a reload replays the same prefill logic against the stored details
    await page.reload();
    await expect(page.locator("#email")).toHaveValue("gifts@somewhere-else.test");
  });

  test("leaves a signed-out shopper an empty form", async ({ page }) => {
    await addFirstProductToCart(page);

    await page.goto("/checkout");
    await expect(page.locator("#email")).toHaveValue("");
  });
});

/** the shortest real path to a non-empty cart: a product page defaults to 1 × M */
async function addFirstProductToCart(page: import("@playwright/test").Page) {
  await page.goto("/products");
  await page.getByTestId("product-card").first().getByRole("link").first().click();
  await page.getByTestId("pdp-add-to-cart").click();
  await expect(page.getByTestId("cart-count")).toBeVisible();
}
