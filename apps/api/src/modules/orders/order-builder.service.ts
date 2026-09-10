import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrderEventKind,
  Prisma,
  type Order,
  type OrderStatus,
  type PrintMethod,
} from '@prisma/client';
import { quote as computeQuote, type QuoteLine, type Tier } from '@inkhaus/shared';
import { randomUUID } from 'node:crypto';

import { num, round2 } from '../../common/decimal';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { PricingService } from '../pricing/pricing.service';

/** one line to price - what checkout sends, and what a quote conversion builds */
export type OrderItemInput = {
  productSlug: string;
  colorSlug: string;
  method: PrintMethod;
  /** a design's publicId */
  designId?: string;
  sizes: { size: string; qty: number }[];
};

export type PricedItem = {
  productId: string;
  colorId: string;
  designId?: string;
  method: PrintMethod;
  /** tier price for one unit, before size upcharges */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  sizes: QuoteLine[];
};

export type OrderTotals = { subtotal: number; shipping: number; tax: number; total: number };

export type OrderShipping = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal?: string;
  country?: string;
};

export type NewOrder = {
  customerId: string;
  status: OrderStatus;
  /** null for a DRAFT - see Order.placedAt */
  placedAt: Date | null;
  priced: PricedItem[];
  totals: OrderTotals;
  shipping?: OrderShipping;
  notes?: string | null;
  /** the first entry on the timeline */
  event: { status: OrderStatus; note: string | null; actorId?: string | null };
};

/** INK-000123 */
export const formatOrderNumber = (seq: number) => `INK-${String(seq).padStart(6, '0')}`;

/**
 * How an order comes into existence, whichever door it comes through - the
 * storefront checkout (`OrdersService.create`) or a bulk quote converted in the
 * back office. One builder, so the two cannot price the same grid differently.
 */
@Injectable()
export class OrderBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Prices every line from the database. Nothing the client says about money
   * is trusted - only slugs and quantities. The ladder is read once, so every
   * line of an order is priced against the same tiers.
   */
  async priceItems(items: readonly OrderItemInput[]): Promise<PricedItem[]> {
    const { tiers, upcharges } = await this.pricing.ladder();
    return Promise.all(items.map((item) => this.priceItem(item, tiers, upcharges)));
  }

  /** shipping and tax on top of the lines' subtotal */
  totals(priced: readonly PricedItem[]): OrderTotals {
    return this.pricing.totals(round2(priced.reduce((s, p) => s + p.lineTotal, 0)));
  }

  /**
   * Writes the order, its lines and its first event, and gives it a number.
   *
   * Takes a transaction rather than opening one, so a caller commits the order
   * together with whatever else it changes - a converted quote must never point
   * at an order that rolled back.
   */
  async createOrder(tx: Prisma.TransactionClient, input: NewOrder): Promise<Order> {
    const { shipping, totals } = input;

    const created = await tx.order.create({
      data: {
        // unique placeholder, replaced below once the sequence hands us a number
        number: `pending-${randomUUID()}`,
        status: input.status,
        customerId: input.customerId,
        subtotal: new Prisma.Decimal(totals.subtotal),
        shipping: new Prisma.Decimal(totals.shipping),
        tax: new Prisma.Decimal(totals.tax),
        total: new Prisma.Decimal(totals.total),
        shipName: shipping?.name,
        shipLine1: shipping?.line1,
        shipLine2: shipping?.line2,
        shipCity: shipping?.city,
        shipState: shipping?.state,
        shipPostal: shipping?.postal,
        shipCountry: shipping?.country ?? 'US',
        notes: input.notes,
        placedAt: input.placedAt,
        items: {
          create: input.priced.map((p) => ({
            productId: p.productId,
            colorId: p.colorId,
            designId: p.designId,
            method: p.method,
            unitPrice: new Prisma.Decimal(p.unitPrice),
            quantity: p.quantity,
            lineTotal: new Prisma.Decimal(p.lineTotal),
            sizes: {
              create: p.sizes.map((s) => ({
                size: s.size,
                quantity: s.qty,
                upcharge: new Prisma.Decimal(s.upcharge),
              })),
            },
          })),
        },
        events: {
          create: {
            kind: OrderEventKind.STATUS,
            status: input.event.status,
            note: input.event.note,
            actorId: input.event.actorId ?? null,
          },
        },
      },
    });

    // `seq` is the database's counter, so the human number can only be derived
    // after the insert - hence a second write inside the same transaction
    return tx.order.update({
      where: { id: created.id },
      data: { number: formatOrderNumber(created.seq) },
    });
  }

  /** resolve slugs to ids and recompute the line price from the live ladder */
  private async priceItem(
    item: OrderItemInput,
    tiers: Tier[],
    upcharges: Record<string, number>,
  ): Promise<PricedItem> {
    const product = await this.catalog.requireProductRow(item.productSlug);

    if (!product.methods.includes(item.method)) {
      throw new BadRequestException(`${product.name} cannot be printed with ${item.method}`);
    }

    const link = product.colors.find((c) => c.color.slug === item.colorSlug);
    if (!link) {
      throw new BadRequestException(`${product.name} is not stocked in "${item.colorSlug}"`);
    }

    const unknown = item.sizes.filter((s) => !(s.size in upcharges));
    if (unknown.length) {
      throw new BadRequestException(`Unknown size(s): ${unknown.map((s) => s.size).join(', ')}`);
    }

    let designId: string | undefined;
    if (item.designId) {
      const design = await this.prisma.design.findUnique({
        where: { publicId: item.designId },
        select: { id: true, productId: true },
      });
      if (!design) throw new NotFoundException(`No design "${item.designId}"`);
      if (design.productId !== product.id) {
        throw new BadRequestException('That design was made for a different blank');
      }
      designId = design.id;
    }

    const q = computeQuote(
      { price: num(product.price), bulkPrice: num(product.bulkPrice) },
      item.sizes,
      { tiers, upcharges },
    );

    return {
      productId: product.id,
      colorId: link.colorId,
      designId,
      method: item.method,
      unitPrice: q.baseUnitPrice,
      quantity: q.quantity,
      lineTotal: q.subtotal,
      sizes: q.lines,
    };
  }
}
