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

/** at most two decimal places - checked on the integer, which floats cannot fool */
const cents = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

const money = (what: string, min: number, max: number) =>
  z
    .number({ error: `Enter ${what}.` })
    .min(min, `${capitalize(what)} must be at least ${min}.`)
    .max(max, `${capitalize(what)} must be at most ${max}.`)
    .refine(cents, "Use at most two decimal places.");

const whole = (what: string, min: number, max: number) =>
  z
    .number({ error: `Enter ${what}.` })
    .int(`${capitalize(what)} must be a whole number.`)
    .min(min, `${capitalize(what)} must be at least ${min}.`)
    .max(max, `${capitalize(what)} must be at most ${max}.`);

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

// ---------------------------------------------------------------- products

const printAreaPart = (axis: string) => whole(axis, P.printArea.min, P.printArea.max);
const inches = (what: string) => money(what, P.inches.min, P.inches.max);
const sortOrder = () => whole("a sort order", SORT.min, SORT.max);

const productFieldsShape = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(P.name, `Keep the name to ${P.name} characters.`),
  type: z.enum(GARMENT_TYPES, { error: "Pick a blank shape." }),
  category: z.enum(CATEGORIES, { error: "Pick a category." }),
  blurb: z.string().trim().max(P.blurb, `Keep the blurb to ${P.blurb} characters.`),
  fabric: z.string().trim().max(P.fabric, `Keep the fabric line to ${P.fabric} characters.`),
  /** empty clears it */
  tag: z.string().trim().max(P.tag, `Keep the tag to ${P.tag} characters.`),
  /** size codes; none means the default apparel run */
  sizes: z.array(z.string().regex(SIZE_CODE_PATTERN)).max(20),
  price: money("a price", P.price.min, P.price.max),
  bulkPrice: money("a bulk price", P.price.min, P.price.max),
  methods: z.array(z.enum(PRINT_METHODS)).min(1, "Pick at least one print method."),
  printArea: z.object({
    x: printAreaPart("x"),
    y: printAreaPart("y"),
    w: printAreaPart("the width"),
    h: printAreaPart("the height"),
  }),
  printInches: z.object({ w: inches("a width"), h: inches("a height") }),
  /** in storefront order - the first is the default colourway */
  colorSlugs: z
    .array(z.string())
    .min(P.colors.min, "Pick at least one colour.")
    .max(P.colors.max, `A product can carry at most ${P.colors.max} colours.`),
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
      message: "The bulk price cannot be more than the single-unit price.",
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
      .regex(PRODUCT_SLUG_PATTERN, "Use 2-60 lowercase letters, digits or dashes.")
      // /catalog/products/new is this app's create page, so "new" could never be opened
      .refine((slug) => slug !== "new", 'The slug cannot be "new".'),
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
    .regex(COLOR_SLUG_PATTERN, "Use 2-40 lowercase letters, digits or dashes."),
  name: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(COLOR.name, `Keep the name to ${COLOR.name} characters.`),
  hex: z.string().trim().regex(HEX, "Use a colour like #1A7F7A."),
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
  code: z.string().trim().regex(SIZE_CODE_PATTERN, "Use 1-6 capital letters or digits."),
  label: z
    .string()
    .trim()
    .min(1, "Give it a label.")
    .max(SIZE.label, `Keep the label to ${SIZE.label} characters.`),
  upcharge: money("an upcharge", SIZE.upcharge.min, SIZE.upcharge.max),
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
        minQty: z.number({ error: "Enter a quantity." }).int("Use a whole number."),
        percent: z.number({ error: "Enter a discount." }),
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
