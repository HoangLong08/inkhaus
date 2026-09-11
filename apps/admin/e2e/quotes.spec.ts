import { expect, test, type Page } from "@playwright/test";

import {
  QUOTE_COMPANY,
  QUOTE_CONTACTED_EMAIL,
  QUOTE_CONVERT_EMAIL,
  QUOTE_NEW_EMAIL,
  QUOTE_PRODUCT,
} from "./fixtures";
import { api, OWNER_STATE, pickOption, readToken, STAFF_STATE } from "./helpers";

/**
 * Bulk quotes: the list's filters, triage on the detail page, and conversion
 * into a draft order. Every fixture here is rebuilt by the seed on each run -
 * see `seedQuotes` - including deleting the order the conversion test makes.
 */
test.use({ storageState: OWNER_STATE });

/** a fixture quote's id, read back through the API rather than off the screen */
async function quoteId(email: string): Promise<string> {
  const res = await api(readToken(OWNER_STATE)).get(
    `/admin/bulk-quotes?q=${encodeURIComponent(email)}`,
  );
  expect(res.status, "quote lookup").toBe(200);
  const match = (res.json.data as { id: string; email: string }[]).find((q) => q.email === email);
  expect(match, `no fixture quote for ${email} - run db:seed:e2e`).toBeTruthy();
  return match!.id;
}

const events = (page: Page, kind: string) =>
  page.locator(`[data-testid="quote-event"][data-kind="${kind}"]:not([data-pending])`);

test.describe("quote list", () => {
  test("searching by company finds the one quote from it", async ({ page }) => {
    const id = await quoteId(QUOTE_NEW_EMAIL);

    await page.goto("/quotes");
    await page.getByTestId("quotes-search").fill(QUOTE_COMPANY);

    const rows = page.getByTestId("quote-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-id", id);

    // the whole row opens the quote
    await rows.first().getByTestId("quote-row-link").click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${id}$`));
    await expect(page.getByTestId("quote-timeline")).toBeVisible();
  });

  test("staff find the quote assigned to them under Mine, flagged overdue", async ({ browser }) => {
    const [contacted, unassigned] = await Promise.all([
      quoteId(QUOTE_CONTACTED_EMAIL),
      quoteId(QUOTE_CONVERT_EMAIL),
    ]);

    const context = await browser.newContext({ storageState: STAFF_STATE });
    const page = await context.newPage();
    try {
      await page.goto("/quotes?assignee=me");
      await expect(
        page.locator('[data-testid="filter-link"][data-param="assignee"][data-value="me"]'),
      ).toHaveAttribute("aria-current", "page");

      const row = page.locator(`[data-testid="quote-row"][data-id="${contacted}"]`);
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute("data-status", "CONTACTED");
      await expect(row).toHaveAttribute("data-overdue", "true");
      await expect(page.locator(`[data-testid="quote-row"][data-id="${unassigned}"]`)).toHaveCount(0);

      // the same lead is what the Overdue filter is for
      await page.goto("/quotes?followUp=overdue");
      await expect(page.locator(`[data-testid="quote-row"][data-id="${contacted}"]`)).toBeVisible();
    } finally {
      await context.close();
    }
  });
});

test.describe("quote detail", () => {
  test("assigning, scheduling, noting and moving a quote each leave an event", async ({ page }) => {
    const id = await quoteId(QUOTE_NEW_EMAIL);
    await page.goto(`/quotes/${id}`);
    await expect(events(page, "RECEIVED")).toHaveCount(1);

    await pickOption(page, "quote-assignee-select", "quote-assignee-option", "data-self", "true");
    await expect(events(page, "ASSIGNED")).toHaveCount(1);
    await expect(page.getByTestId("quote-assignee-select")).not.toHaveAttribute("data-assignee", "none");

    await page.getByTestId("quote-follow-up-trigger").click();
    await page.locator('[data-testid="quote-follow-up-day"][data-today="true"]').click();
    await expect(events(page, "FOLLOW_UP")).toHaveCount(1);
    await expect(page.getByTestId("quote-follow-up-trigger")).toHaveAttribute(
      "data-day",
      /^\d{4}-\d{2}-\d{2}$/,
    );

    await page.getByTestId("quote-note-input").fill("Sent the league a sample pack.");
    await page.getByTestId("quote-note-save").click();
    await expect(events(page, "NOTE")).toHaveCount(1);

    await pickOption(page, "quote-select", "quote-option", "data-status", "CONTACTED");
    await expect(page.getByTestId("quote-select")).toHaveAttribute("data-status", "CONTACTED");
    await expect(events(page, "STATUS")).toHaveCount(1);

    // what the page showed is what was stored, and every entry says who did it
    const stored = await api(readToken(OWNER_STATE)).get(`/admin/bulk-quotes/${id}`);
    const kinds = (stored.json.events as { kind: string; actor: unknown }[]).map((e) => e.kind);
    expect(kinds.sort()).toEqual(["ASSIGNED", "FOLLOW_UP", "NOTE", "STATUS"]);
    for (const event of stored.json.events) expect(event.actor).not.toBeNull();
  });

  test("a quote becomes a draft order once, and only once", async ({ page }) => {
    const id = await quoteId(QUOTE_CONVERT_EMAIL);
    await page.goto(`/quotes/${id}`);

    await page.getByTestId("quote-convert-open").click();
    const dialog = page.getByTestId("quote-convert-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("convert-product").click();
    await page.locator(`[data-testid="convert-product-option"][data-slug="${QUOTE_PRODUCT}"]`).click();
    await expect(page.getByTestId("convert-product")).toHaveAttribute("data-slug", QUOTE_PRODUCT);

    await page.getByTestId("convert-color").click();
    await page.getByTestId("convert-color-option").first().click();
    await page.getByTestId("convert-method").click();
    await page.getByTestId("convert-method-option").first().click();
    const colorSlug = await page.getByTestId("convert-color").getAttribute("data-slug");
    const method = await page.getByTestId("convert-method").getAttribute("data-method");
    expect(colorSlug).toBeTruthy();
    expect(method).toBeTruthy();

    await dialog.locator('[data-testid="convert-size-qty"][data-size="M"]').fill("24");
    await dialog.locator('[data-testid="convert-size-qty"][data-size="L"]').fill("24");
    const estimate = page.getByTestId("convert-estimate");
    await expect(estimate).not.toBeEmpty();
    await expect(estimate).toHaveAttribute("data-units", "48");

    await page.getByTestId("convert-submit").click();
    await page.waitForURL(/\/orders\/INK-\d+$/);
    const number = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
    await expect(page.locator('[data-testid="status-badge"][data-status="DRAFT"]').first()).toBeVisible();
    // The order page's `quote-origin-link` belongs to the order-detail
    // workstream and is not in this branch; its spec, or Phase 2, asserts it.

    await page.goto(`/quotes/${id}`);
    await expect(page.getByTestId("quote-select")).toHaveAttribute("data-status", "WON");
    await expect(page.getByTestId("quote-order-link")).toHaveAttribute(
      "href",
      `/orders/${encodeURIComponent(number)}`,
    );
    await expect(page.getByTestId("quote-convert-open")).toHaveCount(0);
    await expect(events(page, "CONVERTED")).toHaveCount(1);

    // the UI no longer offers it; the API refuses it outright
    const again = await api(readToken(OWNER_STATE)).post(`/admin/bulk-quotes/${id}/convert`, {
      productSlug: QUOTE_PRODUCT,
      colorSlug,
      method,
      sizes: [{ size: "M", qty: 24 }],
    });
    expect(again.status).toBe(409);
  });
});
