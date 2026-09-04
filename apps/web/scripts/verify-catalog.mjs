/**
 * End-to-end verification of the catalog surfaces.
 *
 * Complements verify-cart.mjs, which owns the cart and checkout flow. This one
 * walks the parts a catalog expansion breaks: the filter/search/sort bar and its
 * URL round-trip, every single product page, the gallery and lightbox, the quick
 * view, the mobile buy bar, and — the one that only ever fails in production —
 * whether Next's image optimizer answered every request without a 4xx.
 *
 * Expected prices and counts come from `@inkhaus/shared`, the same module the
 * browser renders from, so a drift shows up here rather than in a customer's
 * cart.
 *
 *   npm run build -w @inkhaus/web
 *   npx next start -p 4321          # in apps/web
 *   node scripts/verify-catalog.mjs
 *
 * Against a Vercel preview:
 *   SITE_ORIGIN=https://<preview>.vercel.app node scripts/verify-catalog.mjs
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
const { PRODUCTS, CATEGORIES, quote, sizesFor } = require("@inkhaus/shared");

const ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:4321";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const HEADFUL = process.argv.includes("--headful");
/** every PDP is slow; --quick walks a representative handful instead */
const QUICK = process.argv.includes("--quick");

const PROFILE = mkdtempSync(path.join(tmpdir(), "inkhaus-catalog-"));
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

const countOf = (page, sel) => page.$$eval(sel, (els) => els.length);
const attrOf = (page, sel, name) =>
  page.$eval(sel, (el, n) => el.getAttribute(n), name).catch(() => null);
const clickBy = (page, sel) => page.$eval(sel, (el) => el.click());

const go = async (page, route) => {
  await page.goto(`${ORIGIN}${route}`, { waitUntil: "networkidle2" });
  await sleep(300);
};

const slugsOnPage = (page) =>
  page.$$eval("[data-testid='product-card']", (els) =>
    els.map((e) => e.getAttribute("data-slug")),
  );

const cartCount = async (page) => {
  const t = await page
    .$eval('[data-testid="cart-count"]', (el) => el.innerText.trim())
    .catch(() => null);
  return t === null ? 0 : Number(t);
};

/* ---------------- run ---------------- */

console.log(`storefront ${ORIGIN}   ${PRODUCTS.length} products${QUICK ? "   (quick)" : ""}`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: HEADFUL ? false : "new",
  userDataDir: PROFILE,
  args: ["--no-sandbox", "--window-size=1440,1000"],
  defaultViewport: { width: 1440, height: 1000 },
});

const page = await browser.newPage();

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") pageErrors.push(m.text().slice(0, 200));
});

// The image optimizer only ever misbehaves against a real deployment — a bad
// deviceSizes/qualities config is a 400 here and nowhere else.
const badImages = [];
page.on("response", (r) => {
  const u = r.url();
  if (u.includes("/_next/image") && r.status() >= 400) {
    badImages.push(`${r.status()} ${u.slice(0, 140)}`);
  }
});

try {
  /* ---------------------------------------------------------------- */
  section("1 · The index lists everything");
  await go(page, "/products");

  const all = await slugsOnPage(page);
  check(`renders all ${PRODUCTS.length} blanks`, all.length === PRODUCTS.length, `${all.length}`);
  check(
    "no duplicate cards",
    new Set(all).size === all.length,
    `${new Set(all).size} unique`,
  );
  check(
    "every catalog slug is on the page",
    PRODUCTS.every((p) => all.includes(p.slug)),
  );
  check(
    "the count readout agrees with the grid",
    Number(await attrOf(page, "[data-testid='products-count']", "data-count")) === all.length,
  );

  /* ---------------------------------------------------------------- */
  section("2 · Search");
  await page.type("[data-testid='products-search']", "hoodie");
  await sleep(700); // debounce is 250ms, plus the replace() round-trip

  const hits = await slugsOnPage(page);
  const expectHoodie = PRODUCTS.filter((p) =>
    [p.name, p.blurb, p.fabric, p.type, p.category, ...p.method]
      .join(" ")
      .toLowerCase()
      .includes("hoodie"),
  ).length;
  check("narrows the grid", hits.length === expectHoodie, `${hits.length} of ${all.length}`);
  check("writes the query to the URL", page.url().includes("q=hoodie"), page.url().split("?")[1]);

  await page.reload({ waitUntil: "networkidle2" });
  await sleep(400);
  check(
    "a reload keeps the filtered view",
    (await slugsOnPage(page)).length === expectHoodie,
  );

  await page.goBack({ waitUntil: "networkidle2" }).catch(() => {});
  await sleep(500);

  /* ---------------------------------------------------------------- */
  section("3 · Category filters");
  for (const cat of CATEGORIES) {
    const expect = PRODUCTS.filter((p) => p.category === cat).length;
    if (expect === 0) continue;
    await go(page, `/products?cat=${cat}`);
    const got = await slugsOnPage(page);
    check(
      `${cat} deep-links to ${expect}`,
      got.length === expect && got.every((s) => PRODUCTS.find((p) => p.slug === s).category === cat),
      `${got.length}`,
    );
  }

  /* ---------------------------------------------------------------- */
  section("4 · Sorting");
  for (const [sort, cmp] of [
    ["price-asc", (a, b) => a.price - b.price || a.name.localeCompare(b.name)],
    ["price-desc", (a, b) => b.price - a.price || a.name.localeCompare(b.name)],
    ["name", (a, b) => a.name.localeCompare(b.name)],
  ]) {
    await go(page, `/products?sort=${sort}`);
    const got = await slugsOnPage(page);
    const want = [...PRODUCTS].sort(cmp).map((p) => p.slug);
    check(`${sort} orders the grid correctly`, JSON.stringify(got) === JSON.stringify(want));
  }

  /* ---------------------------------------------------------------- */
  section("5 · Empty state");
  await go(page, "/products?q=zzzznotathing");
  check("shows the empty state", (await countOf(page, "[data-testid='products-empty']")) === 1);
  check("renders no cards", (await countOf(page, "[data-testid='product-card']")) === 0);
  await clickBy(page, "[data-testid='products-empty'] button");
  await sleep(700);
  check("clearing restores the full grid", (await slugsOnPage(page)).length === PRODUCTS.length);

  /* ---------------------------------------------------------------- */
  section("6 · A combined deep link");
  await go(page, "/products?cat=drinkware&sort=price-asc");
  const combo = await slugsOnPage(page);
  const wantCombo = PRODUCTS.filter((p) => p.category === "drinkware")
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
    .map((p) => p.slug);
  check(
    "cat + sort together, on a cold load",
    JSON.stringify(combo) === JSON.stringify(wantCombo),
    combo.join(", "),
  );

  /* ---------------------------------------------------------------- */
  section("7 · Quick view");
  await go(page, "/products");
  await clickBy(page, "[data-testid='quick-view-open']");
  await page.waitForSelector("[data-testid='quick-view']", { timeout: 4000 });
  await sleep(400);
  check("opens a dialog", (await countOf(page, "[data-testid='quick-view']")) === 1);
  check(
    "the product page's button is not on this page",
    (await countOf(page, "[data-testid='pdp-add-to-cart']")) === 0,
  );

  const before = await cartCount(page);
  await clickBy(page, "[data-testid='quick-view-add-to-cart']");
  await sleep(900);
  check("adds to the cart", (await cartCount(page)) === before + 1, `${await cartCount(page)}`);

  await page.keyboard.press("Escape");
  await sleep(400);

  /* ---------------------------------------------------------------- */
  section("8 · Every product page");
  const walk = QUICK
    ? PRODUCTS.filter((p, i) => i % 4 === 0 || p.sizes)
    : PRODUCTS;

  let priceOk = 0;
  let visualOk = 0;
  let singleButton = 0;
  const broken = [];

  for (const p of walk) {
    await go(page, `/products/${p.slug}`);

    const run = sizesFor(p);
    const size = run.includes("M") ? "M" : run[0];
    const want = quote(p, [{ size, qty: 1 }]);

    const unit = Number(await attrOf(page, "[data-testid='pdp-price']", "data-unit"));
    const sub = Number(await attrOf(page, "[data-testid='pdp-price']", "data-subtotal"));
    if (near(unit, want.baseUnitPrice) && near(sub, want.subtotal)) priceOk++;
    else broken.push(`${p.slug} priced $${sub}, expected $${want.subtotal}`);

    // the gallery must always show *something* — a photo or the SVG blank
    const visual = await page.evaluate(() => {
      const g = document.querySelector("[data-testid='pdp-gallery']");
      if (!g) return "missing";
      const img = [...g.querySelectorAll("img")].some((i) => i.naturalWidth > 0);
      const svg = g.querySelector("svg path[d]") !== null;
      return img || svg ? "ok" : "empty";
    });
    if (visual === "ok") visualOk++;
    else broken.push(`${p.slug} gallery is ${visual}`);

    if ((await countOf(page, "[data-testid='pdp-add-to-cart']")) === 1) singleButton++;
    else broken.push(`${p.slug} has the wrong number of add-to-cart buttons`);
  }

  check(`${walk.length} product pages priced correctly`, priceOk === walk.length, `${priceOk}`);
  check(`${walk.length} galleries rendered a visual`, visualOk === walk.length, `${visualOk}`);
  check(
    "exactly one pdp-add-to-cart per page",
    singleButton === walk.length,
    `${singleButton}`,
  );
  if (broken.length) console.log(`    ${broken.slice(0, 8).join("\n    ")}`);

  /* ---------------------------------------------------------------- */
  section("9 · Colourways and the one-size run");
  const many = PRODUCTS.reduce((a, b) => (b.colors.length > a.colors.length ? b : a));
  await go(page, `/products/${many.slug}`);
  const errsBefore = pageErrors.length;
  for (let i = 0; i < many.colors.length; i++) {
    await page.$$eval(
      "[aria-label][aria-pressed]",
      (els, idx) => {
        const swatches = els.filter((e) => e.style.background);
        swatches[idx]?.click();
      },
      i,
    );
    await sleep(160);
  }
  check(
    `${many.colors.length} swatches on ${many.slug} without a console error`,
    pageErrors.length === errsBefore,
  );

  const oneSize = PRODUCTS.find((p) => sizesFor(p).length === 1);
  await go(page, `/products/${oneSize.slug}`);
  check(
    `${oneSize.slug} shows a one-size stepper`,
    (await countOf(page, `[id='pdp-${oneSize.slug}-${sizesFor(oneSize)[0]}']`)) === 1,
  );
  const oneBefore = await cartCount(page);
  await clickBy(page, "[data-testid='pdp-add-to-cart']");
  await sleep(900);
  check(
    "a one-size blank reaches the cart",
    (await cartCount(page)) === oneBefore + 1,
    `${await cartCount(page)}`,
  );

  /* ---------------------------------------------------------------- */
  section("10 · The mobile buy bar");
  await page.setViewport({ width: 390, height: 844 });
  await go(page, `/products/${PRODUCTS[0].slug}`);
  check(
    "hidden at the top of the page",
    (await countOf(page, "[data-testid='pdp-sticky-add-to-cart']")) === 0,
  );
  // scroll relative to the button rather than to a fraction of the page: the
  // spec pane and the related row sit below it, so "70% down" can still be
  // above the button on a long page
  await page.evaluate(() => {
    const el = document.querySelector("[data-testid='pdp-add-to-cart']");
    window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top + el.offsetHeight + 400);
  });
  await sleep(900);
  const stickyShown = (await countOf(page, "[data-testid='pdp-sticky-add-to-cart']")) === 1;
  check("appears once the real button scrolls away", stickyShown);

  if (stickyShown) {
    const stickyBefore = await cartCount(page);
    await clickBy(page, "[data-testid='pdp-sticky-add-to-cart']");
    await sleep(900);
    check("it adds to the cart", (await cartCount(page)) === stickyBefore + 1);

    // it must never sit over the drawer, which is the thing it would cover
    await clickBy(page, '[data-testid="cart-button"]');
    await page.waitForSelector('[data-testid="cart-drawer"]', { timeout: 4000 });
    await sleep(500);
    const under = await page.evaluate(() => {
      const z = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        for (let n = el; n; n = n.parentElement) {
          const v = getComputedStyle(n).zIndex;
          if (v !== "auto") return Number(v);
        }
        return 0;
      };
      return { bar: z("[data-testid='pdp-sticky-add-to-cart']"), drawer: z("[data-testid='cart-drawer']") };
    });
    check(
      "it stays under the cart drawer",
      under.bar === null || under.drawer > under.bar,
      `bar z${under.bar} vs drawer z${under.drawer}`,
    );
    await page.keyboard.press("Escape");
    await sleep(400);
  } else {
    check("it adds to the cart", false, "bar never appeared");
  }
  await page.setViewport({ width: 1440, height: 1000 });

  /* ---------------------------------------------------------------- */
  section("11 · Home merchandising");
  await go(page, "/");
  check("the category block is present", (await countOf(page, "[data-testid='home-categories']")) === 1);
  check("the featured grid is present", (await countOf(page, "[data-testid='home-featured']")) === 1);
  const catLinks = await page.$$eval("[data-testid^='home-category-']", (els) =>
    els.map((e) => e.getAttribute("href")),
  );
  check(
    "every category tile links into a filtered index",
    catLinks.length > 0 && catLinks.every((h) => h.startsWith("/products?cat=")),
    `${catLinks.length} tiles`,
  );

  /* ---------------------------------------------------------------- */
  section("12 · Asset health");
  const brokenImgs = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
  );
  check("no broken images on the homepage", brokenImgs === 0, `${brokenImgs}`);
  check(
    "the image optimizer never 4xx'd",
    badImages.length === 0,
    badImages.slice(0, 3).join(" | "),
  );
  check(
    "no page errors across the whole run",
    pageErrors.length === 0,
    pageErrors.slice(0, 3).join(" | "),
  );
} finally {
  await browser.close();
}

/* ---------------- summary ---------------- */

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? `\n\n\x1b[31mFailures\x1b[0m\n` : ""),
);
for (const f of failed) console.log(`  ${f.group} → ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
process.exit(failed.length ? 1 : 0);
