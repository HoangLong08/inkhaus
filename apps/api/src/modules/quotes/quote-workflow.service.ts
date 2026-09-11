import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuoteEventKind, type QuoteStatus } from '@prisma/client';
import { QUOTE_NOTE_MAX } from '@inkhaus/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { isEmptyPatch, planQuoteUpdate, type QuotePatch } from './admin-quotes.rules';

export type QuoteActor = { id: string };

export const QUOTE_CHANGED_MESSAGE =
  'This quote changed while you were looking at it. Reload and try again.';

/**
 * Every change staff make to a bulk quote, and the history it leaves. The
 * customer's own `message` is never touched: the legacy PATCH used to write
 * over it, which lost the one thing the customer actually said.
 */
@Injectable()
export class QuoteWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Changes a quote's status, assignee and follow-up day - any of the three -
   * and records one event per field that actually changed, all attributed to
   * `actor`. Returns false, and writes nothing, when every field sent already
   * had that value.
   *
   * One interactive transaction: read, decide, then an `updateMany` pinned to
   * the values that were read for each field it changes. Two people moving the
   * same quote both pass the checks on what they read, but only one update can
   * match; the other gets a 409 instead of silently writing over the first. A
   * conversion landing in between pins the quote to WON the same way, so a
   * status change cannot mark a quote LOST with a live order behind it.
   */
  async update(id: string, patch: QuotePatch, actor: QuoteActor): Promise<boolean> {
    if (isEmptyPatch(patch)) {
      throw new BadRequestException('Send a status, an assignee or a follow-up day to change.');
    }

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.bulkQuote.findUnique({
        where: { id },
        select: { status: true, assigneeId: true, followUpAt: true, convertedOrderId: true },
      });
      if (!quote) throw new NotFoundException(`No quote "${id}"`);

      // Only a change of assignee is checked: re-sending the current one is a
      // no-op, even if that person has since been deactivated.
      let assignee: { name: string | null; email: string } | null = null;
      if (patch.assigneeId && patch.assigneeId !== quote.assigneeId) {
        assignee = await tx.adminUser.findFirst({
          where: { id: patch.assigneeId, isActive: true },
          select: { name: true, email: true },
        });
        if (!assignee) {
          throw new BadRequestException('A quote can only be assigned to an active member of staff.');
        }
      }

      const plan = planQuoteUpdate(quote, patch, assignee);
      if (!plan.ok) throw new BadRequestException(plan.message);
      if (plan.events.length === 0) return false;

      const { count } = await tx.bulkQuote.updateMany({
        where: { id, ...plan.guard },
        data: plan.data,
      });
      if (count === 0) throw new ConflictException(QUOTE_CHANGED_MESSAGE);

      // a millisecond apart, so a timeline ordered by createdAt reads them in
      // the order the plan lists them
      const now = Date.now();
      await tx.quoteEvent.createMany({
        data: plan.events.map((event, i) => ({
          quoteId: id,
          kind: event.kind,
          status: event.status,
          note: event.note,
          actorId: actor.id,
          createdAt: new Date(now + i),
        })),
      });
      return true;
    });
  }

  /**
   * The legacy PATCH's status move - the same transaction as `update`, so
   * the old route checks, pins and records exactly what the new one does.
   */
  setStatus(id: string, status: QuoteStatus, actor: QuoteActor): Promise<boolean> {
    return this.update(id, { status }, actor);
  }

  /**
   * A staff note on the quote's history - never shown to the customer. The
   * DTOs trim and limit it already; this checks again because the workflow
   * does not assume any caller ran a ValidationPipe.
   */
  async addNote(id: string, note: string, actor: QuoteActor) {
    const text = note.trim();
    if (!text) throw new BadRequestException('A note cannot be empty.');
    if (text.length > QUOTE_NOTE_MAX) {
      throw new BadRequestException(`Keep a note to ${QUOTE_NOTE_MAX} characters or fewer.`);
    }

    const exists = await this.prisma.bulkQuote.count({ where: { id } });
    if (!exists) throw new NotFoundException(`No quote "${id}"`);

    return this.prisma.quoteEvent.create({
      data: { quoteId: id, kind: QuoteEventKind.NOTE, note: text, actorId: actor.id },
    });
  }
}
