import { expect, test, type Page } from "@playwright/test";

import { DESIGN_ID, ORDER_IN_PRODUCTION, ORDER_PAID } from "./fixtures";
import { API_ORIGIN, api, findActionableOrder, OWNER_STATE, pickOption, readToken } from "./helpers";

/**
 * The order detail page: a final move asks first, shipping needs tracking,
 * staff notes stay staff-only, and the artwork, customer and packing slip are
 * all reachable. Owner state throughout - the role rules have their own specs
 * (rbac, ui); this one is about what the page does.
 */
test.use({ storageState: OWNER_STATE });

const ownerApi = () => api(readToken(OWNER_STATE));

/** the badge beside the heading - the first on the page, ahead of the timeline's */
const headerBadge = (page: Page) => page.getByTestId("status-badge").first();

const timelineEvents = (page: Page, kind?: string) =>
  page.locator(
    kind ? `[data-testid="timeline-event"][data-kind="${kind}"]` : '[data-testid="timeline-event"]',
  );

test.describe("order detail", () => {
  test("a final move asks first: backing out changes nothing, confirming cancels", async ({
    page,
  }) => {
    const number = await findActionableOrder(readToken(OWNER_STATE));
    await page.goto(`/orders/${number}`);
    await expect(headerBadge(page)).toHaveAttribute("data-status", "PENDING_PAYMENT");
    const before = await timelineEvents(page).count();

    await pickOption(page, "status-select", "status-option", "data-status", "CANCELLED");
    await page.getByTestId("status-save").click();
    const dialog = page.getByTestId("status-confirm-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("status-confirm-cancel").click();
    await expect(dialog).toBeHidden();
    await expect(headerBadge(page)).toHaveAttribute("data-status", "PENDING_PAYMENT");
    await expect(timelineEvents(page)).toHaveCount(before);
    // nothing was sent, not merely nothing shown
    expect((await ownerApi().get(`/admin/orders/${number}`)).json.status).toBe("PENDING_PAYMENT");

    // the form still holds CANCELLED; this time go through with it
    await page.getByTestId("status-save").click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("status-confirm").click();

    await expect(headerBadge(page)).toHaveAttribute("data-status", "CANCELLED");
    await expect(timelineEvents(page).last()).toHaveAttribute("data-status", "CANCELLED");
    await expect(page.getByTestId("no-moves")).toBeVisible();
    await expect
      .poll(async () => (await ownerApi().get(`/admin/orders/${number}`)).json.status)
      .toBe("CANCELLED");
  });

  test("shipping needs tracking, and records both the move and the parcel", async ({ page }) => {
    await page.goto(`/orders/${ORDER_IN_PRODUCTION}`);
    await expect(headerBadge(page)).toHaveAttribute("data-status", "IN_PRODUCTION");

    await pickOption(page, "status-select", "status-option", "data-status", "SHIPPED");
    const trackingNumber = page.getByTestId("status-tracking-number");
    await expect(trackingNumber).toBeVisible();

    // refused by the form before any request, with the reason next to the field
    await page.getByTestId("status-save").click();
    await expect(trackingNumber).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('[data-slot="form-message"]').first()).toBeVisible();
    await expect(headerBadge(page)).toHaveAttribute("data-status", "IN_PRODUCTION");

    const parcel = `1ZE2E${Date.now()}`;
    await pickOption(
      page,
      "status-tracking-carrier",
      "status-tracking-carrier-option",
      "data-carrier",
      "UPS",
    );
    await trackingNumber.fill(parcel);
    await page.getByTestId("status-save").click();

    await expect(headerBadge(page)).toHaveAttribute("data-status", "SHIPPED");
    await expect(
      page.locator('[data-testid="timeline-event"][data-kind="STATUS"][data-status="SHIPPED"]'),
    ).toHaveCount(1);
    await expect(timelineEvents(page, "TRACKING")).toHaveCount(1);
    await expect(page.getByTestId("tracking-link")).toHaveAttribute("href", new RegExp(parcel));

    // and the API holds the same
    const saved = (await ownerApi().get(`/admin/orders/${ORDER_IN_PRODUCTION}`)).json;
    expect(saved.status).toBe("SHIPPED");
    expect(saved.tracking).toMatchObject({ carrier: "UPS", number: parcel });
  });

  test("an internal note is signed by its author and never reaches the customer", async ({
    page,
  }) => {
    const text = `e2e internal note ${Date.now()}`;
    await page.goto(`/orders/${ORDER_PAID}`);

    await page.getByTestId("order-note-input").fill(text);
    await page.getByTestId("order-note-save").click();

    // matched on the text this test wrote, which is data rather than UI copy
    const note = timelineEvents(page, "NOTE").filter({ hasText: text });
    await expect(note).toHaveCount(1);
    await expect(note.getByTestId("timeline-actor")).not.toBeEmpty();
    await expect(page.getByTestId("order-note-input")).toHaveValue("");

    const detail = (await ownerApi().get(`/admin/orders/${ORDER_PAID}`)).json;
    const saved = detail.timeline.find((entry: { note: string | null }) => entry.note === text);
    expect(saved).toMatchObject({ kind: "NOTE", status: "PAID" });
    expect(saved.actor).not.toBeNull();

    // the storefront's order lookup - no token at all - has none of it
    const res = await fetch(`${API_ORIGIN}/orders/${ORDER_PAID}`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain(text);
    for (const entry of JSON.parse(body).timeline) {
      expect(entry.kind).not.toBe("NOTE");
      expect(entry).not.toHaveProperty("actor");
    }
  });

  test("the artwork is a same-origin image, and only the sides that exist are drawn", async ({
    page,
  }) => {
    await page.goto(`/orders/${ORDER_PAID}`);

    const front = page.locator(
      `[data-testid="design-preview"][data-design="${DESIGN_ID}"][data-side="front"]`,
    );
    await expect(front).toBeVisible();
    await expect
      .poll(() => front.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    const src = await front.evaluate((img: HTMLImageElement) => img.src);
    expect(new URL(src).origin).toBe(new URL(page.url()).origin);

    // the route answers with the decoded bytes, private to this viewer
    const image = await page.request.get(src);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
    expect(image.headers()["cache-control"]).toContain("private");

    // the fixture saved no back
    await expect(
      page.locator(`[data-testid="design-preview"][data-design="${DESIGN_ID}"][data-side="back"]`),
    ).toHaveCount(0);
  });

  test("the customer and the packing slip are one click away", async ({ page }) => {
    await page.goto(`/orders/${ORDER_PAID}`);
    await expect(page.getByTestId("customer-link")).toHaveAttribute("href", /^\/customers\//);

    await page.getByTestId("packing-slip-link").click();
    await expect(page).toHaveURL(new RegExp(`/orders/${ORDER_PAID}/packing-slip$`));

    const slip = page.getByTestId("packing-slip");
    await expect(slip).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByTestId("packing-slip-print")).toBeVisible();

    // the fixture's two sizes, M and 2XL - and no money anywhere on the page.
    // Rows only: shadcn's Button stamps its own `data-size` on the print and
    // back buttons, which sit inside the slip too.
    await expect(slip.locator("tr[data-size]")).toHaveCount(2);
    expect(await slip.innerText()).not.toContain("$");
  });

  test("the API refuses a status note over the limit, and the order stays put", async () => {
    const client = ownerApi();
    // ORDER_NOTE_MAX is 500
    const res = await client.patch(`/admin/orders/${ORDER_PAID}/status`, {
      status: "IN_PRODUCTION",
      note: "x".repeat(501),
    });
    expect(res.status).toBe(400);
    expect((await client.get(`/admin/orders/${ORDER_PAID}`)).json.status).toBe("PAID");
  });

  test("the admin endpoint refuses what cannot be an order number, and 404s what does not exist", async () => {
    const client = ownerApi();
    expect((await client.get("/admin/orders/%3Cscript%3E")).status).toBe(400);
    expect((await client.get("/admin/orders/INK-999999999")).status).toBe(404);
  });
});
