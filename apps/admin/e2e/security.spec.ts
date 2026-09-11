import { expect, test } from "@playwright/test";

import { QUOTE_CONTACTED_EMAIL } from "./fixtures";
import { api, OWNER_STATE, readToken } from "./helpers";

/**
 * CSRF on the BFF, and what a route handler does with input it cannot use.
 *
 * The session cookie is SameSite=Lax, which keeps it off a request from another
 * site but not off one from another origin on the same site - and the
 * storefront on :4321 is the same site as this app. proxy.ts therefore refuses
 * a write to /api/admin/* that a browser says came from anywhere else, and one
 * whose body is not JSON: a form can post text/plain without a preflight, never
 * application/json.
 *
 * `page.request` carries the page's cookies but is not a browser fetch: it sends
 * only the headers it is given. That is what lets these tests forge the ones a
 * hostile page's browser would send - and why, with none of them, it passes.
 */
test.use({ storageState: OWNER_STATE });

/** a same-site origin that is not this app: the storefront */
const OTHER_ORIGIN = "http://localhost:4321";

async function quoteId(email: string): Promise<string> {
  const res = await api(readToken(OWNER_STATE)).get(
    `/admin/bulk-quotes?q=${encodeURIComponent(email)}`,
  );
  expect(res.status, "quote lookup").toBe(200);
  const match = (res.json.data as { id: string; email: string }[]).find((q) => q.email === email);
  expect(match, `no fixture quote for ${email} - run db:seed:e2e`).toBeTruthy();
  return match!.id;
}

/** every note on the quote, read straight from the API */
async function notes(id: string): Promise<(string | null)[]> {
  const res = await api(readToken(OWNER_STATE)).get(`/admin/bulk-quotes/${id}`);
  expect(res.status).toBe(200);
  return (res.json.events as { kind: string; note: string | null }[])
    .filter((event) => event.kind === "NOTE")
    .map((event) => event.note);
}

test.describe("cross-site writes to the BFF", () => {
  test("a text/plain post from another origin is refused, and writes nothing", async ({ page }) => {
    const id = await quoteId(QUOTE_CONTACTED_EMAIL);
    const note = `csrf-origin-${Date.now()}`;

    // what a hidden form on the storefront would send
    const forged = await page.request.post(`/api/admin/quotes/${id}/notes`, {
      headers: { "content-type": "text/plain", origin: OTHER_ORIGIN },
      data: JSON.stringify({ note }),
    });
    expect([403, 415]).toContain(forged.status());
    // JSON like every BFF answer - not a redirect, not Next's HTML error page
    expect((await forged.json()).error).toBeTruthy();

    // with no Origin at all, the content type alone is enough to refuse it
    const plain = await page.request.post(`/api/admin/quotes/${id}/notes`, {
      headers: { "content-type": "text/plain" },
      data: JSON.stringify({ note }),
    });
    expect(plain.status()).toBe(415);

    expect(await notes(id)).not.toContain(note);
  });

  test("a write the browser marks as from another site is refused, JSON or not", async ({ page }) => {
    const id = await quoteId(QUOTE_CONTACTED_EMAIL);

    for (const site of ["cross-site", "same-site"]) {
      const note = `csrf-${site}-${Date.now()}`;
      const res = await page.request.post(`/api/admin/quotes/${id}/notes`, {
        headers: { "content-type": "application/json", "sec-fetch-site": site },
        data: { note },
      });
      expect(res.status(), `Sec-Fetch-Site: ${site}`).toBe(403);
      expect(await notes(id)).not.toContain(note);
    }
  });

  test("the app's own JSON writes still go through", async ({ page }) => {
    const id = await quoteId(QUOTE_CONTACTED_EMAIL);
    const note = `csrf-own-${Date.now()}`;

    await page.goto(`/quotes/${id}`);
    // a real same-origin fetch: the browser adds Sec-Fetch-Site and Origin itself
    const status = await page.evaluate(
      async ({ id, note }) => {
        const res = await fetch(`/api/admin/quotes/${id}/notes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note }),
        });
        return res.status;
      },
      { id, note },
    );
    expect(status).toBe(200);

    expect(await notes(id)).toContain(note);
  });
});

test.describe("input a handler cannot use", () => {
  test("a body that is not JSON is a 400, not a 500", async ({ page }) => {
    const res = await page.request.post("/api/admin/catalog/colors", {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  test("a catalog segment no slug or code could be never reaches the API", async ({ page }) => {
    const res = await page.request.delete("/api/admin/catalog/sizes/not-a-code");
    expect(res.status()).toBe(400);

    await page.goto("/catalog/products/Not_A_Slug");
    await expect(page.getByTestId("product-not-found-back")).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
  });
});
