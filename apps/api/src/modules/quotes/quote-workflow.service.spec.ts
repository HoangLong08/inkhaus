import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { parseUtcDay, type QuotePatch, type QuoteState } from './admin-quotes.rules';
import { QuoteWorkflowService } from './quote-workflow.service';

const ACTOR = { id: 'admin-owner' };

/** a Prisma stand-in whose interactive transaction hands over the same stub */
function setup(
  row: Partial<QuoteState> | null,
  { updated = 1, assignee = { name: 'E2E Staff', email: 'e2e-staff@inkhaus.test' } as object | null } = {},
) {
  const tx = {
    bulkQuote: {
      findUnique: jest.fn().mockResolvedValue(
        row && { status: 'NEW', assigneeId: null, followUpAt: null, convertedOrderId: null, ...row },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: updated }),
    },
    adminUser: { findFirst: jest.fn().mockResolvedValue(assignee) },
    quoteEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = { ...tx, $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
  const service = new QuoteWorkflowService(prisma as unknown as PrismaService);

  const update = (patch: QuotePatch) => service.update('quote-1', patch, ACTOR);
  const events = () => tx.quoteEvent.createMany.mock.calls[0][0].data;

  return { tx, service, update, events };
}

describe('QuoteWorkflowService.update', () => {
  it('writes the changes pinned to what was read, and one attributed event each', async () => {
    const { tx, update, events } = setup({});

    await expect(
      update({ status: 'CONTACTED', assigneeId: 'admin-staff', followUpAt: parseUtcDay('2026-09-14') }),
    ).resolves.toBe(true);

    expect(tx.bulkQuote.updateMany).toHaveBeenCalledWith({
      where: { id: 'quote-1', status: 'NEW', convertedOrderId: null, assigneeId: null, followUpAt: null },
      data: { status: 'CONTACTED', assigneeId: 'admin-staff', followUpAt: parseUtcDay('2026-09-14') },
    });
    const written = events();
    expect(written.map((e: { kind: string }) => e.kind)).toEqual(['STATUS', 'ASSIGNED', 'FOLLOW_UP']);
    for (const event of written) expect(event).toMatchObject({ quoteId: 'quote-1', actorId: 'admin-owner' });
    expect(written[2].createdAt.getTime()).toBeGreaterThan(written[0].createdAt.getTime());
  });

  it('answers 409 when someone else changed the quote first, and records nothing', async () => {
    const { tx, update } = setup({}, { updated: 0 });

    await expect(update({ status: 'LOST' })).rejects.toThrow(ConflictException);
    expect(tx.quoteEvent.createMany).not.toHaveBeenCalled();
  });

  it('refuses an assignee who is not an active admin', async () => {
    const { tx, update } = setup({}, { assignee: null });

    await expect(update({ assigneeId: 'admin-gone' })).rejects.toThrow(BadRequestException);
    expect(tx.adminUser.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'admin-gone', isActive: true } }),
    );
    expect(tx.bulkQuote.updateMany).not.toHaveBeenCalled();
  });

  it('refuses to un-win a converted quote', async () => {
    const { tx, update } = setup({ status: 'WON', convertedOrderId: 'order-1' });

    await expect(update({ status: 'LOST' })).rejects.toThrow(BadRequestException);
    expect(tx.bulkQuote.updateMany).not.toHaveBeenCalled();
  });

  it('writes nothing when nothing changed', async () => {
    const { tx, update } = setup({ status: 'CONTACTED' });

    await expect(update({ status: 'CONTACTED' })).resolves.toBe(false);
    expect(tx.bulkQuote.updateMany).not.toHaveBeenCalled();
  });

  it('refuses an empty change before opening a transaction', async () => {
    const { tx, update } = setup({});

    await expect(update({})).rejects.toThrow(BadRequestException);
    expect(tx.bulkQuote.findUnique).not.toHaveBeenCalled();
  });

  it('answers 404 for a quote that does not exist', async () => {
    const { update } = setup(null);
    await expect(update({ status: 'WON' })).rejects.toThrow(NotFoundException);
  });

  it('routes the legacy status move through the same checks', async () => {
    const { service, tx } = setup({ status: 'WON', convertedOrderId: 'order-1' });

    await expect(service.setStatus('quote-1', 'LOST', ACTOR)).rejects.toThrow(BadRequestException);
    expect(tx.bulkQuote.updateMany).not.toHaveBeenCalled();
  });
});
