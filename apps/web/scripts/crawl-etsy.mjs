/**
 * Pulls product photography off an Etsy shop into apps/web/public/products/.
 *
 * Etsy answers plain HTTP clients with 403 — curl with a browser User-Agent
 * included — so this drives the real Chrome already on the machine, exactly the
 * way scripts/gen-pwa-assets.mjs and scripts/verify-cart.mjs do. The profile
 * directory is persistent (unlike verify-cart's throwaway temp dir) so that a
 * bot challenge solved once in --headful stays solved on later runs.
 *
 * This NEVER runs during a build. puppeteer-core is a devDependency and there is
 * no Chrome in the Vercel build container; `next build` must not depend on it.
 *
 *   node scripts/crawl-etsy.mjs --discover              # shop pages -> listing ids
 *   node scripts/crawl-etsy.mjs --fetch                 # listings   -> image urls
 *   node scripts/crawl-etsy.mjs --download              # urls       -> _incoming/
 *   node scripts/crawl-etsy.mjs --apply                 # _incoming/ -> products/<slug>/
 *   node scripts/crawl-etsy.mjs                         # all four, in order
 *
 * Flags
 *   --shop NAME        default DNAFULFILLMENT
 *   --headful          show the window, so a challenge can be solved by hand
 *   --profile DIR      persistent user data dir, default .etsy-profile
 *   --delay MS         between navigations and downloads, default 1500 (+/-40%)
 *   --max-pages N      shop pagination cap, default 6
 *   --limit N          listings cap, default 40
 *   --max-images N     gallery images per listing, default 5
 *   --size N           primary width token, default 794 (01-* also pulls 1588)
 *   --max-bytes N      refuse a file bigger than this, default 400000
 *   --force            re-download files that already exist
 *   --dry-run          print what would happen, write nothing
 *
 * After --apply, regenerate the catalog:  npm run images:sync -w @inkhaus/web
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";

import { imageSize } from "./lib/image-size.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(root, "data");
const PRODUCTS_DIR = path.join(root, "public", "products");
const INCOMING_DIR = path.join(PRODUCTS_DIR, "_incoming");
const LISTINGS_JSON = path.join(DATA_DIR, "etsy-listings.json");
const MANIFEST_JSON = path.join(DATA_DIR, "etsy-manifest.json");
const MAP_JSON = path.join(DATA_DIR, "etsy-map.json");

/* ------------------------------------------------------------------ args */

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const OPTS = {
  shop: val("--shop", "DNAFULFILLMENT"),
  headful: has("--headful"),
  profile: path.resolve(root, val("--profile", ".etsy-profile")),
  delay: Number(val("--delay", 1500)),
  maxPages: Number(val("--max-pages", 6)),
  limit: Number(val("--limit", 40)),
  maxImages: Number(val("--max-images", 5)),
  size: Number(val("--size", 794)),
  maxBytes: Number(val("--max-bytes", 400000)),
  force: has("--force"),
  dryRun: has("--dry-run"),
};

const PHASES = ["discover", "fetch", "download", "apply"];
const picked = PHASES.filter((p) => has(`--${p}`));
const RUN = picked.length ? picked : PHASES;

/* ------------------------------------------------------------------ util */

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const step = (s) => console.log(`\n${C.bold(s)}`);
const info = (s) => console.log(`  ${s}`);
const warn = (s) => console.log(`  ${C.yellow("!")} ${s}`);
const ok = (s) => console.log(`  ${C.green("+")} ${s}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** delay with jitter, so the request pattern is not a metronome */
const pause = () => sleep(Math.round(OPTS.delay * (0.6 + Math.random() * 0.8)));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  if (OPTS.dryRun) return;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) {
    throw new Error(
      `No Chrome/Edge found. Tried:\n  ${CHROME_CANDIDATES.join("\n  ")}\nSet CHROME_PATH to override.`,
    );
  }
  return hit;
}

/* --------------------------------------------------------------- browser */

/**
 * Etsy fronts its pages with a bot-detection layer. A real Chrome binary with a
 * real profile gets through most of the time; when it does not, the only honest
 * move is to show the window and let a human answer the challenge once.
 */
async function detectChallenge(page, status) {
  // Etsy answers a flagged client with 403 and a DataDome interstitial. The
  // challenge itself lives in a cross-origin iframe, so the top document's text
  // is empty — the iframe src and the status code are the reliable signals.
  if (status === 403 || status === 429) return `HTTP ${status}`;
  try {
    return await page.evaluate(() => {
      const t = (document.title || "").toLowerCase();
      if (/captcha|unusual activity|are you a robot|access denied|blocked/.test(t)) return t;
      if (location.pathname.includes("/challenge")) return "challenge path";
      if (
        document.querySelector(
          "#px-captcha, iframe[src*='captcha'], iframe[src*='captcha-delivery'], #challenge-form",
        )
      ) {
        return "captcha widget";
      }
      return null;
    });
  } catch {
    return null;
  }
}

async function waitForHuman(reason) {
  console.log(`\n  ${C.yellow("Etsy is asking for a challenge")} (${reason}).`);
  console.log("  Solve it in the open Chrome window, then press Enter here.");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((r) => rl.question("  > ", () => r()));
  rl.close();
}

async function go(page, url) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  let challenge = await detectChallenge(page, res?.status());
  if (!challenge) return true;

  if (!OPTS.headful) {
    console.log(
      `\n${C.red("Blocked by Etsy's bot check")} (${challenge}).\n` +
        `Etsy fronts its pages with DataDome, which serves a slide-to-verify\n` +
        `puzzle that only a human can answer. Re-run with a visible window:\n\n` +
        `  npm run crawl:etsy -w @inkhaus/web -- --headful\n\n` +
        `Slide the bar when it appears, press Enter in the terminal, and the\n` +
        `profile at ${path.relative(root, OPTS.profile)} keeps the answer for later runs.\n` +
        `If it keeps failing, drop the images in by hand — see scripts/README.md.`,
    );
    return false;
  }

  // give the human up to three goes; DataDome often re-challenges once
  for (let attempt = 0; attempt < 3 && challenge; attempt++) {
    await waitForHuman(challenge);
    const again = await page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    challenge = await detectChallenge(page, again?.status());
  }
  if (challenge) warn(`still challenged (${challenge}) — giving up on ${url}`);
  return !challenge;
}

async function openBrowser() {
  await mkdir(OPTS.profile, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: !OPTS.headful,
    userDataDir: OPTS.profile,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled", "--window-size=1440,1000"],
  });
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  await page.setViewport({ width: 1440, height: 1000 });
  return { browser, page };
}

/* -------------------------------------------------------------- discover */

async function discover(page) {
  step(`1 · Discovering listings in ${OPTS.shop}`);
  const known = await readJson(LISTINGS_JSON, {});
  let added = 0;

  for (let p = 1; p <= OPTS.maxPages; p++) {
    const url = `https://www.etsy.com/shop/${OPTS.shop}?page=${p}`;
    info(C.dim(url));
    if (!(await go(page, url))) return null;

    const found = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/listing/"]'))
        .map((a) => {
          const m = a.href.match(/\/listing\/(\d+)\/([^/?#]*)/);
          if (!m) return null;
          const title =
            a.getAttribute("title") ||
            a.querySelector("h3, h2, .v2-listing-card__title")?.textContent?.trim() ||
            a.textContent?.trim().slice(0, 120) ||
            "";
          return { id: m[1], slug: m[2], title, url: `https://www.etsy.com/listing/${m[1]}/` };
        })
        .filter(Boolean),
    );

    let fresh = 0;
    for (const l of found) {
      if (known[l.id]) continue;
      // merge, never replace: a partly blocked run stays resumable
      known[l.id] = { ...l, title: l.title || l.slug.replace(/-/g, " ") };
      fresh++;
    }
    added += fresh;
    info(`page ${p}: ${found.length} links, ${fresh} new (${Object.keys(known).length} total)`);

    if (fresh === 0) break;
    if (Object.keys(known).length >= OPTS.limit) break;
    await pause();
  }

  await writeJson(LISTINGS_JSON, known);
  ok(`${Object.keys(known).length} listings known, ${added} added this run`);
  return known;
}

/* ----------------------------------------------------------------- fetch */

/**
 * Etsy serves the same photo at many widths through a token in the filename
 * (il_794xN.jpg, il_fullxfull.jpg). Rewriting the token is how a sane size is
 * chosen at download time, which is what keeps `sharp` out of this repo.
 */
function atWidth(url, width) {
  return url.replace(/\/il_[^/]*?(\d+x[N\d]+)/, `/il_${width}xN`).replace(/il_fullxfull/, `il_${width}xN`);
}

async function fetchListings(page, listings) {
  step("2 · Reading each listing's gallery");
  const manifest = await readJson(MANIFEST_JSON, {});
  const ids = Object.keys(listings).slice(0, OPTS.limit);

  for (const [n, id] of ids.entries()) {
    if (manifest[id] && !OPTS.force) {
      info(C.dim(`${id} already read, skipping`));
      continue;
    }
    const l = listings[id];
    info(C.dim(`${n + 1}/${ids.length}  ${id}  ${l.title.slice(0, 60)}`));
    if (!(await go(page, l.url))) return null;

    const urls = await page.evaluate(() => {
      const out = [];
      const push = (u) => {
        if (u && u.includes("i.etsystatic.com") && !out.includes(u)) out.push(u);
      };
      document.querySelectorAll('link[rel="preload"][as="image"]').forEach((n) => push(n.href));
      document.querySelectorAll("[data-palette-listing-image]").forEach((n) => push(n.src));
      document.querySelectorAll('img[src*="i.etsystatic.com"]').forEach((n) => push(n.src));
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const j = JSON.parse(s.textContent);
          const imgs = [].concat(j.image ?? []);
          imgs.forEach((u) => push(typeof u === "string" ? u : u?.url));
        } catch {
          /* a malformed block is not worth failing the run over */
        }
      }
      return out;
    });

    // Etsy repeats each photo at several widths; one entry per distinct photo id
    const byPhoto = new Map();
    for (const u of urls) {
      const key = u.match(/\/(\d+_\d+)[._]/)?.[1] ?? u;
      if (!byPhoto.has(key)) byPhoto.set(key, u);
    }

    const images = [...byPhoto.values()]
      .slice(0, OPTS.maxImages)
      .map((u, i) => ({
        index: i,
        url: atWidth(u, OPTS.size),
        // only the lead shot gets a lightbox master; the rest would be dead weight
        url2x: i === 0 ? atWidth(u, 1588) : null,
      }));

    manifest[id] = { id, title: l.title, url: l.url, images };
    info(`  ${images.length} images`);
    await pause();
  }

  await writeJson(MANIFEST_JSON, manifest);
  const total = Object.values(manifest).reduce((n, m) => n + m.images.length, 0);
  ok(`${Object.keys(manifest).length} listings, ${total} images in the manifest`);
  return manifest;
}

/* -------------------------------------------------------------- download */

/**
 * Plain fetch() first, carrying the cookies the browser earned. Etsy's CDN
 * usually serves those directly; when it does not, the browser itself can
 * always reach an image it just rendered.
 */
async function grab(page, browser, url) {
  const cookies = await browser.cookies();
  const jar = cookies
    .filter((c) => url.includes(c.domain.replace(/^\./, "")) || c.domain.includes("etsy.com"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    const res = await fetch(url, {
      headers: {
        cookie: jar,
        referer: "https://www.etsy.com/",
        "user-agent": await page.evaluate(() => navigator.userAgent),
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {
    /* fall through to the in-browser path */
  }

  const res = await page.goto(url, { waitUntil: "load", timeout: 30000 });
  if (!res || !res.ok()) return null;
  return Buffer.from(await res.content());
}

async function download(page, browser, manifest) {
  step("3 · Downloading");
  let written = 0;
  let skipped = 0;

  for (const entry of Object.values(manifest)) {
    const dir = path.join(INCOMING_DIR, entry.id);
    if (!OPTS.dryRun) await mkdir(dir, { recursive: true });

    for (const img of entry.images) {
      for (const [url, suffix] of [
        [img.url, ""],
        [img.url2x, "@2x"],
      ]) {
        if (!url) continue;
        const file = path.join(dir, `${img.index}${suffix}.jpg`);
        if (existsSync(file) && !OPTS.force) {
          skipped++;
          continue;
        }
        if (OPTS.dryRun) {
          info(C.dim(`would write ${path.relative(root, file)}`));
          written++;
          continue;
        }

        const buf = await grab(page, browser, url);
        if (!buf) {
          warn(`could not download ${url}`);
          continue;
        }
        // the @2x master is the lightbox source and is allowed to be heavier
        const cap = suffix ? OPTS.maxBytes * 3 : OPTS.maxBytes;
        if (buf.length > cap) {
          warn(`${path.basename(file)} is ${Math.round(buf.length / 1024)}KB, over the cap — skipped`);
          continue;
        }
        const dim = imageSize(buf);
        if (!dim) {
          warn(`${url} is not a readable image — skipped`);
          continue;
        }
        await writeFile(file, buf);
        written++;
        info(C.dim(`${path.relative(root, file)}  ${dim.w}x${dim.h}  ${Math.round(buf.length / 1024)}KB`));
        await pause();
      }
    }
  }

  ok(`${written} files written, ${skipped} already present`);
}

/* ----------------------------------------------------------------- apply */

function loadCatalog() {
  const require = createRequire(import.meta.url);
  try {
    return require("@inkhaus/shared");
  } catch {
    throw new Error("Build the shared package first:  npm run build:shared");
  }
}

/**
 * Placement is never guessed. Which Etsy listing is which INKHAUS blank, and
 * which colourway each photo shows, is a judgement call about the photographs
 * themselves — so it lives in a hand-written, committed file and this step only
 * enforces it.
 */
async function apply(manifest) {
  step("4 · Applying the map");
  const { PRODUCTS, COLORS } = loadCatalog();
  const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));
  const map = await readJson(MAP_JSON, null);

  if (!map || Object.keys(map).length === 0) {
    console.log(
      `\n  No mapping at ${path.relative(root, MAP_JSON)} yet.\n` +
        `  Decide which listing is which blank, then paste this in and re-run --apply:\n`,
    );
    const scaffold = {};
    for (const e of Object.values(manifest)) {
      scaffold[e.id] = {
        _title: e.title,
        slug: "REPLACE-WITH-A-PRODUCT-SLUG",
        images: e.images.map((i) => ({ from: `${i.index}.jpg`, as: `0${i.index + 1}-any` })),
      };
    }
    console.log(JSON.stringify(scaffold, null, 2));
    console.log(`\n  Product slugs: ${PRODUCTS.map((p) => p.slug).join(", ")}`);
    console.log(`  Colour keys:   ${Object.keys(COLORS).join(", ")}, or "any"\n`);
    return;
  }

  let placed = 0;
  for (const [id, spec] of Object.entries(map)) {
    const product = bySlug.get(spec.slug);
    if (!product) throw new Error(`etsy-map.json: listing ${id} points at unknown slug "${spec.slug}"`);

    const stocked = new Set(
      product.colors.map((c) => {
        const hit = Object.entries(COLORS).find(
          ([, v]) => v.hex.toLowerCase() === c.hex.toLowerCase(),
        );
        return hit?.[0];
      }),
    );

    for (const img of spec.images ?? []) {
      const m = String(img.as).match(/^(\d{2})-([a-z]+)$/);
      if (!m) throw new Error(`etsy-map.json: listing ${id} has a malformed "as": ${img.as}`);
      const key = m[2];
      if (key !== "any" && !stocked.has(key)) {
        throw new Error(
          `etsy-map.json: listing ${id} assigns colour "${key}", which ${spec.slug} does not stock`,
        );
      }

      const from = path.join(INCOMING_DIR, id, img.from);
      if (!existsSync(from)) {
        warn(`${path.relative(root, from)} is missing — run --download first`);
        continue;
      }
      const to = path.join(PRODUCTS_DIR, spec.slug, `${img.as}${path.extname(img.from)}`);
      if (OPTS.dryRun) {
        info(C.dim(`would place ${path.relative(root, to)}`));
        placed++;
        continue;
      }
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(from, to);

      // carry the lightbox master across under the same name
      const from2x = path.join(INCOMING_DIR, id, img.from.replace(/\.(\w+)$/, "@2x.$1"));
      if (existsSync(from2x)) {
        await copyFile(from2x, to.replace(/\.(\w+)$/, "@2x.$1"));
      }
      placed++;
      info(C.dim(path.relative(root, to)));
    }
  }

  ok(`${placed} files placed`);
  console.log(`\n  Next:  npm run images:sync -w @inkhaus/web\n`);
}

/* ------------------------------------------------------------------ main */

async function main() {
  console.log(
    C.dim(
      `shop=${OPTS.shop} phases=${RUN.join(",")} headful=${OPTS.headful} ` +
        `limit=${OPTS.limit} size=${OPTS.size}${OPTS.dryRun ? " DRY-RUN" : ""}`,
    ),
  );

  const needsBrowser = RUN.some((p) => p !== "apply");
  let browser = null;
  let page = null;
  if (needsBrowser) ({ browser, page } = await openBrowser());

  try {
    let listings = await readJson(LISTINGS_JSON, {});
    let manifest = await readJson(MANIFEST_JSON, {});

    if (RUN.includes("discover")) {
      const got = await discover(page);
      if (!got) process.exitCode = 1;
      if (!got) return;
      listings = got;
    }
    if (RUN.includes("fetch")) {
      if (Object.keys(listings).length === 0) {
        warn("no listings known — run --discover first");
        return;
      }
      const got = await fetchListings(page, listings);
      if (!got) process.exitCode = 1;
      if (!got) return;
      manifest = got;
    }
    if (RUN.includes("download")) {
      if (Object.keys(manifest).length === 0) {
        warn("empty manifest — run --fetch first");
        return;
      }
      await download(page, browser, manifest);
    }
    if (RUN.includes("apply")) {
      if (Object.keys(manifest).length === 0) {
        warn("empty manifest — run --fetch first");
        return;
      }
      await apply(manifest);
    }
  } finally {
    if (browser) await browser.close();
  }
}

main().catch((err) => {
  console.error(`\n${C.red("failed")} ${err.message}`);
  process.exit(1);
});
