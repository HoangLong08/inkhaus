import "server-only";

import { can, PRICE_EDITS_DISABLED } from "@inkhaus/shared/admin";

import { adminApi, type AdminUser } from "@/lib/api";
import { HttpError } from "@/lib/api-guard";
import {
  productTouchesPrice,
  type ColorInput,
  type ColorUpdateInput,
  type ProductInput,
  type ProductUpdateInput,
  type SizeInput,
  type SizeUpdateInput,
  type TiersInput,
} from "@/lib/schemas/forms";

/**
 * Catalog writes with their authorization attached. The route handler has
 * already checked the route's capability; what lives here is the price rule
 * no route-level capability can express, because it depends on the body:
 *
 * - a price field needs `catalog.price` - staff get a 403 before the round trip
 * - any price write needs CATALOG_PRICE_EDITS on - a 409, with the API's own
 *   sentence (`PRICE_EDITS_DISABLED`), the flag read from the options lookup
 *
 * The API refuses both again. That is the check that protects the data; this
 * one exists so a hand-made request gets a clear answer, and so the rule has
 * exactly one home on this side of the wire.
 */

async function assertPriceEditsOpen() {
  const { priceEditsEnabled } = await adminApi.lookups.catalogOptions();
  if (!priceEditsEnabled) throw new HttpError(409, PRICE_EDITS_DISABLED);
}

function assertMayPrice(user: AdminUser, what: string) {
  if (!can(user.role, "catalog.price")) throw new HttpError(403, `Only an owner can change ${what}.`);
}

/** the route checked `catalog.create`; a new blank carries a price, so the flag applies */
export async function applyProductCreate(input: ProductInput) {
  await assertPriceEditsOpen();
  return adminApi.catalog.createProduct(input);
}

export async function applyProductUpdate(user: AdminUser, slug: string, input: ProductUpdateInput) {
  if (productTouchesPrice(input)) {
    assertMayPrice(user, "prices");
    await assertPriceEditsOpen();
  }
  return adminApi.catalog.updateProduct(slug, input);
}

/** colours carry no price: `catalog.edit`, already checked, is the whole rule */
export async function applyColorCreate(input: ColorInput) {
  return adminApi.catalog.createColor(input);
}

export async function applyColorUpdate(slug: string, input: ColorUpdateInput) {
  return adminApi.catalog.updateColor(slug, input);
}

/** the route checked `catalog.price`; a new code carries an upcharge, so the flag applies */
export async function applySizeCreate(input: SizeInput) {
  await assertPriceEditsOpen();
  return adminApi.catalog.createSize(input);
}

/** label and sort order are content; an upcharge is money */
export async function applySizeUpdate(user: AdminUser, code: string, input: SizeUpdateInput) {
  if (input.upcharge !== undefined) {
    assertMayPrice(user, "a size upcharge");
    await assertPriceEditsOpen();
  }
  return adminApi.catalog.updateSize(code, input);
}

/**
 * The route checked `catalog.price`. No flag: deleting a code nothing stocks
 * changes no price. Whether it is free to delete is the API's call (409).
 */
export async function applySizeDelete(code: string) {
  return adminApi.catalog.deleteSize(code);
}

/** the route checked `catalog.price`; the ladder is prices, so the flag applies */
export async function applyTiersReplace(input: TiersInput) {
  await assertPriceEditsOpen();
  return adminApi.catalog.replaceTiers(input);
}
