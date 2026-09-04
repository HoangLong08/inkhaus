/**
 * Renders the PWA icon set (and, optionally, the install-dialog screenshots)
 * with the same headless Chrome that produced .shots/.
 *
 * Rasterising src/app/icon.svg with sharp or resvg would silently drop the
 * Anton face and fall back to a system sans - the wordmark is the whole icon,
 * so it has to render in a real browser with the real webfont loaded.
 *
 * Output is committed. Vercel never runs this.
 *
 *   node scripts/gen-pwa-assets.mjs                 # icons only
 *   node scripts/gen-pwa-assets.mjs --screenshots   # also shoot a running server
 *
 * Set CHROME_PATH if your browser is somewhere unusual.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

import { loadRootEnv } from "@inkhaus/env";

// SITE_ORIGIN, API_ORIGIN and CHROME_PATH live in the repo-root .env with
// everything else; the defaults below still apply when it does not name them.
loadRootEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = path.join(root, "public", "icons");
const SHOTS_DIR = path.join(root, "public", "screenshots");
const APP_DIR = path.join(root, "src", "app");

const ACID = "#D8FF3E";
const INK = "#0B0B0C";

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

/**
 * @param size    rendered px, square
 * @param radius  corner radius as a fraction of size - 0 for maskable and iOS,
 *                which apply their own mask and would double-round
 * @param inset   glyph width as a fraction of size. Android's maskable safe
 *                zone is the inner 80% circle, so those need real padding.
 */
function iconHtml(size, radius, inset) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:transparent}
  .tile{
    width:${size}px;height:${size}px;
    border-radius:${Math.round(size * radius)}px;
    background:${ACID};
    display:flex;align-items:center;justify-content:center;
    overflow:hidden;
  }
  .mark{
    font-family:'Anton',sans-serif;
    font-size:${Math.round(size * inset)}px;
    line-height:1;
    color:${INK};
    letter-spacing:${-size * 0.015}px;
    /* Anton sits high in its em box; nudge onto the optical centre */
    transform:translateY(${Math.round(size * 0.012)}px);
  }
</style></head>
<body><div class="tile"><span class="mark">IH</span></div></body></html>`;
}

const ICONS = [
  { file: path.join(ICONS_DIR, "icon-192.png"), size: 192, radius: 0.125, inset: 0.56 },
  { file: path.join(ICONS_DIR, "icon-512.png"), size: 512, radius: 0.125, inset: 0.56 },
  // full-bleed, glyph pulled in so it survives the 80% circular safe zone
  { file: path.join(ICONS_DIR, "maskable-192.png"), size: 192, radius: 0, inset: 0.42 },
  { file: path.join(ICONS_DIR, "maskable-512.png"), size: 512, radius: 0, inset: 0.42 },
  // iOS rounds it itself and composites onto black if there is any alpha,
  // so this one stays square and fully opaque
  { file: path.join(APP_DIR, "apple-icon.png"), size: 180, radius: 0, inset: 0.58 },
];

// jpeg, not png: these are photographic-ish full-page captures that the browser
// only ever fetches when the install dialog opens, and as PNG the four of them
// weighed ~3 MB of committed repo. Chrome accepts image/jpeg screenshots.
const SCREENSHOTS = [
  { file: "wide-design.jpg", route: "/design", width: 1280, height: 800 },
  { file: "wide-products.jpg", route: "/products", width: 1280, height: 800 },
  { file: "narrow-design.jpg", route: "/design", width: 750, height: 1334 },
  { file: "narrow-home.jpg", route: "/", width: 750, height: 1334 },
];

async function main() {
  const withShots = process.argv.includes("--screenshots");
  const origin = process.env.SITE_ORIGIN ?? "http://localhost:4321";

  await mkdir(ICONS_DIR, { recursive: true });
  if (withShots) await mkdir(SHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--no-sandbox", "--force-device-scale-factor=1", "--hide-scrollbars"],
  });

  try {
    for (const { file, size, radius, inset } of ICONS) {
      const page = await browser.newPage();
      await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
      await page.setContent(iconHtml(size, radius, inset), { waitUntil: "networkidle0" });
      // display:block on the @font-face means the glyph is invisible until the
      // webfont lands; screenshotting before this gives a blank lime square
      await page.evaluate(() => document.fonts.ready);
      const buf = await page.screenshot({
        type: "png",
        omitBackground: radius > 0,
        clip: { x: 0, y: 0, width: size, height: size },
      });
      await writeFile(file, buf);
      console.log(`  ${path.relative(root, file)}  ${size}x${size}`);
      await page.close();
    }

    if (!withShots) {
      console.log("\nIcons written. Re-run with --screenshots (and a server on");
      console.log(`${origin}) to refresh the install-dialog screenshots.`);
      return;
    }

    for (const { file, route, width, height } of SCREENSHOTS) {
      const page = await browser.newPage();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle0", timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      // the studio mounts fabric behind a dynamic import, and Reveal/Magnetic
      // animate in - none of that is settled at networkidle
      await new Promise((r) => setTimeout(r, 2500));
      const out = path.join(SHOTS_DIR, file);
      const buf = await page.screenshot({ type: "jpeg", quality: 82 });
      await writeFile(out, buf);
      console.log(`  ${path.relative(root, out)}  ${width}x${height}  ${(buf.length / 1024).toFixed(0)} KB`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
