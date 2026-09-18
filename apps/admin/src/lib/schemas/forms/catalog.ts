import { CATALOG_LIMITS } from "@inkhaus/shared/admin";
import { TIER_LIMITS, validateTiers } from "@inkhaus/shared/pricing";
import { CATEGORIES, GARMENT_TYPES, PRINT_METHODS } from "@inkhaus/shared/taxonomy";
import { z } from "zod";

import { COLOR_SLUG_PATTERN, PRODUCT_SLUG_PATTERN, SIZE_CODE_PATTERN } from "../params";

/**
 * Catalog input, shared by the form that collects it and the route handler
 * that receives it. The limits are `CATALOG_LIMITS`, which the API DTOs
 * validate with; the ladder and the bulk-price rule are the shared functions
 * the API refuses with, so a message shown under a field is the sentence the
 * API would have answered with.
 */

const { product: P, color: COLOR, size: SIZE, sortOrder: SORT } = CATALOG_LIMITS;

/**
 * Every `message` below is a KEY into the `Validation` namespace, never a
 * sentence. The reason is the same one s6 gives for a sign-in failure
 * travelling as `?error=NOT_ALLOWED`: a form cannot translate a string it was
 * handed already written, and this module is evaluated at import time in a
 * client component AND in a route handler, so neither `useTranslations` nor
 * `getTranslations` can be called here at all.
 *
 * `useTranslatedResolver` in `@/lib/form-resolver` is what turns them back into
 * words, and `CATALOG_VALIDATION_PARAMS` below carries the numbers so a limit
 * is still written once, in CATALOG_LIMITS, rather than re-typed into two
 * message catalogues.
 *
 * What went away with the sentences: a `capitalize()` helper that was an
 * English sentence-case rule, and ten bare noun fragments ("a price", "the
 * width", "an upcharge") spliced into four frames. Those survive a translation
 * only by accident - Vietnamese puts the verb first and takes no article - so
 * each message is now a whole sentence instead of a frame plus a noun.
 */

/** at most two decimal places - checked on the integer, which floats cannot fool */
const cents = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

const money = (field: string, min: number, max: number) =>
  z
    .number({ error: `${field}Required` })
    .min(min, `${field}Min`)
    .max(max, `${field}Max`)
    .refine(cents, "twoDecimals");

const whole = (field: string, min: number, max: number) =>
  z
    .number({ error: `${field}Required` })
    .int("wholeNumber")
    .min(min, `${field}Min`)
    .max(max, `${field}Max`);

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * The numbers the `Validation` messages interpolate, keyed by the same code the
 * schema emits. They live here rather than in the catalogues because s3 is
 * explicit that a limit is a shared constant and never a number typed twice -
 * and a catalogue is two files, so writing 400 there would be typing it three
 * times. Strings, not numbers: s9 forbids `{x, number}` in a message, so every
 * value reaches ICU already formatted.
 *
 * A code with no entry here simply interpolates nothing, which is what every
 * message without a placeholder wants.
 */
export const CATALOG_VALIDATION_PARAMS: Record<string, Record<string, string>> = {
  nameMax: { max: String(P.name) },
  blurbMax: { max: String(P.blurb) },
  fabricMax: { max: String(P.fabric) },
  tagMax: { max: String(P.tag) },
  colorsMax: { max: String(P.colors.max) },
  priceMin: { min: String(P.price.min) },
  priceMax: { max: String(P.price.max) },
  bulkPriceMin: { min: String(P.price.min) },
  bulkPriceMax: { max: String(P.price.max) },
  printAreaMin: { min: String(P.printArea.min) },
  printAreaMax: { max: String(P.printArea.max) },
  printInchesMin: { min: String(P.inches.min) },
  printInchesMax: { max: String(P.inches.max) },
  sortOrderMin: { min: String(SORT.min) },
  sortOrderMax: { max: String(SORT.max) },
  colorNameMax: { max: String(COLOR.name) },
  labelMax: { max: String(SIZE.label) },
  upchargeMin: { min: String(SIZE.upcharge.min) },
  upchargeMax: { max: String(SIZE.upcharge.max) },
};

// ---------------------------------------------------------------- products

/** the four print-area axes share one wording: the field's own label says which */
const printAreaPart = () => whole("printArea", P.printArea.min, P.printArea.max);
const inches = () => money("printInches", P.inches.min, P.inches.max);
const sortOrder = () => whole("sortOrder", SORT.min, SORT.max);

const productFieldsShape = z.object({
  name: z.string().trim().min(1, "nameRequired").max(P.name, "nameMax"),
  type: z.enum(GARMENT_TYPES, { error: "typeRequired" }),
  category: z.enum(CATEGORIES, { error: "categoryRequired" }),
  blurb: z.string().trim().max(P.blurb, "blurbMax"),
  fabric: z.string().trim().max(P.fabric, "fabricMax"),
  /** empty clears it */
  tag: z.string().trim().max(P.tag, "tagMax"),
  /** size codes; none means the default apparel run */
  sizes: z.array(z.string().regex(SIZE_CODE_PATTERN)).max(20),
  price: money("price", P.price.min, P.price.max),
  bulkPrice: money("bulkPrice", P.price.min, P.price.max),
  methods: z.array(z.enum(PRINT_METHODS)).min(1, "methodsMin"),
  printArea: z.object({
    x: printAreaPart(),
    y: printAreaPart(),
    w: printAreaPart(),
    h: printAreaPart(),
  }),
  printInches: z.object({ w: inches(), h: inches() }),
  /** in storefront order - the first is the default colourway */
  colorSlugs: z
    .array(z.string())
    .min(P.colors.min, "colorsMin")
    .max(P.colors.max, "colorsMax"),
  active: z.boolean(),
  sortOrder: sortOrder(),
});

/**
 * The same rule as `bulkPriceError` in the API: the bulk price is the floor
 * every discount stops at, so above the price it would charge the floor for a
 * single unit. Checked only when both are in hand - a PATCH carrying one of
 * them is checked against the stored other by the API.
 */
function bulkNotAbovePrice(
  value: { price?: number; bulkPrice?: number },
  ctx: z.RefinementCtx,
) {
  if (value.price === undefined || value.bulkPrice === undefined) return;
  if (value.bulkPrice > value.price) {
    ctx.addIssue({
      code: "custom",
      path: ["bulkPrice"],
      message: "bulkAbovePrice",
    });
  }
}

/**
 * A whole product: what the product form edits, and the body of a create. The
 * edit form carries the existing slug through unchanged and never sends it.
 */
export const productInputSchema = productFieldsShape
  .extend({
    slug: z
      .string()
      .trim()
      .regex(PRODUCT_SLUG_PATTERN, "slugPattern")
      // /catalog/products/new is this app's create page, so "new" could never be opened
      .refine((slug) => slug !== "new", "slugReserved"),
  })
  .superRefine(bulkNotAbovePrice);

/** a PATCH: any subset, and never the slug - it is the storefront URL */
export const productUpdateInputSchema = productFieldsShape.partial().superRefine(bulkNotAbovePrice);

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateInputSchema>;

/** the fields `catalog.price` guards; present at all means somebody meant to set them */
export const PRODUCT_PRICE_FIELDS = ["price", "bulkPrice"] as const;

export function productTouchesPrice(input: ProductUpdateInput): boolean {
  return PRODUCT_PRICE_FIELDS.some((field) => input[field] !== undefined);
}

// ----------------------------------------------------------------- colours

/** create and edit share it; the edit dialog carries the slug through and never sends it */
export const colorInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(COLOR_SLUG_PATTERN, "colorSlugPattern"),
  // its own code, not the product's: the two limits differ (40 vs 80) and the
  // number rides on the code, not on the call site
  name: z.string().trim().min(1, "nameRequired").max(COLOR.name, "colorNameMax"),
  hex: z.string().trim().regex(HEX, "hexPattern"),
  dark: z.boolean(),
  sortOrder: sortOrder(),
});

export const colorUpdateInputSchema = colorInputSchema
  .omit({ slug: true })
  .extend({ active: z.boolean() })
  .partial();

export type ColorInput = z.infer<typeof colorInputSchema>;
export type ColorUpdateInput = z.infer<typeof colorUpdateInputSchema>;

// ------------------------------------------------------------------- sizes

export const sizeInputSchema = z.object({
  code: z.string().trim().regex(SIZE_CODE_PATTERN, "sizeCodePattern"),
  label: z.string().trim().min(1, "labelRequired").max(SIZE.label, "labelMax"),
  upcharge: money("upcharge", SIZE.upcharge.min, SIZE.upcharge.max),
  sortOrder: sortOrder(),
});

/** no code - it is what order lines and product size runs store */
export const sizeUpdateInputSchema = sizeInputSchema.omit({ code: true }).partial();

export type SizeInput = z.infer<typeof sizeInputSchema>;
export type SizeUpdateInput = z.infer<typeof sizeUpdateInputSchema>;

// ------------------------------------------------------------- price tiers

function ladderIssue(
  tiers: { min: number; off: number }[],
  ctx: z.RefinementCtx,
) {
  const refused = validateTiers(tiers);
  if (refused) ctx.addIssue({ code: "custom", path: ["tiers"], message: refused });
}

/** `PUT /price-tiers`: the whole ladder, discounts as fractions (0.12 is 12%) */
export const tiersInputSchema = z
  .object({
    tiers: z
      .array(z.object({ minQty: z.number().int(), discount: z.number() }))
      .min(1)
      .max(TIER_LIMITS.maxTiers),
  })
  .superRefine(({ tiers }, ctx) =>
    ladderIssue(
      tiers.map((t) => ({ min: t.minQty, off: t.discount })),
      ctx,
    ),
  );

export type TiersInput = z.infer<typeof tiersInputSchema>;

/**
 * The tier editor speaks in percentages, because "12" is what an owner types
 * for 12% off. Validated through the same `validateTiers` as the wire schema,
 * on the fraction it will become.
 */
export const tiersFormSchema = z
  .object({
    tiers: z.array(
      z.object({
        minQty: z.number({ error: "tierQtyRequired" }).int("wholeNumber"),
        percent: z.number({ error: "tierDiscountRequired" }),
      }),
    ),
  })
  .superRefine(({ tiers }, ctx) =>
    ladderIssue(
      tiers.map((t) => ({ min: t.minQty, off: t.percent / 100 })),
      ctx,
    ),
  );

export type TiersFormValues = z.infer<typeof tiersFormSchema>;

/**
 * 12 -> 0.12. The rounding only strips float noise (7.1 / 100 is not exactly
 * 0.071): the schema above has already refused anything finer than 0.1%.
 */
export function tiersFromForm(values: TiersFormValues): TiersInput {
  return {
    tiers: values.tiers.map((t) => ({
      minQty: t.minQty,
      discount: Math.round(t.percent * 10) / 1000,
    })),
  };
}

/** 0.12 -> 12, for filling the editor from what the API stores */
export function tiersToForm(input: TiersInput): TiersFormValues {
  return {
    tiers: input.tiers.map((t) => ({
      minQty: t.minQty,
      percent: Math.round(t.discount * 1000) / 10,
    })),
  };
}
