import { expect, test, type Page } from "@playwright/test";

import { api, OWNER_STATE, readToken, STAFF_STATE } from "./helpers";

/**
 * The overview: the range switch, the chart and the table that stands in for
 * it, the attention list, and tiles whose numbers agree with the lists they
 * open.
 */
test.use({ storageState: OWNER_STATE });

const rangeLink = (page: Page, range: string) =>
  page.locator(`[data-testid="range-link"][data-range="${range}"]`);

const tile = (page: Page, status: string) =>
  page.locator(`[data-testid="stat-tile"][data-status="${status}"]`);

/** the first number in some text, separators and all: "1,204 total · page 1 of 61" -> 1204 */
function firstNumber(text: string) {
  const match = /\d[\d,]*/.exec(text);
  expect(match, `no number in "${text}"`).not.toBeNull();
  return Number(match![0].replace(/,/g, ""));
}

test.describe("overview", () => {
  test("the range switch is a link, and the chart's table has one row per day", async ({ page }) => {
    await page.goto("/");
    // no ?range= is the 30-day default
    await expect(rangeLink(page, "30d")).toHaveAttribute("aria-current", "page");
    const rows = page.getByTestId("series-table").locator("tbody tr");
    await expect(rows).toHaveCount(30);

    await rangeLink(page, "7d").click();
    await expect(page).toHaveURL(/[?&]range=7d(&|$)/);
    await expect(rangeLink(page, "7d")).toHaveAttribute("aria-current", "page");
    await expect(page.locator('[data-testid="range-link"][aria-current="page"]')).toHaveCount(1);
    await expect(rows).toHaveCount(7);
  });

  test("a range the page does not offer reads as the default", async ({ page }) => {
    await page.goto("/?range=14d");
    await expect(rangeLink(page, "30d")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("segment-error")).toHaveCount(0);
  });

  test("the chart draws", async ({ page }) => {
    await page.goto("/?range=7d");
    const chart = page.getByTestId("revenue-chart");
    await expect(chart).toBeVisible();
    // the customer fixtures include orders paid two and five days before the
    // seed ran, so the last week is never quiet
    await expect(chart).toHaveAttribute("data-empty", "false");
    await expect(chart.locator("svg.recharts-surface").first()).toBeVisible();
  });

  test("an overdue follow-up is listed and opens its quote", async ({ page }) => {
    // The e2e-quote-contacted fixture is seeded two days overdue, so this kind
    // is never absent. It need not be the item shown - the list is oldest first,
    // five at most - so the test is about the kind and where it leads.
    await page.goto("/");
    const item = page
      .locator('[data-testid="attention-item"][data-kind="overdue-follow-up"]')
      .first();
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute("href", /^\/quotes\/[^/?#]+$/);
  });

  test("every tile links to the list it counts", async ({ page }) => {
    const expected: Record<string, string> = {
      PENDING_PAYMENT: "/orders?status=PENDING_PAYMENT",
      PAID: "/orders?status=PAID",
      IN_PRODUCTION: "/orders?status=IN_PRODUCTION",
      SHIPPED: "/orders?status=SHIPPED",
      DRAFT: "/orders?status=DRAFT",
      NEW_QUOTES: "/quotes?status=NEW",
      PENDING_REVIEWS: "/reviews?status=PENDING",
    };

    await page.goto("/");
    await expect(page.getByTestId("stat-tile")).toHaveCount(Object.keys(expected).length);
    for (const [status, href] of Object.entries(expected)) {
      await expect(tile(page, status)).toHaveAttribute("href", href);
    }
  });

  test("the pending-payment tile agrees with the list it opens", async ({ page }) => {
    await page.goto("/");
    const pending = tile(page, "PENDING_PAYMENT");
    await expect(pending).toContainText(/\d/);
    const shown = firstNumber(await pending.innerText());

    await pending.click();
    await expect(page).toHaveURL(/\/orders\?status=PENDING_PAYMENT$/);
    expect(firstNumber(await page.getByTestId("orders-meta").innerText())).toBe(shown);
  });

  test("a quiet range answers a zero for every day, not a gap", async () => {
    // nothing in any INKHAUS database was placed in 2001
    const res = await api(readToken(OWNER_STATE)).get(
      "/admin/stats/overview?from=2001-01-01&to=2001-01-07",
    );
    expect(res.status).toBe(200);
    expect(res.json.range).toEqual({ from: "2001-01-01", to: "2001-01-07", days: 7, key: null });
    expect(res.json.series.map((point: { date: string }) => point.date)).toEqual([
      "2001-01-01",
      "2001-01-02",
      "2001-01-03",
      "2001-01-04",
      "2001-01-05",
      "2001-01-06",
      "2001-01-07",
    ]);
    for (const point of res.json.series) expect(point).toMatchObject({ orders: 0, revenue: 0 });
    expect(res.json.revenue).toEqual({ gross: 0, orders: 0, averageOrder: 0, refunded: 0 });
    expect(res.json.topProducts).toEqual([]);
    expect(res.json.quotes.created).toBe(0);
    expect(res.json.quotes.conversionRate).toBeNull();
  });

  test("staff may read the stats, and a malformed range is a 400", async () => {
    const staff = api(readToken(STAFF_STATE));
    expect((await staff.get("/admin/stats/overview?range=7d")).status).toBe(200);
    expect((await staff.get("/admin/stats/overview?range=14d")).status).toBe(400);
    expect((await staff.get("/admin/stats/overview?from=2026-08-03&to=2026-08-01")).status).toBe(400);
    expect((await api("").get("/admin/stats/overview")).status).toBe(401);
  });
});
