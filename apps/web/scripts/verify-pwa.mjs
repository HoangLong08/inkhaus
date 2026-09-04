/**
 * End-to-end PWA verification against a production build.
 *
 * Run in two phases, because the only honest test of "works offline" is a dead
 * server - CDP network emulation is reset by navigation, so assertions made
 * after the first hop silently run against a live origin and pass for the wrong
 * reason. Both phases share a persistent Chrome profile, so the service worker
 * and IndexedDB survive between them exactly as they would for a real user.
 *
 *   npm run build -w @inkhaus/web
 *   npx next start -p 4321          # in apps/web
 *   node scripts/verify-pwa.mjs           # phase 1, server up
 *   <stop the server>
 *   node scripts/verify-pwa.mjs --offline # phase 2, server down
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

import { loadRootEnv } from "@inkhaus/env";

// SITE_ORIGIN, API_ORIGIN and CHROME_PATH live in the repo-root .env with
// everything else; the defaults below still apply when it does not name them.
loadRootEnv();

const ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:4321";
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OFFLINE_PHASE = process.argv.includes("--offline");
// stable across both phases so the worker and its caches persist
const PROFILE = path.join(tmpdir(), "inkhaus-pwa-verify-profile");
mkdirSync(PROFILE, { recursive: true });

// 64x64 solid red PNG; uploadFile takes a path, not a buffer
const FIXTURE = path.join(mkdtempSync(path.join(tmpdir(), "inkhaus-fixture-")), "artwork.png");
writeFileSync(
  FIXTURE,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAPElEQVR42u3OMQEAAAgDoJnc6BpjDyQg" +
      "dqYFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeBpYvQABtQhFVwAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (page) => page.evaluate(() => document.body?.innerText ?? "");

/** the Layers panel only exists while its tool is selected */
async function openLayers(page) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /layers/i.test(b.textContent || ""));
    btn?.click();
  });
  await sleep(1200);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: PROFILE,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  if (!OFFLINE_PHASE) {
    console.log("--- phase 1: server up ---\n");

    // ---------- service worker ----------
    await page.goto(`${ORIGIN}/design`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await sleep(3500);

    const reg = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return r && {
        scope: r.scope,
        active: !!r.active,
        scriptURL: (r.active || r.waiting || r.installing)?.scriptURL,
      };
    });
    check("service worker registered", !!reg, reg?.scriptURL);
    check("scope is origin root, not /serwist/", reg?.scope === `${ORIGIN}/`, reg?.scope);
    check("worker is active", reg?.active === true);

    // ---------- precache ----------
    const cacheMap = await page.evaluate(async () => {
      const out = {};
      for (const n of await window.caches.keys()) {
        const c = await window.caches.open(n);
        out[n] = (await c.keys()).map((r) => new URL(r.url).pathname);
      }
      return out;
    });
    const precacheKey = Object.keys(cacheMap).find((n) => n.includes("precache"));
    const precached = cacheMap[precacheKey] ?? [];
    check("precache populated", precached.length > 0, `${precached.length} entries`);
    for (const route of ["/", "/products", "/design", "/bulk", "/how-it-works", "/~offline"]) {
      check(`precached ${route}`, precached.includes(route));
    }
    // /design lazy-imports fabric on mount; if this is missing the studio is
    // installable but dead offline
    const fabric = precached.find((p) => /^\/_next\/static\/chunks\/.*\.js$/.test(p) && p.includes("362dl1u0lu_qv"));
    check("fabric chunk precached", !!fabric, fabric);

    // ---------- offline banner (emulation is fine here: no navigation) ----------
    const statusText = () =>
      page.evaluate(() => [...document.querySelectorAll('[role="status"]')].map((n) => n.textContent).join(" | "));

    await page.setOfflineMode(true);
    await sleep(2000);
    const emulated = await page.evaluate(() => navigator.onLine);
    check("setOfflineMode flips navigator.onLine", emulated === false);
    check("offline banner appears on the offline event", /offline/i.test(await statusText()));
    await page.setOfflineMode(false);
    await sleep(2000);
    check("banner clears when back online", !/offline/i.test(await statusText()));

    // ---------- upload, persist, reload ----------
    const input = await page.$('input[type="file"]');
    check("upload input present", !!input);
    await input.uploadFile(FIXTURE);
    await sleep(3000);

    const idb = await page.evaluate(async () => {
      const db = await new Promise((res) => {
        const r = indexedDB.open("inkhaus-studio");
        r.onsuccess = () => res(r.result);
      });
      const all = (store) =>
        new Promise((res) => {
          const q = db.transaction(store, "readonly").objectStore(store).getAll();
          q.onsuccess = () => res(q.result);
          q.onerror = () => res([]);
        });
      return { drafts: await all("drafts"), assets: (await all("assets")).length };
    });
    check("draft written to IndexedDB", idb.drafts.length > 0);
    check("upload Blob stored in assets", idb.assets > 0, `${idb.assets} asset(s)`);

    const scene = idb.drafts[0]?.scenes?.front ?? "";
    check("scene carries inkhausAssetId", scene.includes("inkhausAssetId"));
    // the whole point of the split store: an inlined data: URL here would also
    // land in all 40 undo snapshots
    check("scene does NOT inline base64", !scene.includes("data:image"), `${scene.length} bytes`);

    await page.reload({ waitUntil: "networkidle0" });
    await sleep(5000);
    check("no 'could not be restored' warning", !(await text(page)).includes("could not be restored"));

    // The Layers panel mirrors canvas objects into React state, so it is the
    // honest read on whether the upload came back - but it only renders while
    // the Layers tool is selected, and a reload resets the tool to Upload.
    await openLayers(page);
    check("uploaded image restored after reload", /uploaded image/i.test(await text(page)));

    // ---------- fonts ----------
    // checked after the reload: with clientsClaim:false the worker does not
    // control the first load, so it never sees those requests
    const fontCount = await page.evaluate(async () => {
      let n = 0;
      for (const name of await window.caches.keys()) {
        const c = await window.caches.open(name);
        n += (await c.keys()).filter((r) => r.url.endsWith(".woff2")).length;
      }
      return n;
    });
    // the build emits 12 woff2 (3 families x unicode-range subsets); a latin
    // page pulls 3. sw.ts raises defaultCache's maxEntries from 4 to 16 as
    // headroom for visiting enough routes to touch more subsets.
    check("webfonts cached for offline", fontCount >= 3, `${fontCount} cached`);

    console.log("\nNow stop the server and run:  node scripts/verify-pwa.mjs --offline");
  } else {
    console.log("--- phase 2: server down, everything must come from cache ---\n");

    // prove the origin really is unreachable, bypassing the service worker
    const dead = await fetch(`${ORIGIN}/`, { cache: "no-store" }).then(() => false).catch(() => true);
    check("origin is genuinely unreachable", dead);

    for (const route of ["/", "/products", "/bulk", "/how-it-works", "/design"]) {
      await page.goto(`${ORIGIN}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
      await sleep(route === "/design" ? 4000 : 1200);
      const body = await text(page);
      check(`${route} renders from cache`, body.length > 400, `${body.length} chars`);
    }

    const studio = await page.evaluate(() => ({
      canvas: !!document.querySelector("canvas"),
      tools: /clip art/i.test(document.body.innerText),
    }));
    check("studio mounts with no server (fabric from precache)", studio.canvas && studio.tools);
    await openLayers(page);
    check("design survives into the offline session", /uploaded image/i.test(await text(page)));

    await page.goto(`${ORIGIN}/no-such-route-anywhere`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    await sleep(1500);
    const fallback = await text(page);
    check(
      "unknown route falls back to /~offline",
      /you're offline|no connection/i.test(fallback),
      fallback.replace(/\s+/g, " ").slice(0, 70),
    );
  }
} finally {
  await browser.close();
}

console.log("\n" + "=".repeat(62));
const failed = results.filter((r) => !r.pass);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILED:");
  failed.forEach((f) => console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`));
  process.exit(1);
}
