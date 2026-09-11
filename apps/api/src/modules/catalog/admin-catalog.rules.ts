import { can, ONE_SIZE, SIZES, type AdminRoleCode } from '@inkhaus/shared';

/**
 * The catalog's field-level rules, pure so they can be pinned by a unit test
 * rather than through a database. The services apply them; the admin app
 * mirrors the price and bulk-price ones so its form and its route handlers say
 * the same thing the API refuses with.
 *
 * Whether price edits are open at all is NOT decided here - that is
 * PriceEditsPolicy, which every price write goes through.
 */

/** the product fields that are money - D12 keeps them to owners */
export const PRICE_FIELDS = ['price', 'bulkPrice'] as const;

type PricePatch = { price?: number | null; bulkPrice?: number | null };

/**
 * True when a product write sets a price. By presence, not by value: an owner's
 * form sends only what changed, and a staff member's never carries these keys,
 * so a price that appears at all is a price somebody meant to set.
 */
export function touchesPrice(dto: PricePatch): boolean {
  return PRICE_FIELDS.some((field) => dto[field] !== undefined);
}

/** why this role may not send these fields, or null when it may */
export function priceFieldError(role: AdminRoleCode, dto: PricePatch): string | null {
  if (!touchesPrice(dto) || can(role, 'catalog.price')) return null;
  return 'Only an owner can change prices.';
}

/**
 * The bulk price is the floor every volume discount stops at, so it can never
 * be above the single-unit price - `unitPrice` would then charge the floor for
 * one unit. Checked against the MERGED values: a patch that lowers only the
 * price below the stored bulk price is as wrong as one that raises the bulk.
 */
export function bulkPriceError(
  current: { price: number; bulkPrice: number },
  patch: PricePatch = {},
): string | null {
  const price = patch.price ?? current.price;
  const bulkPrice = patch.bulkPrice ?? current.bulkPrice;
  return bulkPrice > price
    ? `The bulk price (${bulkPrice.toFixed(2)}) cannot be more than the single-unit price (${price.toFixed(2)}).`
    : null;
}

/** codes every product without a run of its own relies on, plus the one-size code */
const BUILT_IN_SIZES: readonly string[] = [...SIZES, ...ONE_SIZE];

export function isBuiltInSize(code: string): boolean {
  return BUILT_IN_SIZES.includes(code);
}

/**
 * Whether a product with this size run stocks `code`. An empty run means the
 * default apparel run - the same fallback as `sizesFor` in @inkhaus/shared.
 */
export function stocksSize(run: readonly string[], code: string): boolean {
  return run.length ? run.includes(code) : (SIZES as readonly string[]).includes(code);
}

/** how many of these products stock `code` */
export function countStocking(runs: readonly (readonly string[])[], code: string): number {
  return runs.filter((run) => stocksSize(run, code)).length;
}

/**
 * Why a size cannot be deleted, or null when it can (D11). The built-in codes
 * are what every product without a run of its own is sold in, and what the
 * storefront iterates; a code a product stocks would vanish from its size
 * picker. Order lines keep the code as text, so history is never the reason.
 */
export function sizeDeleteError(code: string, stocking: number): string | null {
  if (isBuiltInSize(code)) {
    return `${code} is part of the default size run and cannot be deleted.`;
  }
  if (stocking > 0) {
    return `${code} is stocked by ${stocking} product${stocking === 1 ? '' : 's'}; take it out of their size runs first.`;
  }
  return null;
}

export type FieldDiff = { before: Record<string, unknown>; after: Record<string, unknown> };

/**
 * The keys of `after` whose value differs from `before`, as the audit log
 * stores them. Compared as JSON, so arrays and nested objects (a size run, a
 * print area) count as changed only when their contents do.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDiff {
  const diff: FieldDiff = { before: {}, after: {} };
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    diff.before[key] = before[key];
    diff.after[key] = after[key];
  }
  return diff;
}
