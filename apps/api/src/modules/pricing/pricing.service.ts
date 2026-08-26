import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { quote as computeQuote, type Quote, type Tier } from '@inkhaus/shared';

import { num, round2 } from '../../common/decimal';
import { CatalogService } from '../catalog/catalog.service';
import type { QuoteDto, QuoteLineDto } from './dto/quote.dto';

export type PricedQuote = Quote & {
  product: { slug: string; name: string; price: number; bulkPrice: number };
  totals?: { subtotal: number; shipping: number; tax: number; total: number };
};

@Injectable()
export class PricingService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The one place a price is decided. The web calculator may show its own number,
   * but nothing is ever charged from the client's arithmetic.
   */
  async quote(dto: QuoteDto): Promise<PricedQuote> {
    const product = await this.catalog.requireProductRow(dto.slug);
    const { tiers, upcharges } = await this.ladder();

    const unknown = dto.items.filter((i) => !(i.size in upcharges));
    if (unknown.length) {
      throw new BadRequestException(`Unknown size(s): ${unknown.map((i) => i.size).join(', ')}`);
    }
    if (!dto.items.some((i) => i.qty > 0)) {
      throw new BadRequestException('Quote needs at least one size with a quantity');
    }

    const result = computeQuote(
      { price: num(product.price), bulkPrice: num(product.bulkPrice) },
      dto.items as QuoteLineDto[],
      { tiers, upcharges },
    );

    const priced: PricedQuote = {
      ...result,
      product: {
        slug: product.slug,
        name: product.name,
        price: num(product.price),
        bulkPrice: num(product.bulkPrice),
      },
    };

    if (dto.withTotals) {
      priced.totals = this.totals(result.subtotal);
    }
    return priced;
  }

  /** shipping and tax on top of a subtotal - shared with order creation */
  totals(subtotal: number) {
    const cfg = this.config.get<{
      shippingFlat: number;
      freeShippingOver: number;
      taxRate: number;
    }>('order')!;

    const shipping = subtotal >= cfg.freeShippingOver ? 0 : cfg.shippingFlat;
    const tax = round2(subtotal * cfg.taxRate);
    return { subtotal, shipping, tax, total: round2(subtotal + shipping + tax) };
  }

  /** tiers and size upcharges straight from the database */
  async ladder(): Promise<{ tiers: Tier[]; upcharges: Record<string, number> }> {
    const [tiers, sizes] = await Promise.all([this.catalog.listTiers(), this.catalog.listSizes()]);
    return {
      tiers,
      upcharges: Object.fromEntries(sizes.map((s) => [s.code, s.upcharge])),
    };
  }
}
