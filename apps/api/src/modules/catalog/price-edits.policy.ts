import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const PRICE_EDITS_DISABLED =
  'Price edits are disabled until the storefront reads prices from the API.';

/**
 * Whether the back office may change what things cost (decision D13).
 *
 * Checkout prices every order from the database, but the storefront still
 * displays prices from @inkhaus/shared. Until it reads them from the API, a
 * price edited here would put one number on the product page and charge
 * another. So price, bulk price, size upcharges and the tier ladder - and
 * creating a product, which sets a price - are refused while
 * CATALOG_PRICE_EDITS is off. Content, colours, `active` and sort order stay
 * editable either way.
 *
 * A 409 rather than a 403: nobody lacks permission, the system is in a state
 * where the change would be wrong. `catalog.price` still decides who may make
 * it once it is allowed.
 */
@Injectable()
export class PriceEditsPolicy {
  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return this.config.get<boolean>('catalogPriceEdits') === true;
  }

  assertEnabled(): void {
    if (!this.enabled) throw new ConflictException(PRICE_EDITS_DISABLED);
  }
}
