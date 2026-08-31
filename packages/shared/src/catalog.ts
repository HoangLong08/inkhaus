// value import, but `pricing` only imports `Product` from here as a *type*, so
// that edge is erased at compile time and there is no runtime cycle
import { ONE_SIZE } from "./pricing";
import { PRODUCT_IMAGES } from "./product-images";

/**
 * Which blank shape to draw. Every value needs an entry in the web app's
 * `PATHS` table — the `Record<GarmentType, Shape>` there is exhaustive on
 * purpose, so adding a value here fails typecheck until it has been drawn.
 */
export type GarmentType =
  // apparel
  | "tee"
  | "hoodie"
  | "ziphoodie"
  | "longsleeve"
  | "tank"
  | "crewneck"
  // headwear
  | "cap"
  | "beanie"
  // bags
  | "tote"
  // drinkware
  | "mug"
  | "tumbler"
  // home
  | "blanket"
  | "pillow"
  | "apron"
  | "mousepad"
  | "ornament"
  // paper & tech
  | "phonecase"
  | "sticker"
  | "poster";

/**
 * How the shop is merchandised. Deliberately a second axis: `type` says which
 * blank shape to draw, `category` says which aisle it lives in — a tote and a
 * canvas apron draw nothing alike but a beanie and a cap belong together.
 */
export type ProductCategory =
  | "apparel"
  | "headwear"
  | "bags"
  | "drinkware"
  | "home"
  | "paper"
  | "tech";

export const CATEGORIES: ProductCategory[] = [
  "apparel",
  "headwear",
  "bags",
  "drinkware",
  "home",
  "paper",
  "tech",
];

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  apparel: "Apparel",
  headwear: "Headwear",
  bags: "Bags",
  drinkware: "Drinkware",
  home: "Home",
  paper: "Paper & print",
  tech: "Tech",
};

export type Colorway = { name: string; hex: string; dark?: boolean };

/**
 * A real product photograph.
 *
 * `src` is a root-relative path served straight out of `apps/web/public`, not a
 * bundler import: this package is compiled with plain `tsc`, so it can only ever
 * carry strings. `w`/`h` are the file's real pixel dimensions, read off the
 * image header at import time, and they are what stops `next/image` from
 * shifting the layout while the photo loads.
 */
export type ProductImage = {
  src: string;
  alt: string;
  w: number;
  h: number;
  /** a key of COLORS; absent means the shot is shown for every colourway */
  color?: string;
  /** higher-resolution master for the lightbox, when one was downloaded */
  src2x?: string;
};

export type Product = {
  slug: string;
  name: string;
  type: GarmentType;
  category: ProductCategory;
  blurb: string;
  fabric: string;
  price: number;      // 1 unit
  bulkPrice: number;  // 50+ units
  method: string[];
  colors: Colorway[];
  tag?: string;
  /** the size run this blank stocks; omitted means the default apparel run */
  sizes?: readonly string[];
  /**
   * Photographs, in display order. Absent — which is the normal state until the
   * import script has run — means the storefront draws the SVG blank instead,
   * so the whole site ships and deploys with no photography at all.
   */
  images?: ProductImage[];
  /** print area in garment-svg viewBox units */
  printArea: { x: number; y: number; w: number; h: number };
  /** real world size of that print area, inches */
  printInches: { w: number; h: number };
};

export const COLORS = {
  white: { name: "White", hex: "#F7F5F0" },
  black: { name: "Black", hex: "#151517", dark: true },
  bone: { name: "Bone", hex: "#E4DDCB" },
  sand: { name: "Sand", hex: "#C9B79A" },
  forest: { name: "Forest", hex: "#22392C", dark: true },
  navy: { name: "Navy", hex: "#1D2A44", dark: true },
  maroon: { name: "Maroon", hex: "#5A1F26", dark: true },
  acid: { name: "Acid", hex: "#D8FF3E" },
  flame: { name: "Flame", hex: "#FF4A1C", dark: true },
  slate: { name: "Slate", hex: "#6C737B", dark: true },
  butter: { name: "Butter", hex: "#F2DC94" },
  sky: { name: "Sky", hex: "#A9C9F0" },
} satisfies Record<string, Colorway> as Record<string, Colorway>;

const C = COLORS;

/**
 * The hand-authored catalog. Photography is deliberately not written in here —
 * it is generated into `product-images.ts` by the import script and merged in
 * below, so this array stays reviewable and the image file stays disposable.
 */
const RAW_PRODUCTS: Product[] = [
  {
    slug: "heavyweight-tee",
    name: "Heavyweight Tee",
    type: "tee",
    category: "apparel",
    blurb: "7.1 oz ringspun cotton with a boxy drop-shoulder cut. The one everybody reorders.",
    fabric: "100% ringspun cotton · 7.1 oz",
    price: 24,
    bulkPrice: 11.4,
    method: ["DTG", "Screen print", "Puff"],
    colors: [C.white, C.black, C.bone, C.sand, C.forest, C.navy, C.maroon, C.butter],
    tag: "Best seller",
    printArea: { x: 204, y: 242, w: 192, h: 256 },
    printInches: { w: 12, h: 16 },
  },
  {
    slug: "classic-tee",
    name: "Classic Tee",
    type: "tee",
    category: "apparel",
    blurb: "4.2 oz softstyle. Light, cheap, perfect for events and giveaways at volume.",
    fabric: "Ringspun cotton · 4.2 oz",
    price: 17,
    bulkPrice: 6.9,
    method: ["DTG", "Screen print"],
    colors: [C.white, C.black, C.sky, C.acid, C.flame, C.slate, C.maroon],
    tag: "Cheapest bulk",
    printArea: { x: 204, y: 242, w: 192, h: 256 },
    printInches: { w: 12, h: 16 },
  },
  {
    slug: "heavy-hoodie",
    name: "Heavy Fleece Hoodie",
    type: "hoodie",
    category: "apparel",
    blurb: "Brushed 400 gsm fleece, double-lined hood, no side seams. Built for embroidery.",
    fabric: "Cotton/poly fleece · 400 gsm",
    price: 52,
    bulkPrice: 28.5,
    method: ["DTG", "Screen print", "Embroidery", "Puff"],
    colors: [C.black, C.bone, C.forest, C.navy, C.slate, C.maroon],
    tag: "Premium",
    printArea: { x: 212, y: 282, w: 176, h: 176 },
    printInches: { w: 11, h: 11 },
  },
  {
    slug: "crewneck",
    name: "Boxy Crewneck",
    type: "crewneck",
    category: "apparel",
    blurb: "Vintage-washed loopback terry with a cropped body and ribbed cuffs.",
    fabric: "Loopback terry · 380 gsm",
    price: 46,
    bulkPrice: 25,
    method: ["DTG", "Screen print", "Embroidery"],
    colors: [C.bone, C.black, C.sand, C.navy, C.forest],
    printArea: { x: 204, y: 240, w: 192, h: 208 },
    printInches: { w: 12, h: 13 },
  },
  {
    slug: "long-sleeve",
    name: "Long Sleeve Tee",
    type: "longsleeve",
    category: "apparel",
    blurb: "Sleeve prints included free — the classic skate-shop layout.",
    fabric: "Ringspun cotton · 6 oz",
    price: 29,
    bulkPrice: 15.2,
    method: ["DTG", "Screen print"],
    colors: [C.white, C.black, C.bone, C.navy, C.maroon],
    tag: "Free sleeve print",
    printArea: { x: 204, y: 242, w: 192, h: 256 },
    printInches: { w: 12, h: 16 },
  },
  {
    slug: "tank",
    name: "Muscle Tank",
    type: "tank",
    category: "apparel",
    blurb: "Raw-edge armholes, gym-ready. Great for bachelorette and race merch.",
    fabric: "Combed cotton · 5.3 oz",
    price: 21,
    bulkPrice: 10.4,
    method: ["DTG", "Screen print"],
    colors: [C.white, C.black, C.acid, C.flame, C.sky],
    printArea: { x: 216, y: 272, w: 168, h: 235 },
    printInches: { w: 10, h: 14 },
  },
  {
    slug: "dad-cap",
    name: "Unstructured Dad Cap",
    type: "cap",
    category: "headwear",
    sizes: ONE_SIZE,
    blurb: "Low-profile 6-panel with a brass slider. Embroidery only — 12 thread colors.",
    fabric: "Washed chino twill",
    price: 27,
    bulkPrice: 14.8,
    method: ["Embroidery", "Leather patch"],
    colors: [C.black, C.bone, C.forest, C.navy, C.flame],
    tag: "Embroidery",
    printArea: { x: 222, y: 254, w: 156, h: 86 },
    printInches: { w: 4.5, h: 2.5 },
  },
  {
    slug: "canvas-tote",
    name: "Canvas Tote",
    type: "tote",
    category: "bags",
    sizes: ONE_SIZE,
    blurb: "16 oz natural canvas, boxed bottom, 24\" webbed handles.",
    fabric: "Natural canvas · 16 oz",
    price: 22,
    bulkPrice: 11.9,
    method: ["Screen print", "DTG"],
    colors: [C.bone, C.black, C.sand],
    printArea: { x: 206, y: 320, w: 188, h: 222 },
    printInches: { w: 11, h: 13 },
  },

  /* ---------------------------------------------------------------- *
   * Appended, never inserted. Studio.tsx seeds its state from PRODUCTS[0]
   * and verify-cart.mjs prices its whole run against that blank, so the
   * first eight entries above keep their order and their slugs.
   *
   * Every printArea below is expressed in the same 600x700 viewBox as the
   * shape it belongs to in apps/web/src/lib/garment-paths.ts, and its
   * aspect ratio matches printInches - the studio derives DPI from the two
   * together, and the catalog invariant test fails if they drift apart.
   * ---------------------------------------------------------------- */

  {
    slug: "youth-tee",
    name: "Youth Tee",
    type: "tee",
    category: "apparel",
    blurb: "The heavyweight cut scaled down. Same hand feel, school-run proof.",
    fabric: "Ringspun cotton · 5.3 oz",
    price: 15,
    bulkPrice: 6.5,
    method: ["DTG", "Screen print"],
    colors: [C.white, C.black, C.sky, C.acid, C.butter],
    sizes: ["XS", "S", "M", "L"],
    printArea: { x: 216, y: 252, w: 168, h: 224 },
    printInches: { w: 9, h: 12 },
  },
  {
    slug: "zip-hoodie",
    name: "Full-Zip Hoodie",
    type: "ziphoodie",
    category: "apparel",
    blurb: "YKK zip, double-lined hood, split kangaroo pocket. Left chest or full back.",
    fabric: "Cotton/poly fleece · 380 gsm",
    price: 58,
    bulkPrice: 32,
    method: ["Embroidery", "DTG", "Screen print"],
    colors: [C.black, C.bone, C.forest, C.navy, C.slate],
    tag: "Premium",
    // a zip runs down the middle, so the front print is left chest, not centre
    printArea: { x: 316, y: 300, w: 110, h: 110 },
    printInches: { w: 4, h: 4 },
  },
  {
    slug: "trucker-cap",
    name: "5-Panel Trucker Cap",
    type: "cap",
    category: "headwear",
    blurb: "Foam front, mesh back, snapback closure. The one that ships to events.",
    fabric: "Cotton twill front · poly mesh back",
    price: 26,
    bulkPrice: 13.9,
    method: ["Embroidery", "Leather patch"],
    colors: [C.black, C.white, C.navy, C.flame],
    sizes: ONE_SIZE,
    printArea: { x: 222, y: 254, w: 156, h: 86 },
    printInches: { w: 4.5, h: 2.5 },
  },
  {
    slug: "cuffed-beanie",
    name: "Cuffed Beanie",
    type: "beanie",
    category: "headwear",
    blurb: "Rib-knit acrylic with a deep turn-up. Embroidery lands on the cuff.",
    fabric: "Acrylic rib knit",
    price: 24,
    bulkPrice: 12.9,
    method: ["Embroidery", "Leather patch"],
    colors: [C.black, C.bone, C.forest, C.navy, C.maroon],
    sizes: ONE_SIZE,
    printArea: { x: 234, y: 430, w: 132, h: 72 },
    printInches: { w: 3.6, h: 2 },
  },
  {
    slug: "ceramic-mug",
    name: "Ceramic Mug 11 oz",
    type: "mug",
    category: "drinkware",
    blurb: "Dishwasher-safe white ceramic. Sublimation, so the print never peels.",
    fabric: "Glazed ceramic · 11 oz",
    price: 18,
    bulkPrice: 8.9,
    method: ["Sublimation"],
    colors: [C.white, C.black],
    sizes: ONE_SIZE,
    tag: "New",
    printArea: { x: 182, y: 286, w: 166, h: 144 },
    printInches: { w: 4, h: 3.5 },
  },
  {
    slug: "travel-tumbler",
    name: "Insulated Tumbler 20 oz",
    type: "tumbler",
    category: "drinkware",
    blurb: "Double-wall stainless, keeps 6 hours hot. UV print or laser engraved.",
    fabric: "18/8 stainless steel",
    price: 32,
    bulkPrice: 18.5,
    method: ["UV print", "Engraving"],
    colors: [C.white, C.black, C.sand, C.slate],
    sizes: ONE_SIZE,
    printArea: { x: 232, y: 290, w: 136, h: 200 },
    printInches: { w: 3.5, h: 5.1 },
  },
  {
    slug: "sport-bottle",
    name: "Sport Water Bottle",
    type: "tumbler",
    category: "drinkware",
    blurb: "Single-wall 24 oz with a flip straw. Team kit filler that actually gets used.",
    fabric: "Stainless steel · 24 oz",
    price: 28,
    bulkPrice: 15.9,
    method: ["UV print", "Engraving"],
    colors: [C.white, C.black, C.acid, C.sky],
    sizes: ONE_SIZE,
    printArea: { x: 236, y: 300, w: 128, h: 180 },
    printInches: { w: 3.3, h: 4.6 },
  },
  {
    slug: "sherpa-blanket",
    name: "Sherpa Fleece Blanket",
    type: "blanket",
    category: "home",
    blurb: "Printed face, sherpa back, 50×60. The highest-margin gift on the list.",
    fabric: "Poly fleece · sherpa reverse",
    price: 62,
    bulkPrice: 38,
    method: ["Sublimation"],
    colors: [C.white, C.bone, C.sand],
    sizes: ONE_SIZE,
    tag: "Premium",
    printArea: { x: 150, y: 196, w: 300, h: 264 },
    printInches: { w: 50, h: 44 },
  },
  {
    slug: "throw-pillow",
    name: "Throw Pillow 18″",
    type: "pillow",
    category: "home",
    blurb: "Spun-poly cover with a hidden zip. Insert included, printed both sides.",
    fabric: "Spun polyester · 18×18",
    price: 34,
    bulkPrice: 19.5,
    method: ["Sublimation"],
    colors: [C.white, C.bone, C.sand],
    sizes: ONE_SIZE,
    printArea: { x: 212, y: 212, w: 176, h: 176 },
    printInches: { w: 15, h: 15 },
  },
  {
    slug: "canvas-apron",
    name: "Canvas Apron",
    type: "apron",
    category: "home",
    blurb: "10 oz cotton canvas, split front pocket, adjustable neck. Cafés reorder these.",
    fabric: "Cotton canvas · 10 oz",
    price: 34,
    bulkPrice: 19.5,
    method: ["Screen print", "Embroidery", "DTG"],
    colors: [C.bone, C.black, C.sand],
    sizes: ONE_SIZE,
    printArea: { x: 214, y: 316, w: 172, h: 180 },
    printInches: { w: 10.5, h: 11 },
  },
  {
    slug: "desk-mousepad",
    name: "Desk Mat XL",
    type: "mousepad",
    category: "home",
    blurb: "31×14 stitched-edge mat over natural rubber. Edge-to-edge print.",
    fabric: "Micro-weave over rubber · 4 mm",
    price: 26,
    bulkPrice: 14,
    method: ["Sublimation"],
    colors: [C.black, C.white],
    sizes: ONE_SIZE,
    printArea: { x: 92, y: 270, w: 416, h: 182 },
    printInches: { w: 31, h: 13.5 },
  },
  {
    slug: "ceramic-ornament",
    name: "Ceramic Ornament",
    type: "ornament",
    category: "home",
    blurb: "Round gloss ceramic with a gold cord. Seasonal, and it sells out every year.",
    fabric: "Gloss ceramic · 2.9 in",
    price: 14,
    bulkPrice: 6.9,
    method: ["Sublimation"],
    colors: [C.white],
    sizes: ONE_SIZE,
    tag: "Holiday",
    printArea: { x: 232, y: 292, w: 136, h: 136 },
    printInches: { w: 2.9, h: 2.9 },
  },
  {
    slug: "tough-phone-case",
    name: "Tough Phone Case",
    type: "phonecase",
    category: "tech",
    blurb: "Two-piece polycarbonate over TPU. UV printed, so the edges wrap.",
    fabric: "Polycarbonate + TPU liner",
    price: 24,
    bulkPrice: 13.5,
    method: ["UV print"],
    colors: [C.black, C.white, C.acid, C.flame],
    sizes: ONE_SIZE,
    printArea: { x: 196, y: 270, w: 208, h: 294 },
    printInches: { w: 3, h: 4.25 },
  },
  {
    slug: "die-cut-sticker",
    name: "Die-Cut Sticker",
    type: "sticker",
    category: "paper",
    blurb: "Waterproof vinyl, cut to your outline. The cheapest thing to say yes to.",
    fabric: "Matte vinyl · laminated",
    price: 6,
    bulkPrice: 1.9,
    method: ["Digital print"],
    colors: [C.white],
    sizes: ONE_SIZE,
    tag: "Add-on",
    printArea: { x: 190, y: 218, w: 220, h: 264 },
    printInches: { w: 2.5, h: 3 },
  },
  {
    slug: "matte-poster",
    name: "Matte Art Poster 18×24",
    type: "poster",
    category: "paper",
    blurb: "200 gsm uncoated art stock. Museum-flat blacks, no glare under lights.",
    fabric: "Uncoated art paper · 200 gsm",
    price: 24,
    bulkPrice: 12.5,
    method: ["Digital print"],
    colors: [C.white, C.bone],
    sizes: ONE_SIZE,
    printArea: { x: 138, y: 118, w: 324, h: 444 },
    printInches: { w: 17.5, h: 24 },
  },
  {
    slug: "gallery-canvas",
    name: "Gallery Canvas Print",
    type: "poster",
    category: "paper",
    blurb: "16×20 stretched over kiln-dried pine, hanging kit fitted. Ships boxed.",
    fabric: "Poly-cotton canvas on pine",
    price: 58,
    bulkPrice: 34,
    method: ["Digital print"],
    colors: [C.white, C.bone],
    sizes: ONE_SIZE,
    tag: "Premium",
    printArea: { x: 150, y: 150, w: 260, h: 325 },
    printInches: { w: 16, h: 20 },
  },
];

export const PRODUCTS: Product[] = RAW_PRODUCTS.map((p) => {
  const images = PRODUCT_IMAGES[p.slug];
  // the key is omitted rather than set to [], so `p.images?.length` is the one
  // honest test for "has photography" everywhere downstream
  return images?.length ? { ...p, images } : p;
});

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
