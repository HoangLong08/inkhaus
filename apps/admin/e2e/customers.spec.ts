import { expect, test, type Page } from "@playwright/test";

import {
  CUSTOMER_COMPANY,
  CUSTOMER_EMAIL,
  CUSTOMER_LIFETIME_VALUE,
  CUSTOMER_NAME,
  CUSTOMER_PHONE,
  DESIGN_ID,
  ORDER_DELIVERED,
  ORDER_PAID,
} from "./fixtures";
import { api, API_ORIGIN, OWNER_STATE, readToken, STAFF_STATE } from "./helpers";

/**
 * The customer list and profile: search, totals, the history tabs, the edit
 * dialog, and the two things that must never leak - the staff note to the
 * storefront, and a customer's artwork to staff.
 */
test.use({ storageState: OWNER_STATE });

const customerRow = (page: Page, email: string) =>
  page.locator(`[data-testid="customer-row"][data-email="${email}"]`);
const stat = (page: Page, name: string) =>
  page.locator(`[data-testid="customer-stat"][data-stat="${name}"]`);
const tab = (page: Page, name: string) =>
  page.locator(`[data-testid="customer-tab"][data-tab="${name}"]`);
const profileField = (page: Page, field: string) =>
  page.getByTestId("customer-profile").locator(`[data-field="${field}"]`);

/** the fixture customer's id, read through the endpoint the list itself uses */
async function customerId(): Promise<string> {
  const res = await api(readToken(OWNER_STATE)).get(
    `/admin/customers?q=${encodeURIComponent(CUSTOMER_EMAIL)}`,
  );
  expect(res.status).toBe(200);
  const match = (res.json.data as { id: string; email: string }[]).find(
    (customer) => customer.email === CUSTOMER_EMAIL,
  );
  expect(match, "fixture customer missing - run db:seed:e2e").toBeTruthy();
  return match!.id;
}

test.describe("customers", () => {
  test("search finds a customer by part of their email, and anywhere on the row opens them", async ({
    page,
  }) => {
    await page.goto("/customers");
    await page.getByTestId("customers-search").fill("e2e-cust");
    await expect(page).toHaveURL(/[?&]q=e2e-cust/);

    const row = customerRow(page, CUSTOMER_EMAIL);
    await expect(row).toBeVisible();
    const id = await row.getAttribute("data-id");
    expect(id).toBeTruthy();

    // the far end of the row, nowhere near the email - the whole row is the link
    const box = await row.boundingBox();
    await row.click({ position: { x: box!.width - 12, y: box!.height / 2 } });

    await expect(page).toHaveURL(new RegExp(`/customers/${id}$`));
    await expect(page.locator("h1")).toHaveText(CUSTOMER_NAME);
    await expect(profileField(page, "email")).toHaveText(CUSTOMER_EMAIL);
  });

  test("the lifetime value adds up the customer's paid orders", async ({ page }) => {
    await page.goto(`/customers/${await customerId()}`);

    const lifetime = stat(page, "lifetime-value");
    await expect(lifetime).toHaveAttribute("data-value", String(CUSTOMER_LIFETIME_VALUE));
    // compared on the amount, not on how the currency is spelled
    await expect(lifetime).toContainText(CUSTOMER_LIFETIME_VALUE.toFixed(2));
    await expect(stat(page, "orders")).toHaveAttribute("data-value", "3");
  });

  test("the orders tab lists the customer's orders and links to the full history", async ({
    page,
  }) => {
    await page.goto(`/customers/${await customerId()}`);

    await expect(tab(page, "orders")).toHaveAttribute("data-state", "active");
    for (const number of [ORDER_PAID, ORDER_DELIVERED]) {
      await expect(
        page.locator(`[data-testid="customer-order-row"][data-number="${number}"]`),
      ).toBeVisible();
    }
    await expect(page.getByTestId("customer-orders-all")).toHaveAttribute(
      "href",
      `/orders?q=${encodeURIComponent(CUSTOMER_EMAIL)}`,
    );
  });

  test("an edit to phone, company and note survives a reload, and the note stays in the back office", async ({
    page,
  }) => {
    const id = await customerId();
    const phone = "555-0199";
    const company = "Ridgeline FC Reserves";
    const note = `E2E note ${Date.now()} - pays on 30-day terms`;

    try {
      await page.goto(`/customers/${id}`);
      await page.getByTestId("customer-edit-open").click();

      const dialog = page.getByTestId("customer-edit-dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByTestId("customer-phone").fill(phone);
      await dialog.getByTestId("customer-company").fill(company);
      await dialog.getByTestId("customer-note").fill(note);
      await dialog.getByTestId("customer-save").click();

      await expect(dialog).toBeHidden();
      await expect(profileField(page, "phone")).toHaveText(phone);

      await page.reload();
      await expect(profileField(page, "phone")).toHaveText(phone);
      await expect(profileField(page, "company")).toHaveText(company);
      await expect(profileField(page, "note")).toHaveText(note);
      // the name was not touched, so it was not sent and did not change
      await expect(page.locator("h1")).toHaveText(CUSTOMER_NAME);

      // The storefront's view of this customer: the public order page carries
      // their name and email, and must carry nothing else about them.
      const publicOrder = await fetch(`${API_ORIGIN}/orders/${ORDER_PAID}`);
      expect(publicOrder.ok).toBe(true);
      const body = await publicOrder.text();
      expect(body).not.toContain(note);
      expect(body).not.toContain("adminNote");
    } finally {
      const reset = await api(readToken(OWNER_STATE)).patch(`/admin/customers/${id}`, {
        phone: CUSTOMER_PHONE,
        company: CUSTOMER_COMPANY,
        adminNote: null,
      });
      expect(reset.status).toBe(200);
    }
  });

  test("the email cannot be changed, through the back office or the API", async ({ page }) => {
    const id = await customerId();
    const owner = api(readToken(OWNER_STATE));
    const other = "e2e-someone-else@inkhaus.test";

    expect((await owner.patch(`/admin/customers/${id}`, { email: other })).status).toBe(400);
    const viaBff = await page.request.patch(`/api/admin/customers/${id}`, { data: { email: other } });
    expect(viaBff.status()).toBe(400);

    expect((await owner.get(`/admin/customers/${id}`)).json.email).toBe(CUSTOMER_EMAIL);
  });

  test("an owner sees the customer's saved designs", async ({ page }) => {
    const id = await customerId();
    await page.goto(`/customers/${id}`);
    await tab(page, "designs").click();

    const design = page.locator(`[data-testid="customer-design"][data-design="${DESIGN_ID}"]`);
    await expect(design).toBeVisible();
    await expect(design.locator("img")).toHaveAttribute(
      "src",
      `/api/admin/designs/${DESIGN_ID}/preview/front`,
    );

    // the list the tab reads carries labels and flags, never the artwork itself
    const listed = await api(readToken(OWNER_STATE)).get(`/admin/designs?customerId=${id}`);
    expect(listed.status).toBe(200);
    expect(listed.json).toEqual(
      expect.arrayContaining([expect.objectContaining({ publicId: DESIGN_ID, hasFront: true })]),
    );
    expect(listed.text).not.toContain("data:image");
    expect(listed.text).not.toContain("scene");
  });

  test("staff get no designs tab - not a disabled one, none at all", async ({ browser }) => {
    const id = await customerId();
    const context = await browser.newContext({ storageState: STAFF_STATE });
    const page = await context.newPage();
    try {
      await page.goto(`/customers/${id}`);
      await expect(tab(page, "orders")).toBeVisible();
      await expect(tab(page, "designs")).toHaveCount(0);
      await expect(page.getByTestId("customer-design")).toHaveCount(0);
      // nor anywhere in the document, the serialized server payload included
      expect(await page.content()).not.toContain(DESIGN_ID);
      // and the API refuses the list outright - hiding the tab is not the guard
      const listed = await api(readToken(STAFF_STATE)).get(`/admin/designs?customerId=${id}`);
      expect(listed.status).toBe(403);

      // staff may still edit a customer
      await expect(page.getByTestId("customer-edit-open")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
