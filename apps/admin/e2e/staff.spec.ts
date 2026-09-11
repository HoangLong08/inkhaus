import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";

import { INVITEE_PREFIX, STAFF_EMAIL } from "./fixtures";
import { api, OWNER_STATE, pickOption, readToken, signIn, STAFF_STATE } from "./helpers";

/**
 * The Staff screen: the sign-in allowlist, owner-only in all three places.
 *
 * THIS FILE MUST SORT AFTER EVERY SPEC THAT USES STAFF_STATE. Its last two
 * tests end every session e2e-staff has - including the one auth.setup saved to
 * STAFF_STATE - so a spec running after it with that state would find itself
 * signed out. Every spec alphabetically before "staff" may use it; the two after
 * it, ui.spec and zz-rate-limit.spec, sign in fresh. A new spec that needs
 * STAFF_STATE has to sort before this one.
 *
 * Order inside the file matters for the same reason: the STAFF_STATE test runs
 * first. No bootstrap owner is changed here - the signed-in owner's own row is
 * only used to prove it cannot be. Invitees are `INVITEE_PREFIX+<timestamp>`,
 * which the next seed deletes, and e2e-staff is reactivated in a `finally`.
 */
test.use({ storageState: OWNER_STATE });

/** a context with no cookies at all, for signing in as somebody else */
const SIGNED_OUT = { cookies: [], origins: [] };

type Member = { id: string; email: string; role: string; isActive: boolean; isSelf: boolean };

const row = (page: Page, email: string) =>
  page.locator(`[data-testid="staff-row"][data-email=${JSON.stringify(email)}]`);

async function member(token: string, find: (m: Member) => boolean) {
  const res = await api(token).get<{ data: Member[] }>("/admin/staff");
  expect(res.status, "the owner's staff list").toBe(200);
  const found = res.json.data.find(find);
  expect(found, "that account is not on the staff list").toBeTruthy();
  return found!;
}

/**
 * Every row has a role select, so the shared `pickOption` - which finds its
 * trigger by testid across the whole page - cannot tell them apart. The options
 * portal out of the row, so they are found on the page.
 */
async function pickRole(page: Page, target: Locator, role: "OWNER" | "STAFF") {
  await target.getByTestId("staff-role-select").click();
  await page.locator(`[data-testid="staff-role-option"][data-role="${role}"]`).click();
  await expect(page.getByTestId("staff-role-option")).toHaveCount(0);
  await expect(target).toHaveAttribute("data-role", role);
}

async function deactivate(page: Page, target: Locator) {
  await target.getByTestId("staff-active").click();
  await page.getByTestId("staff-deactivate-confirm").click();
  await expect(target).toHaveAttribute("data-active", "false");
}

/** a second browser, signed in as e2e-staff through the real flow and parked on /orders */
async function signedInStaff(browser: Browser) {
  const context = await browser.newContext({ storageState: SIGNED_OUT });
  const page = await context.newPage();
  await signIn(page, "staff");
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/orders/);
  return { context, page };
}

test("staff are refused by the page, the BFF and the API", async ({ browser }) => {
  const context = await browser.newContext({ storageState: STAFF_STATE });
  const page = await context.newPage();
  const invitee = { email: `${INVITEE_PREFIX}+refused-${Date.now()}@inkhaus.test`, role: "STAFF" };

  try {
    await page.goto("/staff");
    await expect(page.getByTestId("owners-only")).toBeVisible();
    await expect(page.getByTestId("staff-row")).toHaveCount(0);

    // the BFF, with the browser's own cookie - what a hand-made fetch reaches
    expect((await page.request.get("/api/admin/staff")).status()).toBe(403);
    expect((await page.request.post("/api/admin/staff", { data: invitee })).status()).toBe(403);

    // and the API itself, which refuses before it even looks for the account
    const asStaff = api(readToken(STAFF_STATE));
    expect((await asStaff.get("/admin/staff")).status).toBe(403);
    expect((await asStaff.post("/admin/staff", invitee)).status).toBe(403);
    expect((await asStaff.patch("/admin/staff/anyone", { isActive: false })).status).toBe(403);
    expect((await asStaff.del("/admin/staff/anyone/sessions")).status).toBe(403);
  } finally {
    await context.close();
  }
});

test("an owner invites someone, promotes and demotes them, then deactivates them", async ({
  page,
}) => {
  const token = readToken(OWNER_STATE);
  const email = `${INVITEE_PREFIX}+${Date.now()}@inkhaus.test`;

  await page.goto("/staff");
  await page.getByTestId("staff-invite-open").click();
  const dialog = page.getByTestId("staff-invite-dialog");
  await expect(dialog).toBeVisible();

  // typed the way people paste addresses; it is stored the way sign-in compares it
  await dialog.getByTestId("staff-invite-email").fill(`  ${email.toUpperCase()} `);
  await dialog.getByTestId("staff-invite-name").fill("E2E Invitee");
  await pickOption(page, "staff-invite-role", "staff-invite-role-option", "data-role", "STAFF");
  await dialog.getByTestId("staff-invite-submit").click();
  await expect(dialog).toBeHidden();

  const invited = row(page, email);
  await expect(invited).toBeVisible();
  await expect(invited).toHaveAttribute("data-role", "STAFF");
  await expect(invited).toHaveAttribute("data-active", "true");
  await expect(invited).toHaveAttribute("data-self", "false");

  // the same address twice is refused upstream, whatever the screen would do
  expect((await api(token).post("/admin/staff", { email, role: "STAFF" })).status).toBe(409);

  await pickRole(page, invited, "OWNER");
  await expect.poll(async () => (await member(token, (m) => m.email === email)).role).toBe("OWNER");

  await pickRole(page, invited, "STAFF");
  await expect.poll(async () => (await member(token, (m) => m.email === email)).role).toBe("STAFF");

  await deactivate(page, invited);
  await expect
    .poll(async () => (await member(token, (m) => m.email === email)).isActive)
    .toBe(false);

  // the server's answer, not the optimistic cache's
  await page.reload();
  await expect(row(page, email)).toHaveAttribute("data-active", "false");
});

test("your own row is locked, and the BFF and the API refuse a change to yourself", async ({
  page,
}) => {
  const token = readToken(OWNER_STATE);

  await page.goto("/staff");
  const self = page.locator('[data-testid="staff-row"][data-self="true"]');
  await expect(self).toHaveCount(1);
  await expect(self.getByTestId("staff-role-select")).toBeDisabled();
  await expect(self.getByTestId("staff-active")).toBeDisabled();
  await expect(self.getByTestId("staff-revoke-sessions")).toBeDisabled();

  const me = await member(token, (m) => m.isSelf);
  const asOwner = api(token);
  expect((await asOwner.patch(`/admin/staff/${me.id}`, { isActive: false })).status).toBe(400);
  expect((await asOwner.patch(`/admin/staff/${me.id}`, { role: "STAFF" })).status).toBe(400);
  expect((await asOwner.del(`/admin/staff/${me.id}/sessions`)).status).toBe(400);

  // the BFF refuses it before the round trip, with the same status
  const viaBff = await page.request.patch(`/api/admin/staff/${me.id}`, {
    data: { isActive: false },
  });
  expect(viaBff.status()).toBe(400);

  expect(await member(token, (m) => m.isSelf)).toMatchObject({ role: "OWNER", isActive: true });
});

test("signing a colleague out ends their session on their next request", async ({
  page,
  browser,
}) => {
  const staff = await signedInStaff(browser);
  try {
    await page.goto("/staff");
    const target = row(page, STAFF_EMAIL);
    await target.getByTestId("staff-revoke-sessions").click();
    await expect(page.getByTestId("staff-revoke-dialog")).toBeVisible();
    // The row updates optimistically; the colleague's next request only fails
    // once the DELETE has actually ended their sessions, so wait for it.
    const revoked = page.waitForResponse(
      (res) => res.url().includes("/api/admin/staff/") && res.url().endsWith("/sessions") && res.request().method() === "DELETE",
    );
    await page.getByTestId("staff-revoke-confirm").click();
    expect((await revoked).ok(), "the sessions were ended server side").toBe(true);
    await expect(page.getByTestId("staff-revoke-dialog")).toBeHidden();

    // nothing left to end - and their access is untouched, which is the
    // difference from deactivating
    await expect(target.getByTestId("staff-revoke-sessions")).toBeDisabled();
    await expect(target).toHaveAttribute("data-active", "true");

    await staff.page.goto("/orders");
    await expect(staff.page).toHaveURL(/\/login/);
  } finally {
    await staff.context.close();
  }
});

// Last on purpose - see the header. It also ends the STAFF_STATE session.
test("deactivating a colleague signs them out on their very next request", async ({
  page,
  browser,
}) => {
  const token = readToken(OWNER_STATE);
  const { id } = await member(token, (m) => m.email === STAFF_EMAIL);
  const staff = await signedInStaff(browser);

  try {
    await page.goto("/staff");
    const target = row(page, STAFF_EMAIL);
    await expect(target).toHaveAttribute("data-active", "true");
    await deactivate(page, target);

    await staff.page.goto("/orders");
    await expect(staff.page).toHaveURL(/\/login/);
  } finally {
    await staff.context.close();
    // Put the fixture back whatever happened above. Soft, so a failure here is
    // reported without hiding the one that got us into the finally.
    const restored = await api(token).patch(`/admin/staff/${id}`, { isActive: true });
    expect.soft(restored.status, "reactivating e2e-staff").toBe(200);
  }
});
