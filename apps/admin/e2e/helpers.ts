import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { POOL } from "./fixtures";

export const API_ORIGIN = "http://localhost:4001/api/v1";
export const COOKIE_NAME = "inkhaus_admin";

/**
 * Signed-in browser state, written once per run by `auth.setup.ts` (the
 * "setup" project every spec depends on). A spec that is about something other
 * than signing in starts from one instead of walking the OAuth flow again:
 *
 *   test.use({ storageState: OWNER_STATE });
 *   const staff = await browser.newContext({ storageState: STAFF_STATE });
 *
 * They hold live session tokens, which is why `e2e/.auth/` is gitignored.
 */
export const OWNER_STATE = path.join(__dirname, ".auth", "owner.json");
export const STAFF_STATE = path.join(__dirname, ".auth", "staff.json");

/** the keys wired to buttons on the fake consent screen - see packages/oidc-stub */
export type Account = "owner" | "staff" | "outsider" | "unverified" | "shopper" | "cancel";

/**
 * Walks the whole sign-in flow the way a person would: click the button, land
 * on the consent screen, pick an account, get redirected back. Nothing is
 * stubbed at the network layer.
 */
export async function signIn(page: Page, account: Account, startAt = "/login") {
  await page.goto(startAt);
  await page.getByTestId("google-signin").click();
  await page.waitForURL(/\/o\/oauth2\/v2\/auth/);
  await page.getByTestId(`pick-${account}`).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/o/oauth2"));
}

export async function sessionCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === COOKIE_NAME) ?? null;
}

/** the raw session token, for hitting the API directly as that user */
export async function sessionToken(page: Page) {
  const cookie = await sessionCookie(page);
  expect(cookie, "expected a session cookie").not.toBeNull();
  return cookie!.value;
}

/**
 * The session token saved in a storage-state file, for calling the API as that
 * user without opening a page: `api(readToken(STAFF_STATE))`.
 */
export function readToken(statePath: string) {
  const state = JSON.parse(readFileSync(statePath, "utf8")) as {
    cookies?: { name: string; value: string }[];
  };
  const cookie = state.cookies?.find((c) => c.name === COOKIE_NAME);
  if (!cookie) {
    throw new Error(`no ${COOKIE_NAME} cookie in ${statePath} - did the setup project run?`);
  }
  return cookie.value;
}

/**
 * Sign-out moved into the sidebar's user menu when the app adopted shadcn's
 * sidebar-07 shell. It is a Radix DropdownMenu, so the item is not merely
 * hidden - it does not exist in the DOM until the trigger is clicked, and its
 * role is `menuitem`, not `button`. The item now only opens an AlertDialog,
 * which is a second portal: nothing signs out until `sign-out-confirm`.
 */
export async function signOut(page: Page) {
  await openSignOutDialog(page);
  await page.getByTestId("sign-out-confirm").click();
  await page.waitForURL(/\/login/);
}

/** the half of sign-out before the point of no return, for tests about the dialog itself */
export async function openSignOutDialog(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("sign-out-dialog")).toBeVisible();
}

/** one option of a Radix Select, as `openSelect` reads it */
export type SelectOption = {
  /** the visible text, trimmed - for messages, not for matching */
  label: string;
  /** every `data-*` attribute, keyed by full name: `data["data-status"]` */
  data: Record<string, string>;
};

/**
 * Opens a Radix Select, reads what it offers, and closes it again.
 *
 * The control is not a native <select>: the trigger is a button and the options
 * live in a portal that only exists while it is open, as `[role="option"]`
 * rather than `<option>`. Escape at the end releases the scroll lock, and the
 * wait for the options to go makes sure it has, so a caller can keep
 * interacting with the page.
 */
export async function openSelect(
  page: Page,
  triggerId: string,
  optionId: string,
): Promise<SelectOption[]> {
  await page.getByTestId(triggerId).click();
  const options = page.getByTestId(optionId);
  await expect(options.first()).toBeVisible();

  const read = await options.evaluateAll((els) =>
    els.map((el) => ({
      label: (el.textContent ?? "").trim(),
      data: Object.fromEntries(
        Array.from(el.attributes)
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => [a.name, a.value]),
      ),
    })),
  );

  await page.keyboard.press("Escape");
  await expect(options).toHaveCount(0);
  return read;
}

/**
 * Opens a Radix Select and picks the option whose `attr` is `value` -
 * `pickOption(page, "status-select", "status-option", "data-status", "PAID")`.
 * Matches on the machine-readable attribute, never on the label.
 */
export async function pickOption(
  page: Page,
  triggerId: string,
  optionId: string,
  attr: string,
  value: string,
) {
  await page.getByTestId(triggerId).click();
  await page.locator(`[data-testid=${JSON.stringify(optionId)}][${attr}=${JSON.stringify(value)}]`).click();
  await expect(page.getByTestId(optionId)).toHaveCount(0);
}

/** the labels of the status transitions the current user is offered */
export async function allowedTransitions(page: Page) {
  const options = await openSelect(page, "status-select", "status-option");
  return options.map((option) => option.label);
}

// Tests read ad-hoc slices of many response shapes; spelling each one out would
// be noise, and the API's own contract is what the zod schemas in src/ check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export type ApiResponse<T = Json> = {
  status: number;
  /** the parsed body, or null when it was empty or not JSON */
  json: T;
  /** the raw body - what a CSV export is read through */
  text: string;
  headers: Headers;
};

/**
 * Calls the NestJS API directly as the owner of `token` - for asserting that a
 * refusal is real rather than merely hidden, and for reading back what a UI
 * action wrote. `path` starts after `/api/v1`: `api(t).get("/admin/orders")`.
 */
export function api(token: string) {
  async function call<T>(method: string, route: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_ORIGIN}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json: json as T, text, headers: res.headers };
  }

  return {
    get: <T = Json>(route: string) => call<T>("GET", route),
    post: <T = Json>(route: string, body?: unknown) => call<T>("POST", route, body),
    patch: <T = Json>(route: string, body?: unknown) => call<T>("PATCH", route, body),
    put: <T = Json>(route: string, body?: unknown) => call<T>("PUT", route, body),
    del: <T = Json>(route: string, body?: unknown) => call<T>("DELETE", route, body),
  };
}

/**
 * An order sitting in PENDING_PAYMENT, which every transition test starts from.
 *
 * Prefers the seeded pool (INK-900101..106), which is rebuilt every run and so
 * is the only set it is safe to spend. It falls back to any PENDING_PAYMENT
 * order so a half-seeded database still gets a result rather than a confusing
 * failure.
 */
export async function findActionableOrder(token: string) {
  const res = await fetch(`${API_ORIGIN}/orders?status=PENDING_PAYMENT&limit=100`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.ok, `order lookup failed: ${res.status}`).toBe(true);
  const body = (await res.json()) as { data: { number: string }[] };
  const numbers = body.data.map((order) => order.number);
  const pooled = numbers.find((n) => (POOL as readonly string[]).includes(n));
  const number = pooled ?? numbers[0];
  expect(number, "no PENDING_PAYMENT order left - run db:seed:e2e, which rebuilds the pool").toBeTruthy();
  return number;
}
