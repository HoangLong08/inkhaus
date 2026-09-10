import { expect, test, type Page } from "@playwright/test";

import { ORDER_PAID } from "./fixtures";
import { OWNER_STATE, STAFF_STATE } from "./helpers";

/**
 * The sidebar, the breadcrumb and the list controls every section shares, plus
 * regressions for the Phase 0 bugs that lived in them.
 */
test.use({ storageState: OWNER_STATE });

const SECTIONS = ["overview", "orders", "quotes", "customers", "catalog", "reviews", "staff"];

const navLink = (page: Page, section: string) =>
  page.locator(`[data-testid="nav-link"][data-section="${section}"]`);

async function sections(page: Page) {
  const links = page.getByTestId("nav-link");
  await expect(links.first()).toBeVisible();
  const found = await links.evaluateAll((els) => els.map((el) => el.getAttribute("data-section") ?? ""));
  return found.sort();
}

test.describe("navigation", () => {
  test("an owner is offered every section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("nav-link")).toHaveCount(SECTIONS.length);
    expect(await sections(page)).toEqual([...SECTIONS].sort());
  });

  test("staff are not offered Staff, and the page refuses them in place", async ({ browser }) => {
    const context = await browser.newContext({ storageState: STAFF_STATE });
    const page = await context.newPage();
    try {
      await page.goto("/");
      await expect(navLink(page, "staff")).toHaveCount(0);
      expect(await sections(page)).toEqual(SECTIONS.filter((s) => s !== "staff").sort());

      // a deep link still lands - on an explanation, not a redirect
      await page.goto("/staff");
      await expect(page).toHaveURL(/\/staff$/);
      await expect(page.getByTestId("owners-only")).toBeVisible();
      await expect(page.locator("h1").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("the breadcrumb names what the nav calls the page", async ({ page }) => {
    // Compared with the nav's own label rather than a string, so renaming a
    // section is one edit to nav-config and not a test failure.
    for (const section of ["customers", "reviews"]) {
      await page.goto(`/${section}`);
      const label = (await navLink(page, section).innerText()).trim();
      expect(label).not.toBe("");
      await expect(page.getByTestId("breadcrumb-current")).toHaveText(label);
    }

    await page.goto("/catalog/colors");
    const colours = page.locator('[data-testid="nav-sub-link"][href="/catalog/colors"]');
    const label = (await colours.innerText()).trim();
    expect(label).not.toBe("");
    await expect(page.getByTestId("breadcrumb-current")).toHaveText(label);

    // a record page ends on the record itself
    await page.goto(`/orders/${ORDER_PAID}`);
    await expect(page.getByTestId("breadcrumb-current")).toHaveText(ORDER_PAID);
  });

  test("an archive status still lights up the section it belongs to", async ({ page }) => {
    // DELIVERED has no queue of its own in the sidebar, so before the nav
    // registry nothing at all was marked active here
    await page.goto("/orders?status=DELIVERED");
    await expect(navLink(page, "orders")).toHaveAttribute("data-active", "true");
    await expect(navLink(page, "overview")).not.toHaveAttribute("data-active", "true");
  });
});

test.describe("Phase 0 regressions", () => {
  test("searching orders by part of an email lists matches instead of failing (bug 1)", async ({
    page,
  }) => {
    // the API used to demand a whole email and 400 on anything less, which the
    // page surfaced as its error boundary
    await page.goto("/orders?q=e2e-cust");
    await expect(page.locator(`[data-testid="order-row"][data-number="${ORDER_PAID}"]`)).toBeVisible();
    await expect(page.getByTestId("segment-error")).toHaveCount(0);
  });

  test("status filter links keep the search (bug 3)", async ({ page }) => {
    await page.goto("/orders?q=e2e&status=PAID");
    const filters = page.getByTestId("status-filter");
    await expect(filters.first()).toBeVisible();

    const hrefs = await filters.evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(1);
    for (const href of hrefs) expect(href, `filter link ${href}`).toContain("q=e2e");
  });

  test("the overview tiles carry a count (bug 4)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-testid="stat-tile"][data-status="PENDING_PAYMENT"]')).toContainText(
      /\d/,
    );
  });
});
