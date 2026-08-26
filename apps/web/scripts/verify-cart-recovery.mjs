/**
 * What happens to a design added while the API is unreachable.
 *
 * The storefront is built to keep working with the API down, which means a
 * customer can finish a design, add it to the cart, and only then discover the
 * server was never there. The artwork must not be lost, the checkout must fail
 * out loud rather than quietly ordering a blank shirt, and the retry must attach
 * the design once the server is back.
 *
 * The outage is simulated with request interception rather than by stopping the
 * server, so both halves run in one browser session with one IndexedDB.
 *
 *   node scripts/verify-cart-recovery.mjs        (needs the storefront AND the API up)
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:4321";
const API = process.env.API_ORIGIN ?? "http://localhost:4000/api/v1";
const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(
    `  ${pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bodyText = (page) => page.evaluate(() => document.body.innerText);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: mkdtempSync(path.join(tmpdir(), "inkhaus-recovery-")),
  args: ["--no-sandbox"],
  defaultViewport: { width: 1440, height: 1000 },
});

const page = await browser.newPage();
let apiBlocked = false;
await page.setRequestInterception(true);
page.on("request", (req) => {
  if (apiBlocked && req.url().startsWith("http://localhost:4000")) return req.abort("failed");
  req.continue();
});

const fill = async (id, value) => {
  await page.focus(`#${id}`);
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.type(value);
};

try {
  await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle2" });
  await page.evaluate(async () => {
    localStorage.clear();
    for (const db of (await indexedDB.databases?.()) ?? []) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  console.log("\n\x1b[1mThe API is unreachable\x1b[0m");
  apiBlocked = true;

  await page.goto(`${ORIGIN}/design?product=classic-tee&color=acid`, { waitUntil: "networkidle2" });
  await page.waitForFunction(
    () => {
      const b = document.querySelector('[data-testid="studio-add-to-cart"]');
      return b && !b.disabled;
    },
    { timeout: 30000 },
  );

  await page.$$eval("button", (els) => els.find((b) => /^\s*Text\s*$/i.test(b.innerText))?.click());
  await sleep(400);
  await page.$$eval("button", (els) =>
    els.find((b) => /Add a text layer/i.test(b.innerText))?.click(),
  );
  await sleep(900);

  await page.$eval('[data-testid="studio-add-to-cart"]', (el) => el.click());
  await page.waitForSelector('[data-testid="cart-drawer"]', { timeout: 20000 });
  await sleep(1200);

  check("the design still reaches the cart", (await page.$$('[data-testid="cart-line"]')).length === 1);
  check("its mockup was rendered locally", /data:image\/jpeg/.test(
    await page.$eval('[data-testid="cart-line"] img', (el) => el.src).catch(() => ""),
  ));

  const parked = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("inkhaus-cart");
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction("designs").objectStore("designs").getAll();
          req.onsuccess = () =>
            resolve(
              req.result.map((d) => ({
                key: d.key,
                product: d.productSlug,
                color: d.colorSlug,
                sides: Object.keys(d.scene ?? {}),
                hasFront: typeof d.previewFront === "string",
              })),
            );
          req.onerror = () => resolve([]);
        };
        open.onerror = () => resolve([]);
      }),
  );
  check("the artwork was parked for a retry", parked.length === 1, JSON.stringify(parked[0] ?? {}));
  check("it was parked against the right blank", parked[0]?.product === "classic-tee");
  check("the parked payload keeps its mockup", parked[0]?.hasFront === true);

  await page.keyboard.press("Escape");
  await sleep(300);
  await page.goto(`${ORIGIN}/checkout`, { waitUntil: "networkidle2" });
  await sleep(400);
  await fill("email", "outage@inkhaus.test");
  await fill("name", "Sam Okafor");
  await fill("line1", "1 Press Road");
  await fill("city", "Charlotte");
  await fill("state", "NC");
  await fill("postal", "28202");
  await sleep(300);

  const before = await page
    .$eval('[data-testid="cart-count"]', (el) => el.innerText)
    .catch(() => "0");
  await page.$eval('[data-testid="place-order"]', (el) => el.click());
  await sleep(3000);

  const failText = await bodyText(page);
  check("checkout fails out loud", /Could not reach the INKHAUS server/i.test(failText));
  check("it says nothing was charged", /nothing was charged/i.test(failText));
  check("we are still on checkout", /\/checkout/.test(page.url()), page.url());
  check(
    "the cart is untouched",
    (await page.$eval('[data-testid="cart-count"]', (el) => el.innerText).catch(() => "0")) ===
      before,
    `${before} pieces`,
  );

  console.log("\n\x1b[1mThe API comes back\x1b[0m");
  apiBlocked = false;

  await page.$eval('[data-testid="place-order"]', (el) => el.click());
  await page
    .waitForFunction(() => /^\/orders\//.test(location.pathname), { timeout: 30000 })
    .catch(() => {});
  await sleep(1500);

  const number = ((await bodyText(page)).match(/INK-\d{6}/) ?? [])[0];
  check("the retry places the order", !!number, number ?? page.url());

  if (number) {
    const order = await fetch(`${API}/orders/${number}`).then((r) => r.json());
    check(
      "the parked artwork was attached on the way through",
      order.items.every((i) => !!i.designId),
      order.items.map((i) => `${i.productSlug}:${i.designId ?? "MISSING"}`).join(" "),
    );
    check("the order carries the blank it was designed for", order.items[0]?.productSlug === "classic-tee");
  }

  const leftover = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open("inkhaus-cart");
        open.onsuccess = () => {
          const req = open.result.transaction("designs").objectStore("designs").count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(-1);
        };
        open.onerror = () => resolve(-1);
      }),
  );
  check("the parked copy is cleaned up afterwards", leftover === 0, `${leftover} left`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
