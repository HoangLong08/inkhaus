/**
 * The words the catalog is described in - blank shapes, aisles, print methods.
 *
 * Split out of `catalog.ts` so the back office can offer these as form options
 * without pulling 24 hand-authored products (and their photography) into a client
 * bundle. `catalog.ts` re-exports the originals, so every storefront import is
 * unchanged.
 */

/**
 * Which blank shape to draw. Every value needs an entry in the web app's
 * `PATHS` table - the `Record<GarmentType, Shape>` there is exhaustive on
 * purpose, so adding a value here fails typecheck until it has been drawn. The
 * API's `GarmentType` enum is the same list in upper case; `shared-contract.spec`
 * in the API keeps the two from drifting.
 */
export const GARMENT_TYPES = [
  // apparel
  "tee",
  "hoodie",
  "ziphoodie",
  "longsleeve",
  "tank",
  "crewneck",
  // headwear
  "cap",
  "beanie",
  // bags
  "tote",
  // drinkware
  "mug",
  "tumbler",
  // home
  "blanket",
  "pillow",
  "apron",
  "mousepad",
  "ornament",
  // paper & tech
  "phonecase",
  "sticker",
  "poster",
] as const;

export type GarmentType = (typeof GARMENT_TYPES)[number];

/** display only */
export const GARMENT_TYPE_LABEL: Record<GarmentType, string> = {
  tee: "Tee",
  hoodie: "Hoodie",
  ziphoodie: "Zip hoodie",
  longsleeve: "Long sleeve",
  tank: "Tank",
  crewneck: "Crewneck",
  cap: "Cap",
  beanie: "Beanie",
  tote: "Tote",
  mug: "Mug",
  tumbler: "Tumbler",
  blanket: "Blanket",
  pillow: "Pillow",
  apron: "Apron",
  mousepad: "Mouse pad",
  ornament: "Ornament",
  phonecase: "Phone case",
  sticker: "Sticker",
  poster: "Poster",
};

/**
 * How the shop is merchandised. Deliberately a second axis: `type` says which
 * blank shape to draw, `category` says which aisle it lives in - a tote and a
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

/**
 * The database's `PrintMethod` enum, value for value. The storefront still
 * speaks in the labels ("Screen print"); the API's `METHOD_TO_LABEL` is this
 * table, so the two cannot disagree about what a method is called.
 */
export const PRINT_METHODS = [
  "DTG",
  "SCREEN_PRINT",
  "EMBROIDERY",
  "PUFF",
  "LEATHER_PATCH",
  "SUBLIMATION",
  "UV_PRINT",
  "ENGRAVING",
  "DIGITAL_PRINT",
] as const;

export type PrintMethodCode = (typeof PRINT_METHODS)[number];

export const PRINT_METHOD_LABEL: Record<PrintMethodCode, string> = {
  DTG: "DTG",
  SCREEN_PRINT: "Screen print",
  EMBROIDERY: "Embroidery",
  PUFF: "Puff",
  LEATHER_PATCH: "Leather patch",
  SUBLIMATION: "Sublimation",
  UV_PRINT: "UV print",
  ENGRAVING: "Engraving",
  DIGITAL_PRINT: "Digital print",
};
