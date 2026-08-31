/**
 * Catalog data invariants.
 *
 * These are not style checks — every assertion here corresponds to a way the
 * running site breaks *silently*:
 *
 *   - a method label with no `METHOD_ENUM` entry makes `normalise()` return
 *     null, and `sanitizeLines` then deletes that line out of a saved cart
 *   - a size code outside `SIZE_UPCHARGE` is rejected by `OrdersService`, so
 *     the line prices fine in the browser and 400s at checkout
 *   - a colour hex that is not in `COLORS` makes `colorSlug()` fall back to a
 *     name slug the API has never heard of
 *   - a `GarmentType` with no `PATHS` entry renders as the GENERIC blank
 *
 * None of those throw in dev. They just quietly lose the customer's cart.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { imageSize } from "../../scripts/lib/image-size.mjs";
import {
  CATEGORIES,
  COLORS,
  PRODUCTS,
  PRODUCT_IMAGES,
  SIZE_UPCHARGE,
  sizesFor,
  type Product,
} from "@/lib/catalog";
import { METHOD_ENUM, METHOD_LABEL } from "@/lib/cart";
import { PATHS } from "@/lib/garment-paths";

/** the Garment viewBox every printArea is expressed in */
const VIEW_W = 600;
const VIEW_H = 700;

const named = (p: Product) => `${p.slug} (${p.name})`;

describe("catalog identity", () => {
  it("has unique, kebab-case slugs", () => {
    const seen = new Set<string>();
    for (const p of PRODUCTS) {
      expect(p.slug, `${p.name} has an empty slug`).toBeTruthy();
      expect(p.slug, `${p.slug} is not kebab-case`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(seen.has(p.slug), `duplicate slug ${p.slug}`).toBe(false);
      seen.add(p.slug);
    }
  });

  it("keeps heavyweight-tee first", () => {
    // Studio.tsx seeds its state from PRODUCTS[0], and verify-cart.mjs prices
    // its whole run against this blank. Reordering the array moves both.
    expect(PRODUCTS[0].slug).toBe("heavyweight-tee");
  });

  it("gives every product a valid category", () => {
    for (const p of PRODUCTS) {
      expect(CATEGORIES, `${named(p)} has category "${p.category}"`).toContain(p.category);
    }
  });
});

describe("pricing", () => {
  it("keeps the bulk floor under the list price", () => {
    for (const p of PRODUCTS) {
      expect(p.price, `${named(p)} price`).toBeGreaterThan(0);
      expect(p.bulkPrice, `${named(p)} bulkPrice`).toBeGreaterThan(0);
      // unitPrice() is Math.max(bulkPrice, price * (1 - off)) — a floor at or
      // above list makes every tier discount a no-op
      expect(p.bulkPrice, `${named(p)} bulk floor is not below list`).toBeLessThan(p.price);
    }
  });
});

describe("print areas", () => {
  it("sits inside the garment viewBox", () => {
    for (const p of PRODUCTS) {
      const { x, y, w, h } = p.printArea;
      expect(w, `${named(p)} printArea.w`).toBeGreaterThan(0);
      expect(h, `${named(p)} printArea.h`).toBeGreaterThan(0);
      expect(x, `${named(p)} printArea.x`).toBeGreaterThanOrEqual(0);
      expect(y, `${named(p)} printArea.y`).toBeGreaterThanOrEqual(0);
      expect(x + w, `${named(p)} printArea overflows the viewBox width`).toBeLessThanOrEqual(VIEW_W);
      expect(y + h, `${named(p)} printArea overflows the viewBox height`).toBeLessThanOrEqual(
        VIEW_H,
      );
    }
  });

  it("agrees with the real-world inches", () => {
    for (const p of PRODUCTS) {
      expect(p.printInches.w, `${named(p)} printInches.w`).toBeGreaterThan(0);
      expect(p.printInches.h, `${named(p)} printInches.h`).toBeGreaterThan(0);

      // The studio derives DPI from the ratio of these two boxes. If they
      // disagree wildly, someone transposed a width and a height and every
      // print-file export for this blank is the wrong shape.
      const svgRatio = p.printArea.w / p.printArea.h;
      const inchRatio = p.printInches.w / p.printInches.h;
      const drift = Math.abs(svgRatio - inchRatio) / inchRatio;
      expect(
        drift,
        `${named(p)} printArea ${svgRatio.toFixed(2)} vs printInches ${inchRatio.toFixed(2)}`,
      ).toBeLessThan(0.25);
    }
  });
});

describe("colourways", () => {
  const HEXES = new Set(Object.values(COLORS).map((c) => c.hex.toLowerCase()));

  it("only uses hexes that exist in COLORS", () => {
    for (const p of PRODUCTS) {
      expect(p.colors.length, `${named(p)} stocks no colours`).toBeGreaterThan(0);
      for (const c of p.colors) {
        // mirrors the seed's `Colour <hex> on <slug> is not in COLORS` throw
        expect(HEXES, `${named(p)} uses ${c.name} ${c.hex}, which is not in COLORS`).toContain(
          c.hex.toLowerCase(),
        );
      }
    }
  });

  it("does not stock the same colour twice on one blank", () => {
    for (const p of PRODUCTS) {
      const hexes = p.colors.map((c) => c.hex.toLowerCase());
      expect(new Set(hexes).size, `${named(p)} lists a colour twice`).toBe(hexes.length);
    }
  });
});

describe("print methods", () => {
  it("maps every label the cart has to send to the API", () => {
    for (const p of PRODUCTS) {
      expect(p.method.length, `${named(p)} supports no print method`).toBeGreaterThan(0);
      for (const m of p.method) {
        // METHOD_ENUM is a Record<string, ...>, so TypeScript will NOT catch a
        // missing entry — this test is the only thing standing between a new
        // method label and silently deleted cart lines
        expect(METHOD_ENUM[m], `${named(p)} uses method "${m}", missing from METHOD_ENUM`).toBeDefined();
      }
    }
  });

  it("round-trips label -> enum -> label", () => {
    for (const [label, value] of Object.entries(METHOD_ENUM)) {
      expect(METHOD_LABEL[value], `${value} does not map back to a label`).toBe(label);
    }
  });
});

describe("size runs", () => {
  it("only uses codes the API will price", () => {
    for (const p of PRODUCTS) {
      const run = sizesFor(p);
      expect(run.length, `${named(p)} has an empty size run`).toBeGreaterThan(0);
      for (const code of run) {
        // PricingService builds its upcharge map from the `sizes` table, which
        // the seed fills from ALL_SIZE_CODES; a code missing there is a 400
        expect(
          SIZE_UPCHARGE[code],
          `${named(p)} stocks size "${code}", which has no upcharge entry`,
        ).toBeDefined();
      }
      expect(new Set(run).size, `${named(p)} lists a size twice`).toBe(run.length);
    }
  });
});

describe("garment shapes", () => {
  it("has a path table entry for every type a product uses", () => {
    for (const p of PRODUCTS) {
      // without this the blank falls back to GENERIC and renders as a
      // featureless rectangle on the grid, the PDP and the studio
      expect(PATHS[p.type], `${named(p)} is type "${p.type}", which has no PATHS entry`).toBeDefined();
    }
  });

  it("gives every shape a body path", () => {
    for (const [type, shape] of Object.entries(PATHS)) {
      expect(shape.body, `${type} has no body path`).toBeTruthy();
    }
  });
});

/* --------------------------------------------------------------------- *
 * Photography
 *
 * Product images are files on disk referenced by a generated catalog. The two
 * can fall out of step in both directions, and neither shows up in a type
 * check: a reference with no file is a broken <img> in production, and a file
 * with no reference is a photo someone added that the site never shows.
 * --------------------------------------------------------------------- */

const PUBLIC = path.join(process.cwd(), "public");
const PRODUCTS_DIR = path.join(PUBLIC, "products");

function filesOnDisk(): string[] {
  if (!existsSync(PRODUCTS_DIR)) return [];
  return readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .flatMap((d) =>
      readdirSync(path.join(PRODUCTS_DIR, d.name)).map((f) => `/products/${d.name}/${f}`),
    );
}

describe("product photography", () => {
  const referenced = PRODUCTS.flatMap((p) => p.images ?? []);

  it("resolves every referenced file, at the recorded dimensions", () => {
    for (const p of PRODUCTS) {
      for (const img of p.images ?? []) {
        for (const src of [img.src, img.src2x].filter(Boolean) as string[]) {
          const abs = path.join(PUBLIC, src.replace(/^\//, ""));
          expect(existsSync(abs), `${named(p)} references ${src}, which is not on disk`).toBe(true);

          // a wrong width/height is a layout shift on every load, and it is
          // exactly what a hand-edited generated file gets wrong
          const dim = imageSize(readFileSync(abs));
          expect(dim, `${src} is not a readable image`).not.toBeNull();
          if (src === img.src) {
            expect(dim!.w, `${src} width`).toBe(img.w);
            expect(dim!.h, `${src} height`).toBe(img.h);
          }
        }
      }
    }
  });

  it("keeps a 2x master at the same aspect ratio as its base", () => {
    for (const p of PRODUCTS) {
      for (const img of p.images ?? []) {
        if (!img.src2x) continue;
        const dim = imageSize(readFileSync(path.join(PUBLIC, img.src2x.replace(/^\//, ""))));
        // the lightbox reuses the base width/height for its aspect box, so a
        // master with a different crop would be letterboxed or stretched
        const drift = Math.abs(dim!.w / dim!.h - img.w / img.h) / (img.w / img.h);
        expect(drift, `${img.src2x} is a different shape from ${img.src}`).toBeLessThan(0.02);
        expect(dim!.w, `${img.src2x} is not larger than ${img.src}`).toBeGreaterThan(img.w);
      }
    }
  });

  it("names a colourway the product actually stocks", () => {
    for (const p of PRODUCTS) {
      const stocked = new Set(
        p.colors.map(
          (c) =>
            Object.entries(COLORS).find(
              ([, v]) => v.hex.toLowerCase() === c.hex.toLowerCase(),
            )?.[0],
        ),
      );
      for (const img of p.images ?? []) {
        if (!img.color) continue;
        expect(stocked, `${named(p)} has a ${img.color} photo but does not stock it`).toContain(
          img.color,
        );
      }
    }
  });

  it("shows every file that is committed", () => {
    const known = new Set(referenced.flatMap((i) => [i.src, i.src2x].filter(Boolean) as string[]));
    for (const file of filesOnDisk()) {
      // an orphan means someone dropped a photo in and never ran images:sync,
      // so the site silently ignores it
      expect(known, `${file} is on disk but not in PRODUCT_IMAGES — run images:sync`).toContain(
        file,
      );
    }
  });

  it("keeps the generated map in step with the catalog", () => {
    for (const slug of Object.keys(PRODUCT_IMAGES)) {
      expect(
        PRODUCTS.some((p) => p.slug === slug),
        `PRODUCT_IMAGES has "${slug}", which is not a product`,
      ).toBe(true);
    }
  });

  it("stays under the committed-weight budget", () => {
    const bytes = filesOnDisk().reduce(
      (n, f) => n + statSync(path.join(PUBLIC, f.replace(/^\//, ""))).size,
      0,
    );
    // guards against someone dropping 4000px originals into the repo
    expect(bytes / 1_000_000, "public/products is over 20 MB").toBeLessThan(20);
  });
});
