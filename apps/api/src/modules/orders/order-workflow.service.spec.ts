import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ORDER_INTERNAL_NOTE_MAX } from '@inkhaus/shared';

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
    orderEvent: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'evt_1' }),
    },
  };
  const prisma = { ...tx, $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) };
  const service = new OrderWorkflowService(prisma as unknown as PrismaService);

  const change = (body: StatusChange, actor: WorkflowActor = STAFF, allowSame = false) =>
    service.changeStatus('INK-000001', body, actor, { allowSame });
  const updateData = () => tx.order.updateMany.mock.calls[0][0].data;
  const events = () => tx.orderEvent.createMany.mock.calls[0][0].data;

  return { tx, service, change, updateData, events };
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

describe('OrderWorkflowService.setTracking', () => {
  const UPS = { carrier: 'UPS', number: ' 1Z999AA10123456784 ' };

  it('stores tracking on an order in production and records who added it', async () => {
    const { tx, service } = setup({ status: 'IN_PRODUCTION' });

    await expect(service.setTracking('INK-000001', UPS, STAFF)).resolves.toEqual({
      id: 'ord_1',
      number: 'INK-000001',
      changed: true,
    });
    // conditional on the status that was read, like a move
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'ord_1', status: 'IN_PRODUCTION' },
      data: { carrier: 'UPS', trackingNumber: '1Z999AA10123456784' },
    });
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'ord_1',
        kind: 'TRACKING',
        status: 'IN_PRODUCTION',
        note: 'UPS 1Z999AA10123456784',
        actorId: 'admin-staff',
      },
    });
  });

  it('corrects the tracking on an order that has already shipped', async () => {
    const { tx, service } = setup({ status: 'SHIPPED', carrier: 'UPS', trackingNumber: '1Z99' });

    await service.setTracking('INK-000001', { carrier: 'FEDEX', number: '771234567890' }, OWNER);
    expect(tx.order.updateMany.mock.calls[0][0].data).toEqual({
      carrier: 'FEDEX',
      trackingNumber: '771234567890',
    });
  });

  it.each(['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'REFUNDED'])(
    'refuses tracking on a %s order, before writing anything',
    async (status) => {
      const { tx, service } = setup({ status });

      await expect(service.setTracking('INK-000001', UPS, OWNER)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.order.updateMany).not.toHaveBeenCalled();
      expect(tx.orderEvent.create).not.toHaveBeenCalled();
    },
  );

  it('refuses a carrier it does not know', async () => {
    const { service } = setup({ status: 'IN_PRODUCTION' });

    await expect(
      service.setTracking('INK-000001', { carrier: 'PONY_EXPRESS', number: '12345' }, STAFF),
    ).rejects.toThrow(BadRequestException);
  });

  it('answers 409 when the order moved under it, and writes no event', async () => {
    const { tx, service } = setup({ status: 'IN_PRODUCTION' }, 0);

    await expect(service.setTracking('INK-000001', UPS, STAFF)).rejects.toThrow(ConflictException);
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('changes nothing, and records nothing, when the order already has that tracking', async () => {
    const { tx, service } = setup({
      status: 'SHIPPED',
      carrier: 'UPS',
      trackingNumber: '1Z999AA10123456784',
    });

    await expect(service.setTracking('INK-000001', UPS, STAFF)).resolves.toMatchObject({
      changed: false,
    });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('answers 404 for an order that does not exist', async () => {
    const { service } = setup(null);
    await expect(service.setTracking('INK-000001', UPS, STAFF)).rejects.toThrow(NotFoundException);
  });
});

describe('OrderWorkflowService.addNote', () => {
  it('files an internal note under the current status, with the author, and moves nothing', async () => {
    const { tx, service } = setup({ status: 'SHIPPED' });

    await expect(service.addNote('INK-000001', '  called the customer  ', STAFF)).resolves.toEqual({
      id: 'ord_1',
      number: 'INK-000001',
    });
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'ord_1',
        kind: 'NOTE',
        status: 'SHIPPED',
        note: 'called the customer',
        actorId: 'admin-staff',
      },
    });
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('refuses an empty note or an overlong one without touching the order', async () => {
    const { tx, service } = setup({ status: 'PAID' });

    await expect(service.addNote('INK-000001', '   ', STAFF)).rejects.toThrow(BadRequestException);
    await expect(
      service.addNote('INK-000001', 'x'.repeat(ORDER_INTERNAL_NOTE_MAX + 1), STAFF),
    ).rejects.toThrow(BadRequestException);
    expect(tx.order.findUnique).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('answers 404 for an order that does not exist', async () => {
    const { service } = setup(null);
    await expect(service.addNote('INK-000001', 'hello', STAFF)).rejects.toThrow(NotFoundException);
  });
});
