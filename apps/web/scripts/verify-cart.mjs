/**
 * End-to-end verification of the cart, checkout and order flow.
 *
 * Drives a real Chrome against a running storefront and asserts the things that
 * are easy to break and impossible to see in a type check: that the badge
 * survives a reload, that a mixed-size run earns the right tier, that two
 * identical variants merge into one line, that the size grid and the summary
 * agree, and that placing an order actually reaches the API.
 *
 * Expected prices are read from `@inkhaus/shared` — the same module the browser
 * and the API price from — so a drift between the three shows up here.
 *
 *   npm run build -w @inkhaus/web
 *   npx next start -p 4321          # in apps/web
 *   node scripts/verify-cart.mjs
 *
 * The API is optional. With it down the script asserts the offline-ish paths
 * instead (artwork parked locally, checkout failing loudly rather than
 * pretending), and says so in the summary.
 */
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

import { loadRootEnv } from "@inkhaus/env";

// SITE_ORIGIN, API_ORIGIN and CHROME_PATH live in the repo-root .env with
// everything else; the defaults below still apply when it does not name them.
loadRootEnv();

const require = createRequire(import.meta.url);
const { PRODUCTS, quote, FREE_SHIPPING_OVER, SHIPPING_FLAT } = require("@inkhaus/shared");

const ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:4321";
const API = process.env.API_ORIGIN ?? "http://localhost:4000/api/v1";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HEADFUL = process.argv.includes("--headful");

const PROFILE = mkdtempSync(path.join(tmpdir(), "inkhaus-cart-"));
mkdirSync(PROFILE, { recursive: true });

/* ---------------- tiny harness ---------------- */

const results = [];
let group = "";
const section = (name) => {
  group = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
};
const check = (name, pass, detail = "") => {
  results.push({ group, name, pass, detail });
  const mark = pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const near = (a, b, eps = 0.011) => Math.abs(a - b) < eps;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- page helpers ---------------- */

const has = async (page, sel) => (await page.$(sel)) !== null;
const countOf = (page, sel) => page.$$eval(sel, (els) => els.length);
const textOf = (page, sel) =>
  page.$eval(sel, (el) => el.innerText.trim()).catch(() => null);
const attrOf = (page, sel, name) =>
  page.$eval(sel, (el, n) => el.getAttribute(n), name).catch(() => null);
const bodyText = (page) => page.evaluate(() => document.body.innerText);

/** React listens at the root, so a dispatched click is a real click to it —
 *  and it cannot be swallowed by the fixed header or an open backdrop. */
const clickBy = (page, sel) => page.$eval(sel, (el) => el.click());

async function setNumber(page, sel, value) {
  await page.focus(sel);
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  if (String(value) !== "0") await page.keyboard.type(String(value));
  await sleep(120);
}

const go = async (page, route) => {
  await page.goto(`${ORIGIN}${route}`, { waitUntil: "networkidle2" });
  await sleep(250);
};

const cartCount = async (page) => {
  const t = await textOf(page, '[data-testid="cart-count"]');
  return t === null ? 0 : Number(t);
};

async function openDrawer(page) {
  await clickBy(page, '[data-testid="cart-button"]');
  await page.waitForSelector('[data-testid="cart-drawer"]', { timeout: 4000 });
  await sleep(450);
}

async function closeDrawer(page) {
  await page.keyboard.press("Escape");
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="cart-drawer"]'), { timeout: 4000 })
    .catch(() => {});
  await sleep(250);
}

async function clearStorage(page) {
  await go(page, "/");
  await page.evaluate(async () => {
    localStorage.clear();
    for (const db of (await indexedDB.databases?.()) ?? []) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });
  await go(page, "/");
}

/* ---------------- run ---------------- */

const apiUp = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2500) })
  .then((r) => r.ok)
  .catch(() => false);

console.log(`storefront ${ORIGIN}   api ${apiUp ? "up" : "DOWN"} (${API})`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: HEADFUL ? false : "new",
  userDataDir: PROFILE,
  args: ["--no-sandbox", "--window-size=1440,1000"],
  defaultViewport: { width: 1440, height: 1000 },
});

const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push(m.text());
});

const TEE = PRODUCTS.find((p) => p.slug === "heavyweight-tee");

try {
  /* ---------------------------------------------------------------- */
  section("1 · A cold storefront");
  await clearStorage(page);

  check("header cart button exists", await has(page, '[data-testid="cart-button"]'));
  check("no badge on an empty cart", (await cartCount(page)) === 0);

  await openDrawer(page);
  const emptyDrawer = await bodyText(page);
  check("empty drawer explains itself", /Nothing in here yet/i.test(emptyDrawer));
  await closeDrawer(page);

  await go(page, "/cart");
  check("empty cart page", /Your cart is empty/i.test(await bodyText(page)));

  await go(page, "/checkout");
  check("checkout refuses an empty cart", /Nothing to check out/i.test(await bodyText(page)));

  /* ---------------------------------------------------------------- */
  section("2 · Adding from a product page");
  await go(page, "/products/heavyweight-tee");

  await setNumber(page, "#pdp-heavyweight-tee-M", 0);
  check(
    "add is disabled with nothing selected",
    await page.$eval('[data-testid="pdp-add-to-cart"]', (el) => el.disabled),
  );

  // 6 x M + 6 x L must earn the 12+ tier: the ladder is applied to the total
  await setNumber(page, "#pdp-heavyweight-tee-M", 6);
  await setNumber(page, "#pdp-heavyweight-tee-L", 6);

  const expected12 = quote(TEE, [
    { size: "M", qty: 6 },
    { size: "L", qty: 6 },
  ]);
  const shownUnit = Number(await attrOf(page, '[data-testid="pdp-price"]', "data-unit"));
  const shownSub = Number(await attrOf(page, '[data-testid="pdp-price"]', "data-subtotal"));
  check(
    "6xM + 6xL is priced at the 12+ tier",
    near(shownUnit, expected12.baseUnitPrice),
    `page $${shownUnit} vs shared $${expected12.baseUnitPrice}`,
  );
  check("subtotal matches the shared quote", near(shownSub, expected12.subtotal));
  check("the tier badge is shown", /12\+ tier/i.test(await bodyText(page)));

  await clickBy(page, '[data-testid="pdp-add-to-cart"]');
  await page.waitForSelector('[data-testid="cart-drawer"]', { timeout: 5000 });
  await sleep(500);

  check("adding opens the drawer", await has(page, '[data-testid="cart-drawer"]'));
  check("badge counts pieces, not lines", (await cartCount(page)) === 12);
  check("one line in the drawer", (await countOf(page, '[data-testid="cart-line"]')) === 1);

  const drawerText = await bodyText(page);
  check(
    "drawer shows the line total",
    drawerText.includes(`$${expected12.subtotal.toFixed(2)}`),
    `$${expected12.subtotal.toFixed(2)}`,
  );

  /* ---------------------------------------------------------------- */
  section("3 · The cart survives");
  await closeDrawer(page);
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(600);
  check("badge survives a reload", (await cartCount(page)) === 12);

  await go(page, "/cart");
  check("cart page renders the line", (await countOf(page, '[data-testid="cart-page-line"]')) === 1);
  const pageSub = Number(await attrOf(page, '[data-testid="cart-summary"]', "data-subtotal"));
  check("cart page agrees with the product page", near(pageSub, expected12.subtotal));

  /* ---------------------------------------------------------------- */
  section("4 · Editing quantities");
  // topping the same line up to 24 must move it to the next tier.
  // The input ids carry the line id, which contains colons — addressed by
  // attribute rather than by a `#id` selector that would need escaping.
  const lineIds = await page.$$eval('[data-testid="cart-page-line"] input[type="number"]', (els) =>
    els.map((e) => e.id),
  );
  const mId = lineIds.find((id) => id.endsWith("-M"));
  if (!mId) throw new Error("no size inputs on the cart page");
  await setNumber(page, `[id="${mId}"]`, 18);

  const expected24 = quote(TEE, [
    { size: "M", qty: 18 },
    { size: "L", qty: 6 },
  ]);
  const afterEdit = Number(await attrOf(page, '[data-testid="cart-summary"]', "data-subtotal"));
  const afterQty = Number(await attrOf(page, '[data-testid="cart-summary"]', "data-quantity"));
  check("editing a size repriced the line", near(afterEdit, expected24.subtotal), `$${afterEdit}`);
  check("quantity followed the edit", afterQty === 24);
  check(
    "24 units reached the 24+ tier",
    near(expected24.baseUnitPrice, quote(TEE, [{ size: "M", qty: 24 }]).baseUnitPrice),
  );

  const shipping = expected24.subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  const total = Math.round((expected24.subtotal + shipping) * 100) / 100;
  check(
    "total carries shipping correctly",
    (await textOf(page, '[data-testid="cart-total"]')) === `$${total.toFixed(2)}`,
    `expected $${total.toFixed(2)}`,
  );

  /* ---------------------------------------------------------------- */
  section("5 · Merging and splitting lines");
  await go(page, "/products/heavyweight-tee");
  await setNumber(page, "#pdp-heavyweight-tee-M", 2);
  await setNumber(page, "#pdp-heavyweight-tee-L", 0);
  await clickBy(page, '[data-testid="pdp-add-to-cart"]');
  await sleep(700);
  check("same blank + colour + method merges", (await countOf(page, '[data-testid="cart-line"]')) === 1);
  check("merged quantity adds up", (await cartCount(page)) === 26);
  await closeDrawer(page);

  // a different colourway is a different line
  await go(page, "/products/heavyweight-tee");
  await page.$$eval("button[aria-label='Bone']", (els) => els[0]?.click());
  await sleep(200);
  await setNumber(page, "#pdp-heavyweight-tee-M", 3);
  await clickBy(page, '[data-testid="pdp-add-to-cart"]');
  await sleep(700);
  check("a second colourway opens a second line", (await countOf(page, '[data-testid="cart-line"]')) === 2);
  check("badge counts both lines", (await cartCount(page)) === 29);

  // and removing it puts us back to one
  await page.$$eval("[data-testid='cart-line'] button[aria-label^='Remove']", (els) =>
    els[els.length - 1].click(),
  );
  await sleep(600);
  check("removing a line works", (await countOf(page, '[data-testid="cart-line"]')) === 1);
  await closeDrawer(page);

  /* ---------------------------------------------------------------- */
  section("6 · The studio");
  await go(page, "/design?product=heavy-hoodie&color=forest");
  // the fabric canvas is lazy-loaded; the button un-disables once it is ready
  await page.waitForFunction(
    () => {
      const b = document.querySelector('[data-testid="studio-add-to-cart"]');
      return b && !b.disabled;
    },
    { timeout: 30000 },
  );

  // the hoodie's 11x11 print area is on screen; the tee's is 12x16
  check("?product= preselects the blank", /11&quot;|11" × 11"/.test(await bodyText(page)));
  const forest = await page.$$eval("svg path[fill]", (els) =>
    els.some((e) => (e.getAttribute("fill") ?? "").toUpperCase() === "#22392C"),
  );
  check("?color= preselects the colourway", forest, "forest #22392C");

  // put something on it: the Text tool, then "Add a text layer"
  await page.$$eval("button", (els) => {
    els.find((b) => /^\s*Text\s*$/i.test(b.innerText))?.click();
  });
  await sleep(400);
  await page.$$eval("button", (els) => {
    els.find((b) => /Add a text layer/i.test(b.innerText))?.click();
  });
  await sleep(1000);

  const beforeStudio = await cartCount(page);
  await clickBy(page, '[data-testid="studio-add-to-cart"]');
  await page.waitForSelector('[data-testid="cart-drawer"]', { timeout: 15000 });
  await sleep(1200);

  check("studio add-to-cart reaches the cart", (await cartCount(page)) > beforeStudio);
  check(
    "the design line is marked custom",
    /Custom/i.test(await bodyText(page)),
  );
  const thumbs = await page.$$eval('[data-testid="cart-line"] img', (els) =>
    els.map((e) => e.src.slice(0, 30)),
  );
  check(
    "the line carries a rendered mockup",
    thumbs.some((src) => src.startsWith("data:image/jpeg")),
    thumbs[0] ?? "no <img>",
  );
  await closeDrawer(page);

  /* ---------------------------------------------------------------- */
  section("7 · Checkout validation");
  await go(page, "/checkout");
  await clickBy(page, '[data-testid="place-order"]');
  await sleep(500);
  const invalid = await countOf(page, "[aria-invalid='true']");
  check("an empty form is rejected client side", invalid >= 5, `${invalid} fields flagged`);
  check("the errors are readable", /Street address is required/i.test(await bodyText(page)));

  await page.focus("#email");
  await page.keyboard.type("not-an-email");
  await sleep(300);
  check(
    "a malformed email is caught",
    /does not look like an email/i.test(await bodyText(page)),
  );

  const fill = async (id, value) => {
    await page.focus(`#${id}`);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.type(value);
  };
  await fill("email", "crew@inkhaus.test");
  await fill("name", "Dana Reyes");
  await fill("line1", "742 Evergreen Terrace");
  await fill("city", "Los Angeles");
  await fill("state", "CA");
  await fill("postal", "90013");
  await sleep(300);
  check("the form clears once it is filled", (await countOf(page, "[aria-invalid='true']")) === 0);

  /* ---------------------------------------------------------------- */
  section("8 · Placing the order");
  const piecesBefore = await cartCount(page);
  await clickBy(page, '[data-testid="place-order"]');

  if (apiUp) {
    await page
      .waitForFunction(() => /^\/orders\//.test(location.pathname), { timeout: 30000 })
      .catch(() => {});
    const onOrder = await page.evaluate(() => location.pathname);
    check("checkout lands on the order page", /^\/orders\/INK-\d+/.test(onOrder), onOrder);

    await sleep(1200);
    const orderText = await bodyText(page);
    check("the confirmation names the order", /INK-\d{6}/.test(orderText));
    check("the order is in a real status", /Order placed|Paid/i.test(orderText));
    check("the cart is emptied on success", (await cartCount(page)) === 0);

    const number = (orderText.match(/INK-\d{6}/) ?? [])[0];
    if (number) {
      const fromApi = await fetch(`${API}/orders/${number}`).then((r) => r.json());
      const apiQty = fromApi.items.reduce((n, i) => n + i.quantity, 0);
      check("the API stored every piece", apiQty === piecesBefore, `${apiQty} vs ${piecesBefore}`);
      check(
        "the API priced it itself",
        typeof fromApi.total === "number" && fromApi.total > 0,
        `$${fromApi.total}`,
      );
      check(
        "custom artwork is attached to its line",
        fromApi.items.some((i) => i.designId),
        fromApi.items.map((i) => i.designId ?? "—").join(" "),
      );

      await go(page, "/orders");
      check("the order shows up in this browser's history", (await bodyText(page)).includes(number));
    }
  } else {
    await sleep(2500);
    const failText = await bodyText(page);
    check(
      "a dead API fails loudly, not silently",
      /Could not reach the INKHAUS server|took too long/i.test(failText),
    );
    check("the cart is kept on failure", (await cartCount(page)) === piecesBefore);
    check("the customer is told nothing was charged", /nothing was charged/i.test(failText));
  }

  /* ---------------------------------------------------------------- */
  section("9 · Console health");
  const noisy = pageErrors.filter(
    (e) => !/Failed to load resource|net::ERR_|favicon|4000/i.test(e),
  );
  check("no unhandled page errors", noisy.length === 0, noisy.slice(0, 3).join(" | "));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await browser.close();
}

/* ---------------- summary ---------------- */

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed` +
    (apiUp ? "" : "  (API was down — order placement asserted its failure path)"),
);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log(`  · ${f.group} › ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
}
process.exit(failed.length ? 1 : 0);
