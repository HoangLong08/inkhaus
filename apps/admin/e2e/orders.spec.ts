import { expect, test, type Page } from "@playwright/test";

import {
  CUSTOMER_EMAIL,
  ORDER_DELIVERED,
  ORDER_DELIVERED_DAY,
  ORDER_IN_PRODUCTION,
  ORDER_PAID,
} from "./fixtures";
import { api, OWNER_STATE, readToken, STAFF_STATE } from "./helpers";

/**
 * The orders list as staff work from it - search, placed-date range, sort, page
 * size, whole-row navigation - and the owner-only CSV export, which staff must
 * neither see nor reach through the BFF or the API.
 *
 * Owner by default. Every assertion reads `data-*`, never copy.
 */
test.use({ storageState: OWNER_STATE });

const row = (page: Page, number: string) =>
  page.locator(`[data-testid="order-row"][data-number="${number}"]`);

/** the list's `data-total`s, top to bottom */
const totals = (page: Page) =>
  page
    .getByTestId("order-row")
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-total"))));

/** an export's lines, with the byte-order mark Excel needs taken off the front */
const csvLines = (text: string) =>
  (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).split("\r\n");

test.describe("orders list", () => {
  test("an order number finds that order, with or without its prefix", async ({ page }) => {
    await page.goto("/orders");
    await page.getByTestId("orders-search").fill("900002");
    await expect(page).toHaveURL(/[?&]q=900002(&|$)/);
    await expect(row(page, ORDER_PAID)).toBeVisible();
    await expect(page.getByTestId("order-row")).toHaveCount(1);

    await page.goto("/orders?q=ink-900002");
    await expect(row(page, ORDER_PAID)).toBeVisible();
  });

  test("part of a customer's email finds their orders", async ({ page }) => {
    await page.goto("/orders");
    // cut off mid-domain: the half-typed address that used to be a 400
    await page.getByTestId("orders-search").fill(CUSTOMER_EMAIL.slice(0, 17));
    await expect(page).toHaveURL(/[?&]q=/);

    for (const number of [ORDER_PAID, ORDER_IN_PRODUCTION, ORDER_DELIVERED]) {
      await expect(row(page, number)).toBeVisible();
    }
    await expect(page.getByTestId("segment-error")).toHaveCount(0);
  });

  test("a search that matches nothing says so, and offers the way back", async ({ page }) => {
    await page.goto("/orders?q=e2e-no-such-order-zz&limit=50");
    await expect(page.getByTestId("orders-empty")).toHaveAttribute("data-reason", "filtered");
    await expect(page.getByTestId("order-row")).toHaveCount(0);
    await expect(page.getByTestId("segment-error")).toHaveCount(0);
    await expect(page.getByTestId("orders-meta")).toBeVisible();

    // clearing the filters keeps the page size
    await page.getByTestId("orders-empty-action").click();
    await expect(page).toHaveURL(/\/orders\?limit=50$/);
    await expect(page.getByTestId("order-row").first()).toBeVisible();
  });

  test("a placed-date range lists the orders placed that day", async ({ page }) => {
    await page.goto(`/orders?from=${ORDER_DELIVERED_DAY}&to=${ORDER_DELIVERED_DAY}`);

    await expect(row(page, ORDER_DELIVERED)).toBeVisible();
    // placed two days before the run, so never on the fixture's fixed day
    await expect(row(page, ORDER_PAID)).toHaveCount(0);

    const trigger = page.getByTestId("orders-date-trigger");
    await expect(trigger).toHaveAttribute("data-from", ORDER_DELIVERED_DAY);
    await expect(trigger).toHaveAttribute("data-to", ORDER_DELIVERED_DAY);
  });

  test("sorting by total, ascending, orders the rows by total and keeps the search", async ({
    page,
  }) => {
    // the fixture customer's orders: known, distinct totals
    await page.goto(`/orders?q=${encodeURIComponent(CUSTOMER_EMAIL)}`);
    await expect(row(page, ORDER_DELIVERED)).toBeVisible();

    const head = page.locator('[data-testid="sort-head"][data-sort="total"]');
    // the first click on a money column sorts high to low; the next flips it
    await head.click();
    await expect(head).toHaveAttribute("data-direction", "desc");
    await head.click();
    await expect(head).toHaveAttribute("data-direction", "asc");
    await expect(page).toHaveURL(/[?&]sort=total_asc(&|$)/);
    await expect(page).toHaveURL(/[?&]q=/);

    const values = await totals(page);
    expect(values.length).toBeGreaterThanOrEqual(3);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  test("rows per page is a link that lands in the URL and survives filtering", async ({ page }) => {
    await page.goto("/orders");
    const fifty = page.locator('[data-testid="page-size"][data-limit="50"]');
    await fifty.click();

    await expect(page).toHaveURL(/[?&]limit=50(&|$)/);
    await expect(fifty).toHaveAttribute("aria-current", "page");
    await expect(page.locator('[data-testid="page-size"][data-limit="20"]')).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    const paid = page.locator('[data-testid="status-filter"][data-status="PAID"]');
    await expect(paid).toHaveAttribute("href", /[?&]limit=50(&|$)/);
  });

  test("the whole row opens the order; the customer cell is its own link", async ({ page }) => {
    await page.goto("/orders?q=900002");
    const target = row(page, ORDER_PAID);
    await expect(target).toBeVisible();

    await expect(target.getByTestId("order-customer-link")).toHaveAttribute(
      "href",
      /^\/customers\/[^/?]+$/,
    );

    // The status badge is not a link. A real click on it - hit-tested by the
    // browser, not dispatched at an element - lands on the row's stretched link.
    const badge = await target.getByTestId("status-badge").boundingBox();
    expect(badge).not.toBeNull();
    await page.mouse.click(badge!.x + badge!.width / 2, badge!.y + badge!.height / 2);
    await expect(page).toHaveURL(new RegExp(`/orders/${ORDER_PAID}$`));
  });
});

test.describe("orders export", () => {
  test("an owner's export link carries the list's filters, not its paging", async ({ page }) => {
    // The delivered fixture: a finished order nothing earlier in the run moves,
    // so the list is non-empty and the button is a live link. (INK-900002 is
    // PAID, and order-detail.spec - which sorts first - may advance it.)
    const q = ORDER_DELIVERED.slice(4);
    const day = ORDER_DELIVERED_DAY;
    await page.goto(`/orders?q=${q}&status=DELIVERED&from=${day}&to=${day}&limit=50&sort=total_asc`);
    const link = page.getByTestId("orders-export");
    await expect(link).toHaveAttribute("download", "");

    const href = new URL((await link.getAttribute("href"))!, "http://admin.invalid");
    expect(href.pathname).toBe("/api/admin/exports/orders");
    expect(href.searchParams.get("q")).toBe(q);
    expect(href.searchParams.get("status")).toBe("DELIVERED");
    expect(href.searchParams.get("from")).toBe(day);
    expect(href.searchParams.get("to")).toBe(day);
    expect(href.searchParams.get("sort")).toBe("total_asc");
    expect(href.searchParams.has("limit")).toBe(false);
    expect(href.searchParams.has("page")).toBe(false);
  });

  test("an owner gets the filtered list as CSV", async ({ request }) => {
    const res = await request.get(`/api/admin/exports/orders?q=${ORDER_PAID.slice(4)}`);

    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toMatch(/^attachment; filename="orders-\d{8}\.csv"$/);
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["x-export-truncated"]).toBeUndefined();

    const lines = csvLines(await res.text());
    expect(lines[0]).toMatch(/^number,status,/);
    expect(lines.some((line) => line.startsWith(`${ORDER_PAID},`))).toBe(true);
  });

  test("staff see no export, and are refused by the BFF and the API", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STAFF_STATE });
    const page = await context.newPage();
    try {
      await page.goto("/orders");
      await expect(page.getByTestId("order-row").first()).toBeVisible();
      await expect(page.getByTestId("orders-export")).toHaveCount(0);

      const viaBff = await context.request.get("/api/admin/exports/orders");
      expect(viaBff.status()).toBe(403);
      expect(viaBff.headers()["content-type"]).toContain("application/json");

      const viaApi = await api(readToken(STAFF_STATE)).get("/admin/exports/orders.csv");
      expect(viaApi.status).toBe(403);
    } finally {
      await context.close();
    }
  });
});
