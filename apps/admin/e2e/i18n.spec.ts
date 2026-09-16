import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./helpers";

/**
 * The language switch.
 *
 * Nothing in here asserts Vietnamese copy - s6 is explicit that a test must
 * never match on visible text, because copy is the thing designers change, and
 * a translation is the same change wearing a different hat. What it asserts is
 * that the labels MOVED and the machine values did NOT.
 *
 * The last two cases are the regression test for the decision that only words
 * are translated: money stays en-US/USD and dates stay UTC, formatted by
 * lib/format.ts, whatever the locale. They are what catches somebody reaching
 * for next-intl's useFormatter() or writing `{total, number}` into a message.
 */

const LOCALE_COOKIE = "locale";

const localeCookie = (page: Page) =>
  expect.poll(async () => {
    const cookies = await page.context().cookies();
    return cookies.find((c) => c.name === LOCALE_COOKIE)?.value;
  });

async function switchTo(page: Page, locale: "en" | "vi") {
  await page.getByTestId("language-toggle").click();
  await page.getByTestId(`language-${locale}`).click();
  await localeCookie(page).toBe(locale);
}

const ordersNavLabel = (page: Page) =>
  page.locator('[data-testid="nav-link"][data-section="orders"]').innerText();

test.describe("language", () => {
  test("switching the language moves the labels and leaves the machine values alone", async ({
    page,
  }) => {
    await signIn(page, "owner");
    await page.goto("/orders");

    const before = (await ordersNavLabel(page)).trim();
    expect(before, "expected a label on the orders nav link").not.toBe("");

    const row = page.getByTestId("order-row").first();
    const number = await row.getAttribute("data-number");
    const total = await row.getAttribute("data-total");
    const status = await page.getByTestId("status-badge").first().getAttribute("data-status");
    expect(number, "expected at least one order in the list").toBeTruthy();

    await switchTo(page, "vi");

    // the label changed - not to any particular string, only away from the old one
    await expect
      .poll(async () => (await ordersNavLabel(page)).trim())
      .not.toBe(before);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");

    // and every machine-readable value is exactly where it was
    const sameRow = page.locator(`[data-testid="order-row"][data-number="${number}"]`);
    await expect(sameRow).toHaveAttribute("data-total", total!);
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", status!);
  });

  test("the choice survives a reload, and switching back restores English", async ({ page }) => {
    await signIn(page, "owner");

    await switchTo(page, "vi");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await localeCookie(page).toBe("vi");

    await switchTo(page, "en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("money and dates stay en-US and UTC in Vietnamese", async ({ page }) => {
    await signIn(page, "owner");
    await switchTo(page, "vi");
    await page.goto("/orders");

    // $1,234.56 - a grouping comma and a decimal point, not the other way round,
    // which is what vi-VN would have produced
    const total = page.getByTestId("order-row").first().locator("td", { hasText: /^\$/ }).first();
    await expect(total).toHaveText(/^\$[\d,]+\.\d{2}$/);

    const number = await page.getByTestId("order-row").first().getAttribute("data-number");
    await page.goto(`/orders/${number}`);

    // at() spells the zone out, and it must still say UTC under vi
    await expect(page.getByText(/\bUTC\b/).first()).toBeVisible();
  });
});
