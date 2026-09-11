import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  QuoteEventKind,
  QuoteStatus,
  type Prisma,
  type PrintMethod,
} from '@prisma/client';
import { canConvertQuote } from '@inkhaus/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { OrderBuilderService, type OrderShipping } from '../orders/order-builder.service';
import type { QuoteActor } from './quote-workflow.service';

/** what staff chose in the convert dialog - slugs and quantities, never a price */
export type QuoteConversionInput = {
  productSlug: string;
  colorSlug: string;
  method: PrintMethod;
  sizes: { size: string; qty: number }[];
  designId?: string;
  notes?: string;
  shipping?: OrderShipping;
};

/** the first line on the new order's timeline */
export const CONVERTED_ORDER_NOTE = 'Created from bulk quote';

export const QUOTE_CONVERT_RACE_MESSAGE =
  'This quote changed while you were converting it - someone may have converted it already. Reload and check.';

/**
 * Turns a bulk quote into a DRAFT order (decision D9): priced from the database
 * by OrderBuilderService rather than from the quote's snapshot, and linked so
 * the quote is WON for good and cannot be converted twice.
 */
@Injectable()
export class QuoteConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: OrderBuilderService,
    private readonly customers: CustomersService,
  ) {}

  /**
   * Returns the new order's id and number.
   *
   * Everything that can fail on bad input - an unknown product, a colour it is
   * not stocked in, a size the ladder does not know - fails while pricing,
   * before anything is written. Then one transaction creates the order and
   * claims the quote with an `updateMany` that only matches while the quote is
   * still unconverted and in the status that was read. Two people converting
   * at once both create an order, but only one claim can match: the other
   * gets a 409 and its order rolls back with it, so a quote never points at a
   * second order and no orphan draft is left behind.
   */
  async convert(
    id: string,
    input: QuoteConversionInput,
    actor: QuoteActor,
  ): Promise<{ id: string; number: string }> {
    const quote = await this.prisma.bulkQuote.findUnique({
      where: { id },
      select: {
        email: true,
        name: true,
        company: true,
        status: true,
        customerId: true,
        convertedOrderId: true,
        convertedOrder: { select: { number: true } },
      },
    });
    if (!quote) throw new NotFoundException(`No quote "${id}"`);

    if (!canConvertQuote(quote)) {
      throw new ConflictException(
        !quote.convertedOrderId
          ? 'A lost quote cannot become an order. Reopen it first.'
          : quote.convertedOrder
            ? `This quote is already order ${quote.convertedOrder.number}.`
            : 'This quote is already an order.',
      );
    }

    const priced = await this.builder.priceItems([
      {
        productSlug: input.productSlug,
        colorSlug: input.colorSlug,
        method: input.method,
        designId: input.designId,
        sizes: input.sizes,
      },
    ]);
    const totals = this.builder.totals(priced);

    // Quotes from before customers were linked have no customerId. The upsert
    // is idempotent, so running it outside the transaction below costs nothing
    // if the conversion then fails.
    const customerId =
      quote.customerId ??
      (
        await this.customers.findOrCreate(quote.email, {
          name: quote.name ?? undefined,
          company: quote.company ?? undefined,
        })
      ).id;

    return this.prisma.$transaction(async (tx) => {
      const order = await this.builder.createOrder(tx, {
        customerId,
        status: OrderStatus.DRAFT,
        placedAt: null,
        priced,
        totals,
        shipping: input.shipping,
        notes: input.notes?.trim() || null,
        event: { status: OrderStatus.DRAFT, note: CONVERTED_ORDER_NOTE, actorId: actor.id },
      });

      const { count } = await tx.bulkQuote.updateMany({
        where: { id, status: quote.status, convertedOrderId: null },
        data: { status: QuoteStatus.WON, convertedOrderId: order.id, customerId },
      });
      // throwing inside the interactive transaction rolls the order back too
      if (count === 0) throw new ConflictException(QUOTE_CONVERT_RACE_MESSAGE);

      const now = Date.now();
      const events: Prisma.QuoteEventCreateManyInput[] = [
        {
          quoteId: id,
          kind: QuoteEventKind.CONVERTED,
          status: null,
          note: order.number,
          actorId: actor.id,
          createdAt: new Date(now),
        },
      ];
      if (quote.status !== QuoteStatus.WON) {
        events.push({
          quoteId: id,
          kind: QuoteEventKind.STATUS,
          status: QuoteStatus.WON,
          note: null,
          actorId: actor.id,
          createdAt: new Date(now + 1),
        });
      }
      await tx.quoteEvent.createMany({ data: events });

      return { id: order.id, number: order.number };
    });
  }
}
