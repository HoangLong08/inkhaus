import { expect, test } from "@playwright/test";

import { findActionableOrder, sessionToken, signIn, signOut } from "./helpers";

/**
 * Behaviour the shadcn/TanStack Query rebuild introduced, and which nothing else
 * in this suite would notice going missing: the BFF's failure shape, optimistic
 * updates, the breadcrumb, and the sidebar's persisted state.
 */
test.describe("back office UI", () => {
  test("the BFF answers a cookie-less fetch with 401 JSON, not an HTML login page", async ({
    request,
  }) => {
    // No session cookie in this context. `proxy.ts` used to redirect this to
    // /login, which fetch follows - the caller then gets a 200 with a document
    // in the body and only finds out when res.json() throws.
    const res = await request.get("/api/admin/orders");

    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(await res.json()).toHaveProperty("error");
  });

  test("a status the role forbids is refused by the BFF, not merely hidden", async ({ page }) => {
    await signIn(page, "owner");
    const number = await findActionableOrder(await sessionToken(page));

    await signOut(page);
    await signIn(page, "staff");
    await page.goto(`/orders/${number}`);

    // Hand-made: the select never offers CANCELLED to staff, so this is the
    // request a determined operator would craft in the console.
    const refused = await page.evaluate(async (orderNumber) => {
      const res = await fetch(`/api/admin/orders/${orderNumber}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED", note: "e2e" }),
      });
      return { status: res.status, body: await res.json() };
    }, number);

    expect(refused.status, "staff may not cancel").toBe(403);
    expect(refused.body.error).toContain("owner");
  });

  test("advancing an order updates the badge and timeline without a reload", async ({ page }) => {
    await signIn(page, "owner");
    const number = await findActionableOrder(await sessionToken(page));
    await page.goto(`/orders/${number}`);

    const before = await page.getByTestId("order-timeline").locator("li").count();

    await page.getByTestId("status-select").click();
    await page.getByTestId("status-option").filter({ hasText: "Paid" }).click();
    await page.getByTestId("status-save").click();

    // The badge beside the heading and the timeline are separate client leaves
    // reading one cache entry, so both move on the optimistic write.
    await expect(page.getByTestId("status-badge").first()).toHaveAttribute("data-status", "PAID");
    await expect(page.getByTestId("order-timeline").locator("li")).toHaveCount(before + 1);
    await expect(page.getByText("Moved to Paid")).toBeVisible();
  });

  test("the breadcrumb tracks the route", async ({ page }) => {
    await signIn(page, "owner");
    await expect(page.getByTestId("breadcrumb-current")).toHaveText("Overview");

    await page.goto("/quotes");
    await expect(page.getByTestId("breadcrumb-current")).toHaveText("Bulk quotes");

    // Any order will do - this is about routing, not order state. Deliberately
    // NOT findActionableOrder: the seed ships two PENDING_PAYMENT orders and the
    // tests above spend both, so depending on one here makes this fail on
    // fixture exhaustion rather than on anything to do with breadcrumbs.
    await page.goto("/orders");
    const row = page.getByTestId("order-row").first();
    const number = await row.getAttribute("data-number");
    expect(number, "expected at least one order in the list").toBeTruthy();

    await page.goto(`/orders/${number}`);
    await expect(page.getByTestId("breadcrumb-current")).toHaveText(number!);
  });

  test("the collapsed sidebar survives a reload", async ({ page }) => {
    await signIn(page, "owner");

    await page.getByTestId("sidebar-toggle").click();
    // written by SidebarProvider, read back server side in (dash)/layout.tsx so
    // the rail never renders open and then snaps shut
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies();
        return cookies.find((c) => c.name === "sidebar_state")?.value;
      })
      .toBe("false");

    await page.reload();
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state", "collapsed");
  });
});
