import { expect, test } from "@playwright/test";

import {
  allowedTransitions,
  API_ORIGIN,
  findActionableOrder,
  sessionToken,
  signIn,
  signOut,
} from "./helpers";

/** PATCH an order status straight at the API, bypassing the UI entirely */
async function patchStatus(token: string, number: string, status: string) {
  return fetch(`${API_ORIGIN}/orders/${encodeURIComponent(number)}/status`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ status, note: "e2e" }),
  });
}

test.describe("roles", () => {
  test("an owner is offered the destructive transitions", async ({ page }) => {
    await signIn(page, "owner");
    const token = await sessionToken(page);
    const number = await findActionableOrder(token);

    await page.goto(`/orders/${number}`);
    const options = await allowedTransitions(page);

    expect(options).toContain("Paid");
    expect(options).toContain("Cancelled");
  });

  test("staff are not offered cancel or refund", async ({ page }) => {
    await signIn(page, "owner");
    const number = await findActionableOrder(await sessionToken(page));

    await signOut(page);
    await signIn(page, "staff");

    await page.goto(`/orders/${number}`);
    const options = await allowedTransitions(page);

    expect(options, "staff still run production").toContain("Paid");
    expect(options, "but may not cancel").not.toContain("Cancelled");
    expect(options).not.toContain("Refunded");
  });

  test("staff calling the API directly are refused, not merely hidden from", async ({ page }) => {
    await signIn(page, "staff");
    const token = await sessionToken(page);
    const number = await findActionableOrder(token);

    // the UI never offers this; a hand-made request must still bounce
    const refused = await patchStatus(token, number, "CANCELLED");
    expect(refused.status).toBe(403);

    // and the order is untouched
    const after = await fetch(`${API_ORIGIN}/orders/${number}`).then((r) => r.json());
    expect(after.status).toBe("PENDING_PAYMENT");
  });

  test("staff can still advance an order through production", async ({ page }) => {
    await signIn(page, "staff");
    const token = await sessionToken(page);
    const number = await findActionableOrder(token);

    const ok = await patchStatus(token, number, "PAID");
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("PAID");

    // an owner can then take it somewhere staff could not
    await signOut(page);
    await signIn(page, "owner");

    const ownerToken = await sessionToken(page);
    const refund = await patchStatus(ownerToken, number, "REFUNDED");
    expect(refund.status).toBe(200);
  });

  test("the designs endpoints are owner-only", async ({ page }) => {
    await signIn(page, "staff");
    const staffToken = await sessionToken(page);

    const asStaff = await fetch(`${API_ORIGIN}/designs?email=nobody@example.com`, {
      headers: { authorization: `Bearer ${staffToken}` },
    });
    expect(asStaff.status).toBe(403);

    await signOut(page);
    await signIn(page, "owner");

    const asOwner = await fetch(`${API_ORIGIN}/designs?email=nobody@example.com`, {
      headers: { authorization: `Bearer ${await sessionToken(page)}` },
    });
    expect(asOwner.status).toBe(200);
  });

  test("the sidebar names the signed-in user and role", async ({ page }) => {
    await signIn(page, "staff");
    // NavUser's one line is `name ?? email` plus the role, and Google supplied
    // a display name. Located by testid so a copy tweak is not a test failure.
    await expect(page.getByTestId("current-user")).toHaveText("E2E Staff · staff");
  });
});
