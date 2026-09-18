import { expect, test, type Page } from "@playwright/test";

import { TEST_COLOR, TEST_PRODUCT, TEST_SIZE } from "./fixtures";
import { API_ORIGIN, OWNER_STATE, STAFF_STATE, api, readToken } from "./helpers";

/**
 * The catalog screens and the price rule (D12, D13). The suite's API runs with
 * CATALOG_PRICE_EDITS=true (playwright.config.ts), so the owner half changes
 * prices end to end; the flag-off branch is the API's PriceEditsPolicy test.
 *
 * Only the seeded fixtures are touched - TEST_PRODUCT, TEST_COLOR, TEST_SIZE -
 * plus the tier ladder, which is the LIVE one every order is priced on. Every
 * test reads what it will change first and puts it back in `finally`.
 */
test.use({ storageState: OWNER_STATE });

const PRODUCT_API = `/admin/catalog/products/${TEST_PRODUCT}`;
const PRODUCT_PAGE = `/catalog/products/${TEST_PRODUCT}`;
const COLORS_API = "/admin/catalog/colors";
const SIZES_API = "/admin/catalog/sizes";
const TIERS_API = "/admin/catalog/price-tiers";

const asOwner = () => api(readToken(OWNER_STATE));
const asStaff = () => api(readToken(STAFF_STATE));

/**
 * These screens are forms. A `fill` that lands before React has hydrated the
 * input is overwritten by the first re-render, and the test then fails far from
 * the cause - so wait for the client bundle to settle, not merely for markup.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("catalog as staff", () => {
  test.use({ storageState: STAFF_STATE });

  test("prices are read-only and refused at the BFF, while the copy still saves", async ({ page }) => {
    const before = (await asStaff().get(PRODUCT_API)).json;
    await open(page, PRODUCT_PAGE);

    await expect(page.getByTestId("product-price")).toBeDisabled();
    await expect(page.getByTestId("product-bulk-price")).toBeDisabled();

    // hidden is not refused: the route handler says no on its own
    const forged = await page.request.patch(`/api/admin/catalog/products/${TEST_PRODUCT}`, {
      data: { price: before.price + 1 },
    });
    expect(forged.status()).toBe(403);

    const blurb = `Edited by staff ${Date.now()}`;
    try {
      await page.getByTestId("product-blurb").fill(blurb);
      await page.getByTestId("product-save").click();
      await expect.poll(async () => (await asStaff().get(PRODUCT_API)).json.blurb).toBe(blurb);
      expect((await asStaff().get(PRODUCT_API)).json.price).toBe(before.price);
    } finally {
      await asOwner().patch(PRODUCT_API, { blurb: before.blurb });
    }
  });

  test("staff cannot add products and get the ladder read-only", async ({ page }) => {
    await open(page, "/catalog");
    await expect(page.getByTestId("product-row").first()).toBeVisible();
    await expect(page.getByTestId("product-new")).toHaveCount(0);

    await open(page, "/catalog/products/new");
    await expect(page.getByTestId("owners-only")).toBeVisible();

    await open(page, "/catalog/pricing");
    await expect(page.getByTestId("tiers-preview")).toBeVisible();
    await expect(page.getByTestId("tier-min")).toHaveCount(0);
    expect((await asStaff().put(TIERS_API, (await asStaff().get(TIERS_API)).json)).status).toBe(403);
  });
});

test.describe("catalog as owner", () => {
  test("the list finds an archived product and opens it", async ({ page }) => {
    await open(page, "/catalog?active=archived");
    await expect(page.getByTestId("product-new")).toBeVisible();

    await page.getByTestId("products-search").fill(TEST_PRODUCT);
    // The search box navigates after a debounce. The archived row is already on
    // screen before that lands, and a click in between is undone when the late
    // navigation carries the page back to the list - so wait for it first.
    await expect(page).toHaveURL(new RegExp(`[?&]q=${TEST_PRODUCT}`));
    const row = page.locator(`[data-testid="product-row"][data-slug="${TEST_PRODUCT}"]`);
    await expect(row).toHaveAttribute("data-active", "false");
    await expect(page.getByTestId("list-range")).toHaveAttribute("data-total", /^[1-9]\d*$/);

    await row.click();
    await expect(page).toHaveURL(new RegExp(`${PRODUCT_PAGE}$`));
    await expect(page.locator("h1")).toBeVisible();
  });

  test("a bulk price above the price is stopped in the form", async ({ page }) => {
    const before = (await asOwner().get(PRODUCT_API)).json;
    await open(page, PRODUCT_PAGE);

    const bulk = page.getByTestId("product-bulk-price");
    await bulk.fill(String(before.price + 10));
    await page.getByTestId("product-save").click();

    await expect(bulk).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('[data-slot="form-message"]').first()).toBeVisible();
    expect((await asOwner().get(PRODUCT_API)).json.bulkPrice).toBe(before.bulkPrice);
  });

  test("a valid price change saves and lands in the history", async ({ page }) => {
    const before = (await asOwner().get(PRODUCT_API)).json;
    const next = before.price + 1.5;
    try {
      await open(page, PRODUCT_PAGE);
      await page.getByTestId("product-price").fill(String(next));
      await page.getByTestId("product-save").click();

      await expect.poll(async () => (await asOwner().get(PRODUCT_API)).json.price).toBe(next);
      await expect(
        page
          .getByTestId("product-history")
          .locator('[data-testid="product-history-entry"][data-action="product.update"]')
          .first(),
      ).toBeVisible();
    } finally {
      await asOwner().patch(PRODUCT_API, { price: before.price });
    }
  });

  test("the on-sale switch saves", async ({ page }) => {
    const before = (await asOwner().get(PRODUCT_API)).json;
    try {
      await open(page, PRODUCT_PAGE);
      const toggle = page.getByTestId("product-active");
      await expect(toggle).toHaveAttribute("data-state", before.active ? "checked" : "unchecked");
      await toggle.click();
      await expect(toggle).toHaveAttribute("data-state", before.active ? "unchecked" : "checked");
      await page.getByTestId("product-save").click();

      await expect.poll(async () => (await asOwner().get(PRODUCT_API)).json.active).toBe(!before.active);
    } finally {
      // the test blank is archived so the storefront never lists it
      await asOwner().patch(PRODUCT_API, { active: before.active });
    }
  });

  test("renaming a colour saves", async ({ page }) => {
    const colorName = async () =>
      ((await asOwner().get(COLORS_API)).json as { slug: string; name: string }[]).find(
        (c) => c.slug === TEST_COLOR,
      )?.name;
    const before = await colorName();
    const name = `E2E Teal ${Date.now() % 100_000}`;
    try {
      await open(page, "/catalog/colors");
      const row = page.locator(`[data-testid="color-row"][data-slug="${TEST_COLOR}"]`);
      await row.getByTestId("color-edit").click();
      await page.getByTestId("color-name").fill(name);
      await page.getByTestId("color-save").click();

      await expect.poll(colorName).toBe(name);
      await expect(row).toContainText(name);
    } finally {
      await asOwner().patch(`${COLORS_API}/${TEST_COLOR}`, { name: before });
    }
  });

  test("a size is created, then deleted after a confirmation", async ({ page }) => {
    const exists = async () =>
      ((await asOwner().get(SIZES_API)).json as { code: string }[]).some((s) => s.code === TEST_SIZE);
    const row = page.locator(`[data-testid="size-row"][data-code="${TEST_SIZE}"]`);
    try {
      await open(page, "/catalog/sizes");
      await page.getByTestId("size-new").click();
      await page.getByTestId("size-code").fill(TEST_SIZE);
      await page.getByTestId("size-label").fill("E2E test");
      await page.getByTestId("size-upcharge").fill("1.25");
      await page.getByTestId("size-save").click();

      await expect(row).toBeVisible();
      await expect.poll(exists).toBe(true);

      await row.getByTestId("size-delete").click();
      await page.getByTestId("size-delete-confirm").click();

      await expect(row).toHaveCount(0);
      await expect.poll(exists).toBe(false);
    } finally {
      // a 404 when the test already deleted it, which is the point
      await asOwner().del(`${SIZES_API}/${TEST_SIZE}`);
    }
  });

  test("a size in the default run offers no delete, and the API refuses one", async ({ page }) => {
    await open(page, "/catalog/sizes");
    const m = page.locator('[data-testid="size-row"][data-code="M"]');
    await expect(m).toBeVisible();
    await expect(m.getByTestId("size-delete")).toHaveCount(0);
    expect((await asOwner().del(`${SIZES_API}/M`)).status).toBe(409);
  });

  test("the tier editor refuses a ladder that does not increase", async ({ page }) => {
    const original = (await asOwner().get(TIERS_API)).json;
    expect(original.tiers.length).toBeGreaterThan(1);
    try {
      await open(page, "/catalog/pricing");
      // the second tier may not start where the first one does
      await page.getByTestId("tier-min").nth(1).fill("1");
      await page.getByTestId("tiers-save").click();

      await expect(page.getByTestId("tiers-error")).toBeVisible();
      expect((await asOwner().get(TIERS_API)).json).toEqual(original);
    } finally {
      await asOwner().put(TIERS_API, original);
    }
  });

  test("a valid ladder change saves, and the original is put back", async ({ page }) => {
    const original = (await asOwner().get(TIERS_API)).json;
    const last = original.tiers.at(-1);
    const moved = last.minQty + 1;
    try {
      await open(page, "/catalog/pricing");
      await page.getByTestId("tier-min").last().fill(String(moved));
      // the preview follows what is typed, before anything is saved
      await expect(page.getByTestId("tiers-preview").locator(`[data-min="${moved}"]`)).toBeVisible();
      await page.getByTestId("tiers-save").click();

      await expect.poll(async () => (await asOwner().get(TIERS_API)).json.tiers.at(-1).minQty).toBe(moved);
    } finally {
      await asOwner().put(TIERS_API, original);
      expect((await asOwner().get(TIERS_API)).json).toEqual(original);
    }
  });
});

test("the storefront's product list no longer takes includeInactive", async () => {
  // it used to list archived blanks to anyone; the back office has its own endpoints now
  const res = await fetch(`${API_ORIGIN}/catalog/products?includeInactive=true`);
  expect(res.status).toBe(400);
});
