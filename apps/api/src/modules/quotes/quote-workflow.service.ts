import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteEventKind, type QuoteStatus } from '@prisma/client';
import { canSetQuoteStatus } from '@inkhaus/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

export type QuoteActor = { id: string };

/**
 * Every change staff make to a bulk quote, and the history it leaves. The
 * customer's own `message` is never touched: the legacy PATCH used to write
 * over it, which lost the one thing the customer actually said.
 */
@Injectable()
export class QuoteWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Moves a quote to `status` and records a STATUS event. Returns false, and
   * writes nothing, when it is already there - the legacy form re-sends the
   * current status alongside a note.
   *
   * The update only matches while the quote is still what was read, so a
   * conversion landing in between (which pins the quote to WON) makes this a
   * 409 rather than a LOST quote with a live order behind it.
   */
  async setStatus(id: string, status: QuoteStatus, actor: QuoteActor): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.bulkQuote.findUnique({
        where: { id },
        select: { status: true, convertedOrderId: true },
      });
      if (!quote) throw new NotFoundException(`No quote "${id}"`);
      if (quote.status === status) return false;

      if (!canSetQuoteStatus(quote, status)) {
        throw new BadRequestException('This quote has become an order, so it stays WON.');
      }

      const { count } = await tx.bulkQuote.updateMany({
        where: { id, status: quote.status, convertedOrderId: quote.convertedOrderId },
        data: { status },
      });
      if (count === 0) {
        throw new ConflictException(
          'This quote changed while you were looking at it. Reload and try again.',
        );
      }

      await tx.quoteEvent.create({
        data: { quoteId: id, kind: QuoteEventKind.STATUS, status, actorId: actor.id },
      });
      return true;
    });
  }

  /** a staff note on the quote's history - never shown to the customer */
  async addNote(id: string, note: string, actor: QuoteActor) {
    const text = note.trim();
    if (!text) throw new BadRequestException('A note cannot be empty.');

    const exists = await this.prisma.bulkQuote.count({ where: { id } });
    if (!exists) throw new NotFoundException(`No quote "${id}"`);

    return this.prisma.quoteEvent.create({
      data: { quoteId: id, kind: QuoteEventKind.NOTE, note: text, actorId: actor.id },
    });
  }
}
