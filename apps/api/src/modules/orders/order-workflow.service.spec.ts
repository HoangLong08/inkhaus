import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import {
  OrderWorkflowService,
  type StatusChange,
  type WorkflowActor,
} from './order-workflow.service';

type Row = {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  placedAt: Date | null;
};

const PLACED = new Date('2026-09-01T10:00:00Z');
const OWNER = { id: 'admin-owner', role: 'OWNER' as const };
const STAFF = { id: 'admin-staff', role: 'STAFF' as const };

/** a Prisma stand-in whose interactive transaction hands over the same stub */
function setup(row: Partial<Row> | null, updated = 1) {
  const tx = {
    order: {
      findUnique: jest.fn().mockResolvedValue(
        row && {
          id: 'ord_1',
          status: 'PAID',
          carrier: null,
          trackingNumber: null,
          placedAt: PLACED,
          ...row,
        },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: updated }),
    },
    orderEvent: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = { ...tx, $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
  const service = new OrderWorkflowService(prisma as unknown as PrismaService);

  const change = (body: StatusChange, actor: WorkflowActor = STAFF, allowSame = false) =>
    service.changeStatus('INK-000001', body, actor, { allowSame });
  const updateData = () => tx.order.updateMany.mock.calls[0][0].data;
  const events = () => tx.orderEvent.createMany.mock.calls[0][0].data;

  return { tx, change, updateData, events };
}

describe('OrderWorkflowService.changeStatus', () => {
  it('moves the order only while it is still in the status that was read', async () => {
    const { tx, change, updateData } = setup({ status: 'PAID' });

    await expect(change({ status: 'IN_PRODUCTION' })).resolves.toEqual({
      id: 'ord_1',
      number: 'INK-000001',
      status: 'IN_PRODUCTION',
      kind: 'STATUS',
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ord_1', status: 'PAID' } }),
    );
    expect(updateData()).toEqual({ status: 'IN_PRODUCTION' });
  });

  it('answers 409 when someone else moved the order first, and writes no event', async () => {
    const { tx, change } = setup({ status: 'PAID' }, 0);

    await expect(change({ status: 'IN_PRODUCTION' })).rejects.toThrow(ConflictException);
    expect(tx.orderEvent.createMany).not.toHaveBeenCalled();
  });

  it('records who made the change, with the note', async () => {
    const { change, events } = setup({ status: 'PAID' });

    await change({ status: 'IN_PRODUCTION', note: '  on press 2  ' });
    expect(events()).toEqual([
      expect.objectContaining({
        orderId: 'ord_1',
        kind: 'STATUS',
        status: 'IN_PRODUCTION',
        note: 'on press 2',
        actorId: 'admin-staff',
      }),
    ]);
  });

  it('stores tracking sent with the move and adds a TRACKING event after the STATUS one', async () => {
    const { change, updateData, events } = setup({ status: 'IN_PRODUCTION' });

    await change({ status: 'SHIPPED', tracking: { carrier: 'UPS', number: ' 1Z999AA10123456784 ' } });

    expect(updateData()).toEqual({
      status: 'SHIPPED',
      carrier: 'UPS',
      trackingNumber: '1Z999AA10123456784',
      shippedAt: expect.any(Date),
    });
    const [status, tracking] = events();
    expect(status).toMatchObject({ kind: 'STATUS', status: 'SHIPPED', actorId: 'admin-staff' });
    expect(tracking).toMatchObject({
      kind: 'TRACKING',
      status: 'SHIPPED',
      note: 'UPS 1Z999AA10123456784',
      actorId: 'admin-staff',
    });
    expect(tracking.createdAt.getTime()).toBeGreaterThan(status.createdAt.getTime());
  });

  it('ships on tracking the order already has', async () => {
    const { change, updateData, events } = setup({
      status: 'IN_PRODUCTION',
      carrier: 'USPS',
      trackingNumber: '9400111899223197428490',
    });

    await change({ status: 'SHIPPED' });
    expect(updateData()).toEqual({ status: 'SHIPPED', shippedAt: expect.any(Date) });
    expect(events()).toHaveLength(1);
  });

  it('refuses to ship with no tracking anywhere, before writing anything', async () => {
    const { tx, change } = setup({ status: 'IN_PRODUCTION' });

    await expect(change({ status: 'SHIPPED' })).rejects.toThrow(BadRequestException);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('refuses tracking from a carrier it does not know', async () => {
    const { change } = setup({ status: 'IN_PRODUCTION' });

    await expect(
      change({ status: 'SHIPPED', tracking: { carrier: 'PONY_EXPRESS', number: '12345' } }),
    ).rejects.toThrow(BadRequestException);
  });

  it('stamps deliveredAt on delivery', async () => {
    const { change, updateData } = setup({ status: 'SHIPPED', carrier: 'UPS', trackingNumber: '1Z99' });

    await change({ status: 'DELIVERED' });
    expect(updateData()).toEqual({ status: 'DELIVERED', deliveredAt: expect.any(Date) });
  });

  it('sets placedAt when an order leaves DRAFT', async () => {
    const { change, updateData } = setup({ status: 'DRAFT', placedAt: null });

    await change({ status: 'PENDING_PAYMENT' });
    expect(updateData()).toEqual({ status: 'PENDING_PAYMENT', placedAt: expect.any(Date) });
  });

  it('keeps a placedAt a draft somehow already had', async () => {
    const { change, updateData } = setup({ status: 'DRAFT', placedAt: PLACED });

    await change({ status: 'PENDING_PAYMENT' });
    expect(updateData().placedAt).toBe(PLACED);
  });

  it('keeps cancelling to owners', async () => {
    const staff = setup({ status: 'PAID' });
    await expect(staff.change({ status: 'CANCELLED' }, STAFF)).rejects.toThrow(ForbiddenException);
    expect(staff.tx.order.updateMany).not.toHaveBeenCalled();

    const owner = setup({ status: 'PAID' });
    await expect(owner.change({ status: 'CANCELLED' }, OWNER)).resolves.toMatchObject({
      kind: 'STATUS',
    });
  });

  it('turns a same-status request into an internal note only where allowed', async () => {
    const strict = setup({ status: 'PAID' });
    await expect(strict.change({ status: 'PAID', note: 'hi' })).rejects.toThrow(BadRequestException);

    const legacy = setup({ status: 'PAID' });
    await expect(legacy.change({ status: 'PAID', note: 'called the customer' }, STAFF, true)).resolves
      .toMatchObject({ kind: 'NOTE' });
    expect(legacy.events()).toEqual([
      expect.objectContaining({ kind: 'NOTE', status: 'PAID', note: 'called the customer' }),
    ]);
  });

  it('answers 404 for an order that does not exist', async () => {
    const { change } = setup(null);
    await expect(change({ status: 'PAID' })).rejects.toThrow(NotFoundException);
  });
});
