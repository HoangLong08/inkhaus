import { expect, test, type Page } from "@playwright/test";

import { REVIEW_AUTHOR_PREFIX, REVIEW_COUNTS } from "./fixtures";
import { API_ORIGIN, api, OWNER_STATE, readToken, STAFF_STATE } from "./helpers";

/**
 * Review moderation: the pending queue, a publish that reaches the storefront,
 * a bulk reject, and delete as an owner's call in all three places - the menu,
 * the BFF and the API.
 *
 * Every page is narrowed to the seeded reviews with the list's own search, so
 * reviews anyone else left in the dev database never get in the way. The
 * moderation tests run with no status filter, so a row they move stays on
 * screen to be asserted instead of leaving the queue. Subjects are picked by id,
 * read from the admin API, never by the text on screen.
 */
test.use({ storageState: OWNER_STATE });

const SEARCH = encodeURIComponent(REVIEW_AUTHOR_PREFIX.trim());
/** every fixture review, in any status */
const FIXTURES = `/reviews?q=${SEARCH}`;

type Fixture = { id: string; author: string; rating: number; status: string; body: string };

/** the seeded reviews as the API has them now, newest first; optionally in one status */
async function fixtures(status?: string): Promise<Fixture[]> {
  const res = await api(readToken(OWNER_STATE)).get<{ data: Fixture[] }>(
    `/admin/reviews?q=${SEARCH}&limit=100${status ? `&status=${status}` : ""}`,
  );
  expect(res.status, res.text).toBe(200);
  return res.json.data.filter((review) => review.author.startsWith(REVIEW_AUTHOR_PREFIX));
}

const row = (page: Page, id: string) =>
  page.locator(`[data-testid="review-row"][data-id="${id}"]`);

async function moveOne(page: Page, id: string, action: string) {
  await row(page, id).getByTestId("review-actions").click();
  await page.getByTestId(action).click();
}

test.describe("reviews", () => {
  test("the pending queue holds the seeded reviews, and a rating chip keeps the search", async ({
    page,
  }) => {
    const pending = await fixtures("PENDING");
    expect(pending).toHaveLength(REVIEW_COUNTS.PENDING);
    expect(pending.map((review) => review.rating).sort()).toEqual([2, 4, 5]);

    await page.goto(`/reviews?status=PENDING&q=${SEARCH}`);
    await expect(page.getByTestId("list-range")).toBeVisible();
    for (const review of pending) {
      await expect(row(page, review.id)).toHaveAttribute("data-status", "PENDING");
    }
    await expect(page.locator('[data-testid="review-row"]:not([data-status="PENDING"])')).toHaveCount(0);

    const twoStar = pending.find((review) => review.rating === 2)!;
    await page.locator('[data-testid="filter-link"][data-param="rating"][data-value="2"]').click();
    await expect(page).toHaveURL(/rating=2/);
    await expect(page).toHaveURL(/status=PENDING/);
    await expect(page).toHaveURL(new RegExp(`q=${SEARCH}`));
    await expect(row(page, twoStar.id)).toBeVisible();
    await expect(page.locator('[data-testid="review-row"]:not([data-rating="2"])')).toHaveCount(0);
  });

  test("publishing a review flips its badge and puts it on the storefront", async ({ page }) => {
    const target = (await fixtures("PENDING")).find((review) => review.rating === 5);
    expect(target, "the seeded five-star pending review").toBeDefined();

    await page.goto(FIXTURES);
    // The badge flips optimistically, before the write lands. Reloading on the
    // badge alone aborts the request in flight, so wait for the BFF to answer.
    const saved = page.waitForResponse(
      (res) => res.url().endsWith(`/api/admin/reviews/${target!.id}`) && res.request().method() === "PATCH",
    );
    await moveOne(page, target!.id, "review-publish");
    expect((await saved).ok(), "the publish reached the server").toBe(true);
    await expect(row(page, target!.id)).toHaveAttribute("data-status", "PUBLISHED");
    await expect(row(page, target!.id).getByTestId("status-badge")).toHaveAttribute(
      "data-status",
      "PUBLISHED",
    );

    // the server agrees - not just the optimistic badge
    await page.reload();
    await expect(row(page, target!.id)).toHaveAttribute("data-status", "PUBLISHED");

    const storefront = (await fetch(`${API_ORIGIN}/reviews?limit=50`).then((res) => res.json())) as {
      id: string;
      body: string;
    }[];
    expect(storefront.map((review) => review.id)).toContain(target!.id);
    expect(storefront.map((review) => review.body)).toContain(target!.body);
  });

  test("select-all ticks the page, and a bulk reject moves exactly the ticked rows", async ({
    page,
  }) => {
    // one already published above and one still pending: two statuses, one batch
    const [first, second] = (await fixtures()).filter((review) => review.status !== "REJECTED");
    expect(second, "two fixture reviews that are not rejected").toBeDefined();

    await page.goto(FIXTURES);
    await expect(page.getByTestId("review-row").first()).toBeVisible();
    await expect(page.getByTestId("bulk-reject")).toHaveCount(0);

    await page.getByTestId("review-select-all").click();
    await expect(page.locator('[data-testid="review-select"][data-state="unchecked"]')).toHaveCount(0);
    await page.getByTestId("review-select-all").click();
    await expect(page.locator('[data-testid="review-select"][data-state="checked"]')).toHaveCount(0);
    await expect(page.getByTestId("bulk-reject")).toHaveCount(0);

    for (const review of [first, second]) {
      await row(page, review.id).getByTestId("review-select").click();
    }
    await expect(page.getByTestId("review-select-all")).toHaveAttribute("data-state", "indeterminate");
    // as above: the badges move before the batch commits, and the reload below
    // must not race it
    const saved = page.waitForResponse(
      (res) => res.url().endsWith("/api/admin/reviews/bulk") && res.request().method() === "POST",
    );
    await page.getByTestId("bulk-reject").click();
    expect((await saved).ok(), "the batch reached the server").toBe(true);

    for (const review of [first, second]) {
      await expect(row(page, review.id)).toHaveAttribute("data-status", "REJECTED");
    }
    await page.reload();
    for (const review of [first, second]) {
      await expect(row(page, review.id)).toHaveAttribute("data-status", "REJECTED");
    }
  });

  test("staff moderate but cannot delete - hidden in the menu, refused by the BFF and the API", async ({
    browser,
  }) => {
    const [target] = await fixtures();
    const context = await browser.newContext({ storageState: STAFF_STATE });
    const page = await context.newPage();
    try {
      await page.goto(FIXTURES);
      await row(page, target.id).getByTestId("review-actions").click();
      await expect(page.getByTestId("review-publish")).toBeVisible();
      await expect(page.getByTestId("review-delete")).toHaveCount(0);
      await page.keyboard.press("Escape");

      const viaBff = await page.request.delete(`/api/admin/reviews/${target.id}`);
      expect(viaBff.status()).toBe(403);

      const viaApi = await api(readToken(STAFF_STATE)).del(`/admin/reviews/${target.id}`);
      expect(viaApi.status).toBe(403);

      await page.reload();
      await expect(row(page, target.id)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("an owner deletes through the confirmation, and the row goes", async ({ page }) => {
    const target = (await fixtures()).at(-1)!;

    await page.goto(FIXTURES);

    // backing out leaves it alone
    await moveOne(page, target.id, "review-delete");
    await expect(page.getByTestId("review-delete-dialog")).toBeVisible();
    await page.getByTestId("review-delete-cancel").click();
    await expect(page.getByTestId("review-delete-dialog")).toHaveCount(0);
    await expect(row(page, target.id)).toBeVisible();

    await moveOne(page, target.id, "review-delete");
    await page.getByTestId("review-delete-confirm").click();
    await expect(row(page, target.id)).toHaveCount(0);

    // gone from the database, not merely from the screen
    await page.reload();
    await expect(page.getByTestId("review-row").first()).toBeVisible();
    await expect(row(page, target.id)).toHaveCount(0);
    expect((await fixtures()).map((review) => review.id)).not.toContain(target.id);
  });
});
