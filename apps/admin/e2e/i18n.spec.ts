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

    // the footer's range line: its words are the List namespace, its numbers
    // are lib/format.ts - the one place both rules meet on a single element
    const range = page.getByTestId("list-range");
    const rangeBefore = (await range.innerText()).trim();
    const rangeFrom = await range.getAttribute("data-from");
    const rangeTo = await range.getAttribute("data-to");
    const rangeTotal = await range.getAttribute("data-total");

    await switchTo(page, "vi");

    // the label changed - not to any particular string, only away from the old one
    await expect
      .poll(async () => (await ordersNavLabel(page)).trim())
      .not.toBe(before);
    await expect(page.locator("html")).toHaveAttribute("lang", "vi");
    await expect.poll(async () => (await range.innerText()).trim()).not.toBe(rangeBefore);

    // and every machine-readable value is exactly where it was
    const sameRow = page.locator(`[data-testid="order-row"][data-number="${number}"]`);
    await expect(sameRow).toHaveAttribute("data-total", total!);
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", status!);
    // the regression test for `{total, number}` finding its way into List.range
    await expect(range).toHaveAttribute("data-from", rangeFrom!);
    await expect(range).toHaveAttribute("data-to", rangeTo!);
    await expect(range).toHaveAttribute("data-total", rangeTotal!);
  });

  test("the ordinal head translates inside a client table, and its numbers do not", async ({
    page,
  }) => {
    await signIn(page, "owner");
    // /catalog/colors on purpose, on two counts: ColorsTable is "use client",
    // so this is the case that proves the ordinal's namespace actually reaches
    // the browser, and the ordinal is its FIRST head - on /reviews the tick box
    // holds that slot. In the production build this suite runs, a namespace the
    // provider never got renders the key itself, a silently wrong cell that
    // every data-testid locator in this suite would sail straight past.
    await page.goto("/catalog/colors");

    const head = page.locator('[data-slot="table-head"]').first();
    const before = (await head.innerText()).trim();
    expect(before, "expected a label on the ordinal head").not.toBe("");
    expect(before, "the head rendered its own key - the namespace never arrived").not.toMatch(
      /^Common\./,
    );

    const ordinal = await page.getByTestId("row-ordinal").first().getAttribute("data-ordinal");
    expect(ordinal, "expected at least one colour in the list").toBe("1");

    await switchTo(page, "vi");

    await expect.poll(async () => (await head.innerText()).trim()).not.toBe(before);
    await expect(page.getByTestId("row-ordinal").first()).toHaveAttribute("data-ordinal", ordinal!);
  });

  test("a page's own namespace reaches its client leaves, and the chrome survives", async ({
    page,
  }) => {
    // The test above proves CHROME_NAMESPACES arrives. This proves the other
    // half: /catalog/colors nests a SECOND provider for its own namespace, and
    // nested providers replace rather than merge - so a page that passed only
    // its own set would strip the sidebar, and one that forgot to nest at all
    // would render "Colors.columns.colour" in a cell. Both are silent in a
    // production build, which is what this suite runs.
    await signIn(page, "owner");
    await page.goto("/catalog/colors");

    // the SECOND head: the first is the ordinal, which lives in Common and
    // would pass on the chrome provider alone
    const head = page.locator('[data-slot="table-head"]').nth(1);
    const before = (await head.innerText()).trim();
    expect(before, "the head rendered its own key - the namespace never arrived").not.toMatch(
      /^Colors\./,
    );

    // a surface only a client component draws, so the provider is the only way
    // its words could have got here
    await page.getByTestId("color-new").click();
    const dialog = page.getByRole("dialog").locator("h2");
    const titleBefore = (await dialog.innerText()).trim();
    expect(titleBefore).not.toMatch(/^Colors\./);
    await page.keyboard.press("Escape");

    await switchTo(page, "vi");

    await expect.poll(async () => (await head.innerText()).trim()).not.toBe(before);
    await expect(head).not.toHaveText(/^Colors\./);

    // and the chrome is still translated beside it, not rendering its own keys
    await expect(
      page.locator('[data-testid="nav-link"][data-section="orders"]'),
    ).not.toHaveText(/^Nav\./);
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
